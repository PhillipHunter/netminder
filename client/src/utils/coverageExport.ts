import {
    HEAT_RADIUS_METERS,
    drawHeat
} from '../components/HeatLayer';
import {
    APPROXIMATE_PRECISIONS,
    HULL_COLOR,
    LEADER_COLOR,
    MARKER_COLOR,
    MARKER_FILL,
    NCS_COLOR,
    OSM_URL,
    PRECISION_NOTES,
    clusterByPixel,
    labelDirection,
    ringOffset,
    type LocatedCheckin
} from '../components/mapShared';

import {
    COVERAGE_METHOD_LINES,
    coverageSummaryLines,
    type CoverageResult,
    type CoverageStation
} from './coverage';
import { formatNetDate } from './csv';
import {
    metersPerPixel,
    toWorldPixel
} from './geo';

export interface CoverageExportNet {
    topic: string | null;
    started_at: string | null;
    created_at: string;
}

export interface CoveragePngOptions {
    showHull: boolean;
    showHeat: boolean;
    showLabels: boolean;
}

const PNG_WIDTH = 1600;
const PNG_HEIGHT = 1200;
const TILE_SIZE = 256;
const MAX_EXPORT_ZOOM = 15;
const FIT_PADDING = 0.08;
const TITLE_BAR_HEIGHT = 60;
const PANEL_MARGIN = 20;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function downloadBlob(blob: Blob, filename: string): void {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

function filename(net: CoverageExportNet | null, extension: string): string {
    const date = net ? formatNetDate(net) : new Date().toISOString().slice(0, 10);
    return `net-${date}-coverage.${extension}`;
}

function netTitle(net: CoverageExportNet | null): string {
    return net?.topic ?? 'Net';
}

function stationDescription(station: CoverageStation): string[] {
    const { checkin } = station;
    return [
        checkin.display_name,
        checkin.location_display,
        PRECISION_NOTES[checkin.location_precision ?? 'address']
    ].filter((line): line is string => Boolean(line));
}

function methodText(result: CoverageResult): string {
    return [COVERAGE_METHOD_LINES.hull, COVERAGE_METHOD_LINES.heat, COVERAGE_METHOD_LINES.approximate]
        .concat(result.netControlApproximate ? ['Net control position is approximate; distances are estimates'] : [])
        .join('. ');
}

function closedHull(result: CoverageResult): { lat: number; lon: number }[] | null {
    if (!result.hull)
        return null;
    return [...result.hull, result.hull[0]];
}

// ---------------------------------------------------------------- PNG

function chooseZoom(points: { lat: number; lon: number }[], areaWidth: number, areaHeight: number): number {
    const world = points.map(p => toWorldPixel(p, 0));
    const xs = world.map(p => p.x);
    const ys = world.map(p => p.y);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    const fitX = spanX > 0 ? (areaWidth * (1 - 2 * FIT_PADDING)) / spanX : Infinity;
    const fitY = spanY > 0 ? (areaHeight * (1 - 2 * FIT_PADDING)) / spanY : Infinity;
    const fit = Math.min(fitX, fitY);
    return Math.max(0, Math.min(MAX_EXPORT_ZOOM, Math.log2(fit)));
}

function loadTile(zoom: number, x: number, y: number): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.referrerPolicy = 'strict-origin-when-cross-origin';
        image.onload = () => {
            resolve(image);
        };
        image.onerror = () => {
            resolve(null);
        };
        image.src = OSM_URL.replace('{z}', String(zoom)).replace('{x}', String(x)).replace('{y}', String(y));
    });
}

async function drawTiles(ctx: CanvasRenderingContext2D, zoom: number, originX: number, originY: number): Promise<void> {
    const tileZoom = Math.floor(zoom);
    const tileCount = 2 ** tileZoom;
    const tileSize = TILE_SIZE * 2 ** (zoom - tileZoom);
    const jobs: Promise<void>[] = [];
    for (let tx = Math.floor(originX / tileSize); tx <= Math.floor((originX + PNG_WIDTH) / tileSize); tx++) {
        for (let ty = Math.floor(originY / tileSize); ty <= Math.floor((originY + PNG_HEIGHT) / tileSize); ty++) {
            if (ty < 0 || ty >= tileCount)
                continue;
            const wrappedX = ((tx % tileCount) + tileCount) % tileCount;
            const drawX = Math.round(tx * tileSize - originX);
            const drawY = Math.round(ty * tileSize - originY);
            jobs.push(loadTile(tileZoom, wrappedX, ty).then((image) => {
                if (image)
                    ctx.drawImage(image, drawX, drawY, Math.ceil(tileSize) + 1, Math.ceil(tileSize) + 1);
            }));
        }
    }
    await Promise.all(jobs);
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    let current = '';
    for (const word of text.split(' ')) {
        const candidate = current ? `${current} ${word}` : word;
        if (current && ctx.measureText(candidate).width > maxWidth) {
            lines.push(current);
            current = word;
        } else {
            current = candidate;
        }
    }
    if (current)
        lines.push(current);
    return lines;
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, direction: string): void {
    ctx.font = `600 13px ${FONT}`;
    const padX = 5;
    const boxW = ctx.measureText(text).width + padX * 2;
    const boxH = 20;
    const gap = 12;
    let boxX = x - boxW / 2;
    let boxY = y - boxH / 2;
    if (direction === 'left')
        boxX = x - gap - boxW;
    else if (direction === 'right')
        boxX = x + gap;
    else if (direction === 'top')
        boxY = y - gap - boxH;
    else
        boxY = y + gap;

    roundedRect(ctx, boxX, boxY, boxW, boxH, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,116,139,0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(text, boxX + padX, boxY + boxH / 2 + 0.5);
}

function drawMarker(ctx: CanvasRenderingContext2D, station: CoverageStation, x: number, y: number, direction: string, isNcs: boolean, showLabels: boolean): void {
    const approximate = APPROXIMATE_PRECISIONS.includes(station.checkin.location_precision ?? '');
    if (isNcs) {
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.strokeStyle = NCS_COLOR;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = isNcs ? NCS_COLOR : MARKER_FILL;
    ctx.globalAlpha = approximate ? 0.05 : 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.setLineDash(approximate ? [3, 3] : []);
    ctx.strokeStyle = isNcs ? NCS_COLOR : MARKER_COLOR;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    if (showLabels)
        drawLabel(ctx, isNcs ? `${station.checkin.callsign} (NCS)` : station.checkin.callsign, x, y, direction);
}

interface PanelLayout {
    lines: { text: string; color: string }[];
    width: number;
    height: number;
}

const PANEL_TEXT_WIDTH = 560;
const PANEL_PADDING = 14;
const PANEL_LINE_HEIGHT = 21;

function layoutPanel(ctx: CanvasRenderingContext2D, result: CoverageResult, options: CoveragePngOptions): PanelLayout {
    ctx.font = `15px ${FONT}`;
    const sections: { text: string; color: string }[] = [];
    for (const line of coverageSummaryLines(result))
        sections.push({ text: line, color: '#e2e8f0' });
    if (result.netControl)
        sections.push({ text: `Net control: ${result.netControl.checkin.callsign}`, color: '#fbbf24' });
    if (options.showHull)
        sections.push({ text: COVERAGE_METHOD_LINES.hull, color: '#94a3b8' });
    if (options.showHeat)
        sections.push({ text: COVERAGE_METHOD_LINES.heat, color: '#94a3b8' });
    sections.push({ text: COVERAGE_METHOD_LINES.approximate, color: '#94a3b8' });
    if (result.unlocated.length > 0)
        sections.push({ text: `No location: ${result.unlocated.join(', ')}`, color: '#94a3b8' });

    const lines = sections.flatMap(s => wrapText(ctx, s.text, PANEL_TEXT_WIDTH).map(text => ({ text, color: s.color })));
    return {
        lines,
        width: PANEL_TEXT_WIDTH + PANEL_PADDING * 2,
        height: lines.length * PANEL_LINE_HEIGHT + PANEL_PADDING * 2 - 4
    };
}

function drawPanel(ctx: CanvasRenderingContext2D, layout: PanelLayout): void {
    const x = PANEL_MARGIN;
    const y = PNG_HEIGHT - PANEL_MARGIN - layout.height;

    roundedRect(ctx, x, y, layout.width, layout.height, 10);
    ctx.fillStyle = 'rgba(15,23,42,0.88)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(71,85,105,0.9)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = `15px ${FONT}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    layout.lines.forEach((line, i) => {
        ctx.fillStyle = line.color;
        ctx.fillText(line.text, x + PANEL_PADDING, y + PANEL_PADDING + i * PANEL_LINE_HEIGHT);
    });
}

export async function exportCoveragePng(result: CoverageResult, net: CoverageExportNet | null, options: CoveragePngOptions): Promise<void> {
    const canvas = document.createElement('canvas');
    canvas.width = PNG_WIDTH;
    canvas.height = PNG_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        throw new Error('Canvas is not supported in this browser');

    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, PNG_WIDTH, PNG_HEIGHT);

    const panel = layoutPanel(ctx, result, options);
    const areaTop = TITLE_BAR_HEIGHT;
    const areaHeight = PNG_HEIGHT - TITLE_BAR_HEIGHT - panel.height - PANEL_MARGIN * 2;

    const stations = result.stations;
    if (stations.length > 0) {
        const zoom = chooseZoom(stations, PNG_WIDTH, areaHeight);
        const world = stations.map(p => toWorldPixel(p, zoom));
        const xs = world.map(p => p.x);
        const ys = world.map(p => p.y);
        const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
        const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
        const originX = centerX - PNG_WIDTH / 2;
        const originY = centerY - (areaTop + areaHeight / 2);
        const toCanvas = (p: { lat: number; lon: number }): { x: number; y: number } => {
            const w = toWorldPixel(p, zoom);
            return { x: w.x - originX, y: w.y - originY };
        };

        await drawTiles(ctx, zoom, originX, originY);

        if (options.showHeat && result.heatPoints.length > 0) {
            const centerLat = (Math.min(...stations.map(s => s.lat)) + Math.max(...stations.map(s => s.lat))) / 2;
            const radius = Math.max(4, HEAT_RADIUS_METERS / metersPerPixel(centerLat, zoom));
            drawHeat(ctx, result.heatPoints.map(toCanvas), radius, PNG_WIDTH, PNG_HEIGHT);
        }

        const hull = options.showHull ? closedHull(result) : null;
        if (hull) {
            ctx.beginPath();
            hull.forEach((p, i) => {
                const c = toCanvas(p);
                if (i === 0)
                    ctx.moveTo(c.x, c.y);
                else
                    ctx.lineTo(c.x, c.y);
            });
            ctx.closePath();
            ctx.fillStyle = 'rgba(99,102,241,0.15)';
            ctx.fill();
            ctx.strokeStyle = HULL_COLOR;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        if (result.netControl && result.farthest) {
            const from = toCanvas(result.netControl);
            const to = toCanvas(result.farthest.station);
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.setLineDash([6, 6]);
            ctx.strokeStyle = NCS_COLOR;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.setLineDash([]);
        }

        const located: (LocatedCheckin & { station: CoverageStation })[] = stations.map(station => ({
            checkin: station.checkin,
            lat: station.lat,
            lon: station.lon,
            station
        }));
        const ncsId = result.netControl?.checkin.id ?? null;
        const clusters = clusterByPixel(located, item => toCanvas(item));
        for (const cluster of clusters) {
            const group = cluster.items;
            if (group.length === 1) {
                const point = toCanvas(group[0]);
                drawMarker(ctx, group[0].station, point.x, point.y, 'right', group[0].checkin.id === ncsId, options.showLabels);
                continue;
            }
            const spreads = group.map((item, index) => {
                const offset = ringOffset(index, group.length);
                return { item, offset, truePoint: toCanvas(item) };
            });
            for (const { offset, truePoint } of spreads) {
                ctx.beginPath();
                ctx.moveTo(truePoint.x, truePoint.y);
                ctx.lineTo(cluster.x + offset.x, cluster.y + offset.y);
                ctx.strokeStyle = LEADER_COLOR;
                ctx.globalAlpha = 0.8;
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.globalAlpha = 1;
                ctx.beginPath();
                ctx.arc(truePoint.x, truePoint.y, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = LEADER_COLOR;
                ctx.fill();
            }
            for (const { item, offset } of spreads)
                drawMarker(ctx, item.station, cluster.x + offset.x, cluster.y + offset.y, labelDirection(offset), item.checkin.id === ncsId, options.showLabels);
        }
    }

    ctx.fillStyle = 'rgba(15,23,42,0.9)';
    ctx.fillRect(0, 0, PNG_WIDTH, TITLE_BAR_HEIGHT);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f1f5f9';
    ctx.font = `700 26px ${FONT}`;
    const title = netTitle(net);
    ctx.fillText(title, 20, 31);
    if (net) {
        const titleWidth = ctx.measureText(title).width;
        ctx.font = `18px ${FONT}`;
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(formatNetDate(net), 20 + titleWidth + 16, 33);
    }

    drawPanel(ctx, panel);

    ctx.font = `12px ${FONT}`;
    const attribution = '© OpenStreetMap contributors';
    const attributionWidth = ctx.measureText(attribution).width + 12;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(PNG_WIDTH - attributionWidth, PNG_HEIGHT - 20, attributionWidth, 20);
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(attribution, PNG_WIDTH - 6, PNG_HEIGHT - 9);

    const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png');
    });
    if (!blob)
        throw new Error('Could not create PNG image');
    downloadBlob(blob, filename(net, 'png'));
}

// ---------------------------------------------------------------- KML

function xml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function kmlStyle(id: string, color: string, scale: number): string {
    return `    <Style id="${id}">
      <IconStyle>
        <color>${color}</color>
        <scale>${scale}</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>
      </IconStyle>
    </Style>`;
}

function kmlDistanceText(station: CoverageStation): string | null {
    return station.distanceKm === null ? null : `Distance from net control: ${station.distanceKm.toFixed(1)} km`;
}

export function exportCoverageKml(result: CoverageResult, net: CoverageExportNet | null): void {
    const date = net ? formatNetDate(net) : '';
    const description = [
        ...coverageSummaryLines(result),
        `Method: ${methodText(result)}`,
        ...(result.unlocated.length > 0 ? [`No location: ${result.unlocated.join(', ')}`] : [])
    ].join('\n');

    const ncsId = result.netControl?.checkin.id ?? null;
    const placemarks = result.stations.map((station) => {
        const isNcs = station.checkin.id === ncsId;
        const style = isNcs ? 'ncs' : station.precise ? 'precise' : 'approximate';
        const details = [
            ...stationDescription(station),
            `Precision: ${station.checkin.location_precision ?? 'unknown'}`,
            kmlDistanceText(station)
        ].filter((line): line is string => Boolean(line));
        return `    <Placemark>
      <name>${xml(isNcs ? `${station.checkin.callsign} (NCS)` : station.checkin.callsign)}</name>
      <description>${xml(details.join('\n'))}</description>
      <styleUrl>#${style}</styleUrl>
      <Point><coordinates>${station.lon},${station.lat},0</coordinates></Point>
    </Placemark>`;
    });

    const hull = closedHull(result);
    const hullPlacemark = hull
        ? `    <Placemark>
      <name>Coverage area</name>
      <description>${xml(COVERAGE_METHOD_LINES.hull)}</description>
      <styleUrl>#hull</styleUrl>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${hull.map(p => `${p.lon},${p.lat},0`).join(' ')}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>`
        : null;

    const document = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${xml(`${netTitle(net)} coverage${date ? ` (${date})` : ''}`)}</name>
    <description>${xml(description)}</description>
${kmlStyle('ncs', 'ff0b9ef5', 1.3)}
${kmlStyle('precise', 'fff88c81', 1)}
${kmlStyle('approximate', '99f88c81', 0.8)}
    <Style id="hull">
      <LineStyle>
        <color>fff16663</color>
        <width>2</width>
      </LineStyle>
      <PolyStyle>
        <color>26f16663</color>
      </PolyStyle>
    </Style>
${[...(hullPlacemark ? [hullPlacemark] : []), ...placemarks].join('\n')}
  </Document>
</kml>
`;
    downloadBlob(new Blob([document], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8;' }), filename(net, 'kml'));
}

// ---------------------------------------------------------------- GeoJSON

export function exportCoverageGeoJson(result: CoverageResult, net: CoverageExportNet | null): void {
    const ncsId = result.netControl?.checkin.id ?? null;
    const features: object[] = result.stations.map(station => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [station.lon, station.lat] },
        properties: {
            callsign: station.checkin.callsign,
            name: station.checkin.display_name,
            location: station.checkin.location_display,
            location_source: station.checkin.location_source,
            location_precision: station.checkin.location_precision,
            net_control: station.checkin.id === ncsId,
            distance_km: station.distanceKm === null ? null : Math.round(station.distanceKm * 10) / 10,
            in_coverage: station.precise
        }
    }));

    const hull = closedHull(result);
    if (hull) {
        features.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [hull.map(p => [p.lon, p.lat])] },
            properties: { kind: 'coverage_hull', description: COVERAGE_METHOD_LINES.hull }
        });
    }

    const { farthest, netControl } = result;
    const collection = {
        type: 'FeatureCollection',
        metadata: {
            net: net?.topic ?? null,
            date: net ? formatNetDate(net) : null,
            method: methodText(result),
            net_control: netControl ? netControl.checkin.callsign : null,
            net_control_approximate: result.netControlApproximate,
            counts: result.counts,
            farthest: farthest
                ? {
                    callsign: farthest.station.checkin.callsign,
                    distance_km: Math.round(farthest.km * 10) / 10,
                    distance_miles: Math.round(farthest.miles * 10) / 10
                }
                : null,
            unlocated: result.unlocated
        },
        features
    };
    downloadBlob(new Blob([JSON.stringify(collection, null, 2)], { type: 'application/geo+json;charset=utf-8;' }), filename(net, 'geojson'));
}