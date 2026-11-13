import {
    getDisplayNameWithSuffixFromSource,
    getLocationWithSuffixFromSource,
    type StationSource
} from '../checkins/stationHelpers';
import type { Station } from '../db';
import { db } from '../db';

function normalizeCallsignInternal(callsign: string): string {
    return callsign.trim().toUpperCase();
}

export function normalizeCallsign(callsign: string): string {
    return normalizeCallsignInternal(callsign);
}

function toStationSource(station: Station): StationSource {
    return {
        preferred_name: station.preferred_name,
        location: station.location,
        qrz_data: station.qrz_data
    };
}

export function findStationByCallsign(callsign: string): Station | null {
    const normalizedCallsign = normalizeCallsignInternal(callsign);
    const result = db
        .prepare<Station>('SELECT * FROM stations WHERE callsign = ?')
        .get(normalizedCallsign);

    return (result as Station | undefined) ?? null;
}

export interface StationDetail {
    callsign: string;
    preferred_name: string | null;
    location: string | null;
    notes: string | null;
    qrz_data: string | null;
    qrz_last_fetched_at: string | null;
    display_name: string | null;
    location_display: string | null;
}

export function getStationDetail(callsign: string): StationDetail | null {
    const station = findStationByCallsign(callsign);
    if (!station) {
        return null;
    }

    const source = toStationSource(station);

    return {
        callsign: station.callsign,
        preferred_name: station.preferred_name,
        location: station.location,
        notes: station.notes,
        qrz_data: station.qrz_data,
        qrz_last_fetched_at: station.qrz_last_fetched_at,
        display_name: getDisplayNameWithSuffixFromSource(source),
        location_display: getLocationWithSuffixFromSource(source)
    };
}