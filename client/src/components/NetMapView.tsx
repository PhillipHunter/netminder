import {
    useEffect,
    useMemo,
    useState
} from 'react';
import { FaDownload } from 'react-icons/fa';

import type {
    Checkin,
    Net
} from '../api';
import { useAppConfig } from '../contexts/AppConfigContext';
import { computeCoverage } from '../utils/coverage';
import {
    exportCoverageGeoJson,
    exportCoverageKml,
    exportCoveragePng
} from '../utils/coverageExport';

import { CheckinMap } from './CheckinMap';
import {
    MAP_THEMES,
    type MapTheme
} from './mapShared';

interface NetMapViewProps {
    checkins: Checkin[];
    net?: Pick<Net, 'topic' | 'started_at' | 'created_at'> | null;
}

const RADAR_STORAGE_KEY = 'netminder.map.radar';
const PINS_STORAGE_KEY = 'netminder.map.pins';
const COVERAGE_STORAGE_KEY = 'netminder.map.coverage';
const DARK_STORAGE_KEY = 'netminder.map.dark';
const THEME_STORAGE_KEY = 'netminder.map.theme';

function readRadarPreference(): boolean {
    try {
        return localStorage.getItem(RADAR_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

function readPinsPreference(): boolean {
    try {
        return localStorage.getItem(PINS_STORAGE_KEY) !== '0';
    } catch {
        return true;
    }
}

function readThemePreference(): MapTheme {
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        const known = MAP_THEMES.find(theme => theme.id === stored);
        if (known)
            return known.id;
        if (localStorage.getItem(DARK_STORAGE_KEY) === '0')
            return 'light';
    } catch {
        // Preference is optional; ignore storage failures
    }
    return 'inverted';
}

function readCoveragePreference(): boolean {
    try {
        return localStorage.getItem(COVERAGE_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

const EXPORT_BUTTON_CLASS = 'flex items-center gap-1.5 rounded-lg border border-slate-700/70 px-2.5 py-1 text-xs text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50';

export function NetMapView({ checkins, net = null }: NetMapViewProps) {
    const { cartoApiKey } = useAppConfig();
    const [radarEnabled, setRadarEnabled] = useState<boolean>(readRadarPreference);
    const [pinsEnabled, setPinsEnabled] = useState<boolean>(readPinsPreference);
    const [coverageEnabled, setCoverageEnabled] = useState<boolean>(readCoveragePreference);
    const [mapTheme, setMapTheme] = useState<MapTheme>(readThemePreference);
    const effectiveTheme: MapTheme = mapTheme === 'dark-matter' && !cartoApiKey ? 'inverted' : mapTheme;
    const [netControlId, setNetControlId] = useState<number | null>(null);
    const [showHull, setShowHull] = useState(true);
    const [showHeat, setShowHeat] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);

    useEffect(() => {
        try {
            localStorage.setItem(RADAR_STORAGE_KEY, radarEnabled ? '1' : '0');
        } catch {
            // Preference is optional; ignore storage failures
        }
    }, [radarEnabled]);

    useEffect(() => {
        try {
            localStorage.setItem(PINS_STORAGE_KEY, pinsEnabled ? '1' : '0');
        } catch {
            // Preference is optional; ignore storage failures
        }
    }, [pinsEnabled]);

    useEffect(() => {
        try {
            localStorage.setItem(COVERAGE_STORAGE_KEY, coverageEnabled ? '1' : '0');
        } catch {
            // Preference is optional; ignore storage failures
        }
    }, [coverageEnabled]);

    useEffect(() => {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, mapTheme);
        } catch {
            // Preference is optional; ignore storage failures
        }
    }, [mapTheme]);

    const result = useMemo(() => computeCoverage(checkins, netControlId), [checkins, netControlId]);
    const locatedStations = useMemo(
        () => [...result.stations].sort((a, b) => a.checkin.callsign.localeCompare(b.checkin.callsign)),
        [result]
    );

    async function handlePngExport() {
        setExporting(true);
        setExportError(null);
        try {
            await exportCoveragePng(result, net, { showHull, showHeat, showPins: pinsEnabled, theme: effectiveTheme, cartoKey: cartoApiKey });
        } catch (error) {
            console.error('Error exporting coverage PNG:', error);
            setExportError('PNG export failed');
        } finally {
            setExporting(false);
        }
    }

    const unlocated = checkins.filter(c => c.latitude === null || c.longitude === null);

    return (
        <div className='flex h-full min-h-0 flex-col'>
            <div className='flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-700/50 bg-slate-900/60 px-4 py-2 text-sm'>
                <label className='flex cursor-pointer items-center gap-2 text-slate-300'>
                    <input
                        type='checkbox'
                        checked={radarEnabled}
                        onChange={(e) => {
                            setRadarEnabled(e.target.checked);
                        }}
                        className='h-4 w-4 accent-indigo-500'
                    />
                    Radar
                </label>
                <label className='flex cursor-pointer items-center gap-2 text-slate-300'>
                    <input
                        type='checkbox'
                        checked={pinsEnabled}
                        onChange={(e) => {
                            setPinsEnabled(e.target.checked);
                        }}
                        className='h-4 w-4 accent-indigo-500'
                    />
                    Pins
                </label>
                <label className='flex cursor-pointer items-center gap-2 text-slate-300'>
                    <input
                        type='checkbox'
                        checked={coverageEnabled}
                        onChange={(e) => {
                            setCoverageEnabled(e.target.checked);
                        }}
                        className='h-4 w-4 accent-indigo-500'
                    />
                    Coverage
                </label>
                <span className='text-xs text-slate-400'>
                    Locations come from QRZ registrations, not live positions; dashed markers are approximate
                </span>
            </div>
            {coverageEnabled && (
                <div className='flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-700/50 bg-slate-900/40 px-4 py-2 text-sm'>
                    <label className='flex items-center gap-2 text-slate-300'>
                        Net control
                        <select
                            value={result.netControl?.checkin.id ?? ''}
                            disabled={locatedStations.length === 0}
                            onChange={(e) => {
                                setNetControlId(Number(e.target.value));
                            }}
                            className='rounded-lg border border-slate-700/70 bg-slate-800 px-2 py-1 text-xs text-slate-200'
                        >
                            {locatedStations.map(station => (
                                <option key={station.checkin.id} value={station.checkin.id}>
                                    {station.checkin.callsign}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className='flex cursor-pointer items-center gap-2 text-slate-300'>
                        <input
                            type='checkbox'
                            checked={showHull}
                            onChange={(e) => {
                                setShowHull(e.target.checked);
                            }}
                            className='h-4 w-4 accent-indigo-500'
                        />
                        Hull
                    </label>
                    <label className='flex cursor-pointer items-center gap-2 text-slate-300'>
                        <input
                            type='checkbox'
                            checked={showHeat}
                            onChange={(e) => {
                                setShowHeat(e.target.checked);
                            }}
                            className='h-4 w-4 accent-indigo-500'
                        />
                        Heatmap
                    </label>
                    <div className='flex items-center gap-2'>
                        <button
                            type='button'
                            disabled={exporting || locatedStations.length === 0}
                            onClick={() => void handlePngExport()}
                            className={EXPORT_BUTTON_CLASS}
                        >
                            <FaDownload />
                            {exporting ? 'Rendering...' : 'PNG'}
                        </button>
                        <button
                            type='button'
                            disabled={locatedStations.length === 0}
                            onClick={() => {
                                exportCoverageKml(result, net);
                            }}
                            className={EXPORT_BUTTON_CLASS}
                        >
                            <FaDownload />
                            KML
                        </button>
                        <button
                            type='button'
                            disabled={locatedStations.length === 0}
                            onClick={() => {
                                exportCoverageGeoJson(result, net);
                            }}
                            className={EXPORT_BUTTON_CLASS}
                        >
                            <FaDownload />
                            GeoJSON
                        </button>
                    </div>
                    {exportError && <span className='text-xs text-red-400'>{exportError}</span>}
                </div>
            )}
            <div className='min-h-0 flex-1'>
                <CheckinMap
                    checkins={checkins}
                    radarEnabled={radarEnabled}
                    showPins={pinsEnabled}
                    mapTheme={effectiveTheme}
                    cartoKey={cartoApiKey}
                    onThemeChange={setMapTheme}
                    coverage={coverageEnabled ? { result, net, showHull, showHeat } : undefined}
                />
            </div>
            {unlocated.length > 0 && (
                <div className='border-t border-slate-700/50 bg-slate-900/60 px-4 py-2 text-xs text-slate-400'>
                    <span className='font-semibold text-slate-300'>
                        No location (
                        {unlocated.length}
                        ):
                    </span>
                    {' '}
                    {unlocated.map(c => c.callsign).join(', ')}
                </div>
            )}
        </div>
    );
}