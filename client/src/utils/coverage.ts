import type { Checkin } from '../api';

import {
    convexHull,
    distanceKm,
    isPrecise,
    type LatLon
} from './geo';

export interface CoverageStation {
    checkin: Checkin;
    lat: number;
    lon: number;
    precise: boolean;
    distanceKm: number | null;
}

export interface CoverageResult {
    stations: CoverageStation[];
    netControl: CoverageStation | null;
    netControlApproximate: boolean;
    hull: LatLon[] | null;
    heatPoints: LatLon[];
    farthest: { station: CoverageStation; km: number; miles: number } | null;
    counts: { total: number; located: number; precise: number; approximate: number };
    unlocated: string[];
}

const KM_TO_MILES = 0.621371;

export const COVERAGE_METHOD_LINES = {
    hull: 'Coverage area: outline around address-level positions, including net control',
    heat: 'Heatmap: density of address-level check-ins',
    approximate: 'Dashed markers are approximate and not counted'
};

export function computeCoverage(checkins: Checkin[], netControlId: number | null): CoverageResult {
    const stations: CoverageStation[] = [];
    const unlocated: string[] = [];
    for (const checkin of checkins) {
        if (checkin.latitude === null || checkin.longitude === null) {
            unlocated.push(checkin.callsign);
            continue;
        }
        stations.push({
            checkin,
            lat: checkin.latitude,
            lon: checkin.longitude,
            precise: isPrecise(checkin),
            distanceKm: null
        });
    }

    let netControl: CoverageStation | null = stations.find(s => s.checkin.id === netControlId) ?? null;
    if (!netControl) {
        for (const station of stations) {
            if (!netControl || Date.parse(station.checkin.time_entered) < Date.parse(netControl.checkin.time_entered))
                netControl = station;
        }
    }

    if (netControl) {
        for (const station of stations)
            station.distanceKm = distanceKm(netControl, station);
    }

    const preciseStations = stations.filter(s => s.precise);
    const heatPoints = preciseStations.map(s => ({ lat: s.lat, lon: s.lon }));
    const hull = preciseStations.length >= 3 ? convexHull(heatPoints) : null;

    let farthest: CoverageResult['farthest'] = null;
    for (const station of preciseStations) {
        if (station === netControl || station.distanceKm === null)
            continue;
        if (!farthest || station.distanceKm > farthest.km) {
            farthest = {
                station,
                km: station.distanceKm,
                miles: station.distanceKm * KM_TO_MILES
            };
        }
    }

    return {
        stations,
        netControl,
        netControlApproximate: netControl !== null && !netControl.precise,
        hull: hull && hull.length >= 3 ? hull : null,
        heatPoints,
        farthest,
        counts: {
            total: checkins.length,
            located: stations.length,
            precise: preciseStations.length,
            approximate: stations.length - preciseStations.length
        },
        unlocated
    };
}

export function coverageSummaryLines(result: CoverageResult): string[] {
    const { counts, farthest, netControl } = result;
    const lines = [
        `Check-ins: ${counts.total} (${counts.located} located, ${counts.precise} address-level)`
    ];
    if (farthest) {
        lines.push(`Farthest: ${farthest.station.checkin.callsign}, ${farthest.km.toFixed(1)} km (${farthest.miles.toFixed(1)} mi)`);
    } else if (netControl) {
        lines.push('Farthest: none (needs an address-level station besides net control)');
    }
    if (result.netControlApproximate)
        lines.push('Net control position is approximate; distances are estimates');
    return lines;
}