import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    useCallback,
    useEffect,
    useRef,
    useState
} from 'react';
import {
    FaChevronDown,
    FaChevronUp,
    FaExpand,
    FaMoon
} from 'react-icons/fa';

import type { Checkin } from '../api';
import {
    COVERAGE_METHOD_LINES,
    coverageSummaryLines,
    type CoverageResult
} from '../utils/coverage';
import { formatNetDate } from '../utils/csv';

import { HeatLayer } from './HeatLayer';
import {
    APPROXIMATE_PRECISIONS,
    HULL_COLOR,
    LABEL_OFFSETS,
    MARKER_COLOR,
    MARKER_FILL,
    NCS_COLOR,
    PRECISION_NOTES,
    baseMapFor,
    clusterByPixel,
    labelDirection,
    mapColorsFor,
    ringOffset,
    type LocatedCheckin
} from './mapShared';

interface CoverageNet {
    topic: string | null;
    started_at: string | null;
    created_at: string;
}

export interface CoverageView {
    result: CoverageResult;
    net: CoverageNet | null;
    showHull: boolean;
    showHeat: boolean;
}

interface CheckinMapProps {
    checkins: Checkin[];
    radarEnabled: boolean;
    showPins: boolean;
    darkMap: boolean;
    cartoKey: string | null;
    onToggleDark: () => void;
    coverage?: CoverageView;
}

const RADAR_URL = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png';
const RADAR_REFRESH_MS = 5 * 60 * 1000;
const RADAR_ATTRIBUTION = 'NEXRAD radar: NWS via Iowa Environmental Mesonet (US only)';

const LEGEND_STORAGE_KEY = 'netminder.map.legend';
const LEGEND_TALL_MAP_PX = 500;

function readLegendPreference(): boolean | null {
    try {
        const value = localStorage.getItem(LEGEND_STORAGE_KEY);
        return value === null ? null : value === '1';
    } catch {
        return null;
    }
}

function radarTileUrl(): string {
    const bucket = Math.floor(Date.now() / RADAR_REFRESH_MS);
    return `${RADAR_URL}?_=${bucket}`;
}

function buildPopup(item: LocatedCheckin): HTMLElement {
    const { checkin } = item;
    const root = document.createElement('div');

    const title = document.createElement('strong');
    title.textContent = checkin.callsign;
    root.appendChild(title);

    const lines = [
        checkin.display_name,
        checkin.location_display,
        `Location: ${item.lat.toFixed(4)}, ${item.lon.toFixed(4)}`,
        PRECISION_NOTES[checkin.location_precision ?? 'address'] ?? null
    ];
    for (const line of lines) {
        if (!line)
            continue;
        const el = document.createElement('div');
        el.textContent = line;
        root.appendChild(el);
    }
    return root;
}

function buildMarker(item: LocatedCheckin, latLng: L.LatLng, direction: L.Direction, isNcs: boolean, dark: boolean): L.CircleMarker {
    const approximate = APPROXIMATE_PRECISIONS.includes(item.checkin.location_precision ?? '');
    const marker = L.circleMarker(latLng, {
        radius: 7,
        color: isNcs ? NCS_COLOR : approximate ? mapColorsFor(dark).approximateStroke : MARKER_COLOR,
        weight: 2,
        dashArray: approximate ? '3 3' : undefined,
        fillColor: isNcs ? NCS_COLOR : MARKER_FILL,
        fillOpacity: approximate ? 0.05 : 0.85
    });
    marker.bindTooltip(isNcs ? `${item.checkin.callsign} (NCS)` : item.checkin.callsign, {
        permanent: true,
        direction,
        offset: LABEL_OFFSETS[direction]
    });
    marker.bindPopup(buildPopup(item));
    return marker;
}

function addMarker(layer: L.LayerGroup, item: LocatedCheckin, latLng: L.LatLng, direction: L.Direction, isNcs: boolean, dark: boolean): void {
    if (isNcs) {
        L.circleMarker(latLng, {
            radius: 12,
            color: NCS_COLOR,
            weight: 2,
            fill: false,
            interactive: false
        }).addTo(layer);
    }
    buildMarker(item, latLng, direction, isNcs, dark).addTo(layer);
}

export function CheckinMap({ checkins, radarEnabled, showPins, darkMap, cartoKey, onToggleDark, coverage }: CheckinMapProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);
    const baseLayerRef = useRef<L.TileLayer | null>(null);
    const baseUrlRef = useRef<string | null>(null);
    const markerLayerRef = useRef<L.LayerGroup | null>(null);
    const coverageLayerRef = useRef<L.LayerGroup | null>(null);
    const [legendPreference, setLegendPreference] = useState<boolean | null>(readLegendPreference);
    const [tallMap, setTallMap] = useState(false);
    const legendOpen = legendPreference ?? tallMap;
    const netControlId = coverage?.result.netControl?.checkin.id ?? null;
    const renderRef = useRef<() => void>(() => undefined);
    const hasFitRef = useRef(false);
    const renderKeyRef = useRef<string | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container)
            return;

        const map = L.map(container, { zoomControl: true }).setView([39, -98], 4);
        coverageLayerRef.current = L.layerGroup().addTo(map);
        markerLayerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;

        const handleZoomEnd = () => {
            renderRef.current();
        };
        map.on('zoomend', handleZoomEnd);

        const observer = new ResizeObserver(() => {
            map.invalidateSize();
            setTallMap(container.clientHeight >= LEGEND_TALL_MAP_PX);
        });
        observer.observe(container);
        map.invalidateSize();
        setTallMap(container.clientHeight >= LEGEND_TALL_MAP_PX);

        return () => {
            observer.disconnect();
            map.off('zoomend', handleZoomEnd);
            map.remove();
            mapRef.current = null;
            baseLayerRef.current = null;
            baseUrlRef.current = null;
            markerLayerRef.current = null;
            coverageLayerRef.current = null;
            hasFitRef.current = false;
            renderKeyRef.current = null;
        };
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        const container = containerRef.current;
        if (!map || !container)
            return;

        const base = baseMapFor(darkMap, cartoKey);
        container.style.background = base.background;
        if (baseLayerRef.current && baseUrlRef.current !== base.url) {
            baseLayerRef.current.remove();
            baseLayerRef.current = null;
        }
        if (!baseLayerRef.current) {
            baseUrlRef.current = base.url;
            baseLayerRef.current = L.tileLayer(base.url, {
                attribution: base.attribution,
                subdomains: base.subdomains,
                maxZoom: 19,
                className: 'netminder-base-tiles',
                referrerPolicy: 'strict-origin-when-cross-origin'
            }).addTo(map);
            baseLayerRef.current.bringToBack();
        }
        const tiles = baseLayerRef.current.getContainer();
        if (tiles)
            tiles.style.filter = base.filter;
    }, [darkMap, cartoKey]);

    const fitAll = useCallback(() => {
        const map = mapRef.current;
        if (!map)
            return;
        const points: L.LatLng[] = [];
        for (const c of checkins) {
            if (c.latitude !== null && c.longitude !== null) {
                points.push(L.latLng(c.latitude, c.longitude));
            }
        }
        if (points.length === 0)
            return;
        map.fitBounds(L.latLngBounds(points).pad(0.2), { maxZoom: 12 });
    }, [checkins]);

    useEffect(() => {
        const map = mapRef.current;
        const layer = markerLayerRef.current;
        if (!map || !layer)
            return;

        // Polling hands us a new array every few seconds; skip rebuilding (and closing open popups) unless something shown changed
        const renderKey = `${netControlId}\n${showPins}\n${darkMap}\n${checkins
            .map(c => [c.id, c.callsign, c.display_name, c.location_display, c.latitude, c.longitude, c.location_source, c.location_precision].join('|'))
            .join('\n')}`;
        if (renderKey === renderKeyRef.current)
            return;
        renderKeyRef.current = renderKey;

        const located: LocatedCheckin[] = [];
        for (const checkin of checkins) {
            if (checkin.latitude !== null && checkin.longitude !== null) {
                located.push({
                    checkin,
                    lat: checkin.latitude,
                    lon: checkin.longitude
                });
            }
        }
        const leaderColor = mapColorsFor(darkMap).leader;
        const render = () => {
            layer.clearLayers();
            if (!showPins)
                return;
            const clusters = clusterByPixel(located, item => map.latLngToLayerPoint([item.lat, item.lon]));
            for (const cluster of clusters) {
                const group = cluster.items;
                const first = group[0];

                if (group.length === 1) {
                    addMarker(layer, first, L.latLng(first.lat, first.lon), 'right', first.checkin.id === netControlId, darkMap);
                    continue;
                }

                const centroid = L.point(cluster.x, cluster.y);
                group.forEach((item, index) => {
                    const trueLatLng = L.latLng(item.lat, item.lon);
                    const offset = ringOffset(index, group.length);
                    const spread = map.layerPointToLatLng(centroid.add(offset));
                    L.circleMarker(trueLatLng, {
                        radius: 2.5,
                        color: leaderColor,
                        weight: 1,
                        fillColor: leaderColor,
                        fillOpacity: 1,
                        interactive: false
                    }).addTo(layer);
                    L.polyline([trueLatLng, spread], {
                        color: leaderColor,
                        weight: 1.5,
                        opacity: 0.8,
                        interactive: false
                    }).addTo(layer);
                    addMarker(layer, item, spread, labelDirection(offset), item.checkin.id === netControlId, darkMap);
                });
            }
        };

        renderRef.current = render;
        render();

        if (!hasFitRef.current && located.length > 0) {
            hasFitRef.current = true;
            fitAll();
        }
    }, [checkins, darkMap, fitAll, netControlId, showPins]);

    const hullPoints = coverage?.showHull ? coverage.result.hull : null;
    const heatPoints = coverage?.showHeat ? coverage.result.heatPoints : null;
    const farthest = coverage?.result.farthest ?? null;
    const netControl = coverage?.result.netControl ?? null;

    useEffect(() => {
        const layer = coverageLayerRef.current;
        if (!layer)
            return;

        if (hullPoints) {
            L.polygon(hullPoints.map(p => L.latLng(p.lat, p.lon)), {
                color: HULL_COLOR,
                weight: 2,
                fillColor: HULL_COLOR,
                fillOpacity: 0.15,
                interactive: false
            }).addTo(layer);
        }
        if (netControl && farthest) {
            L.polyline([L.latLng(netControl.lat, netControl.lon), L.latLng(farthest.station.lat, farthest.station.lon)], {
                color: NCS_COLOR,
                weight: 2,
                dashArray: '6 6',
                interactive: false
            }).addTo(layer);
        }

        return () => {
            layer.clearLayers();
        };
    }, [hullPoints, netControl, farthest]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !heatPoints)
            return;

        const heat = new HeatLayer(heatPoints).addTo(map);
        return () => {
            heat.remove();
        };
    }, [heatPoints]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !radarEnabled)
            return;

        const radar = L.tileLayer(radarTileUrl(), {
            opacity: 0.6,
            attribution: RADAR_ATTRIBUTION
        }).addTo(map);
        const interval = setInterval(() => radar.setUrl(radarTileUrl()), RADAR_REFRESH_MS);

        return () => {
            clearInterval(interval);
            radar.remove();
        };
    }, [radarEnabled]);

    return (
        <div className='relative isolate h-full w-full'>
            <div ref={containerRef} className='h-full w-full' />
            <button
                type='button'
                onClick={fitAll}
                className='absolute right-3 top-3 z-[1000] flex items-center gap-2 rounded-lg border border-slate-700/70 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-200 shadow-md shadow-black/30 transition-colors hover:border-slate-600 hover:bg-slate-800'
            >
                <FaExpand />
                Fit all
            </button>
            <button
                type='button'
                onClick={onToggleDark}
                aria-pressed={darkMap}
                title='Dark map'
                className={`absolute right-3 top-14 z-[1000] flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs shadow-md shadow-black/30 transition-colors ${darkMap ? 'border-indigo-500/70 bg-indigo-950/90 text-indigo-200 hover:bg-indigo-900/90' : 'border-slate-700/70 bg-slate-900/90 text-slate-200 hover:border-slate-600 hover:bg-slate-800'}`}
            >
                <FaMoon />
                Dark
            </button>
            {coverage && (
                <CoverageLegend
                    coverage={coverage}
                    open={legendOpen}
                    onToggle={() => {
                        setLegendPreference(!legendOpen);
                        try {
                            localStorage.setItem(LEGEND_STORAGE_KEY, legendOpen ? '0' : '1');
                        } catch {
                            // Preference is optional; ignore storage failures
                        }
                    }}
                />
            )}
        </div>
    );
}

function CoverageLegend({ coverage, open, onToggle }: { coverage: CoverageView; open: boolean; onToggle: () => void }) {
    const { result, net, showHull, showHeat } = coverage;
    const lines = coverageSummaryLines(result);
    const layerLines = [
        ...(showHull ? [COVERAGE_METHOD_LINES.hull] : []),
        ...(showHeat ? [COVERAGE_METHOD_LINES.heat] : []),
        COVERAGE_METHOD_LINES.approximate
    ];

    return (
        <div className='absolute bottom-6 left-3 z-[1000] max-h-[calc(100%-8rem)] max-w-[16rem] overflow-y-auto rounded-lg border border-slate-700/70 bg-slate-900/85 text-[11px] leading-snug text-slate-200 shadow-md shadow-black/30'>
            <button
                type='button'
                onClick={onToggle}
                aria-expanded={open}
                className='flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left font-semibold text-slate-100 hover:bg-slate-800/70'
            >
                Legend
                {open ? <FaChevronDown /> : <FaChevronUp />}
            </button>
            {open && (
                <div className='px-3 pb-2'>
                    <div className='font-semibold text-slate-100'>
                        {net?.topic ?? 'Net'}
                        {net && <span className='ml-2 font-normal text-slate-400'>{formatNetDate(net)}</span>}
                    </div>
                    <div className='mt-1 space-y-0.5'>
                        {lines.map(line => <div key={line}>{line}</div>)}
                    </div>
                    <div className='mt-1.5 space-y-0.5 border-t border-slate-700/60 pt-1.5 text-slate-400'>
                        {result.netControl && (
                            <div className='flex items-center gap-1.5'>
                                <span className='inline-block h-2.5 w-2.5 rounded-full border-2' style={{ borderColor: NCS_COLOR, backgroundColor: NCS_COLOR }} />
                                {`Net control: ${result.netControl.checkin.callsign}`}
                            </div>
                        )}
                        {layerLines.map(line => <div key={line}>{line}</div>)}
                    </div>
                </div>
            )}
        </div>
    );
}