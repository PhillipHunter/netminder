import {
    getDisplayNameWithSuffixFromSource,
    getLocationWithSuffixFromSource
} from '../checkins/stationHelpers';
import { db } from '../db';

export interface StationListRow {
    callsign: string;
    preferred_name: string | null;
    location: string | null;
    display_name: string | null;
    location_display: string | null;
    first_seen_at: string | null;
    last_seen_at: string | null;
    total_checkins: number;
}

interface StationSummaryRow {
    callsign: string;
    preferred_name: string | null;
    location: string | null;
    qrz_data: string | null;
    first_seen_at: string | null;
    last_seen_at: string | null;
    total_checkins: number;
}

interface StationCountRow {
    count: number;
}

const LIST_STATIONS_SQL = `
    SELECT
        s.callsign,
        s.preferred_name,
        s.location,
        s.qrz_data,
        MIN(c.time_entered) as first_seen_at,
        MAX(c.time_entered) as last_seen_at,
        COALESCE(COUNT(c.id), 0) as total_checkins
    FROM stations s
    LEFT JOIN checkins c ON s.id = c.station_id
    GROUP BY s.id, s.callsign, s.preferred_name, s.location, s.qrz_data
    ORDER BY s.callsign ASC
    LIMIT ? OFFSET ?
`;

const SEARCH_STATIONS_SQL = `
    SELECT
        s.callsign,
        s.preferred_name,
        s.location,
        s.qrz_data,
        MIN(c.time_entered) as first_seen_at,
        MAX(c.time_entered) as last_seen_at,
        COALESCE(COUNT(c.id), 0) as total_checkins
    FROM stations s
    LEFT JOIN checkins c ON s.id = c.station_id
    WHERE s.callsign LIKE ?
        OR (s.preferred_name IS NOT NULL AND LOWER(s.preferred_name) LIKE ?)
    GROUP BY s.id, s.callsign, s.preferred_name, s.location, s.qrz_data
    ORDER BY s.callsign ASC
    LIMIT ? OFFSET ?
`;

const COUNT_STATIONS_SQL = 'SELECT COUNT(*) as count FROM stations';

const COUNT_SEARCH_STATIONS_SQL = `
    SELECT COUNT(*) as count
    FROM stations
    WHERE callsign LIKE ?
        OR (preferred_name IS NOT NULL AND LOWER(preferred_name) LIKE ?)
`;

function mapStationRow(row: StationSummaryRow): StationListRow {
    const source = {
        preferred_name: row.preferred_name,
        location: row.location,
        qrz_data: row.qrz_data
    };

    return {
        callsign: row.callsign,
        preferred_name: row.preferred_name,
        location: row.location,
        display_name: getDisplayNameWithSuffixFromSource(source),
        location_display: getLocationWithSuffixFromSource(source),
        first_seen_at: row.first_seen_at,
        last_seen_at: row.last_seen_at,
        total_checkins: row.total_checkins
    };
}

export function listStations(limit: number, offset: number): StationListRow[] {
    const rows = db.prepare<StationSummaryRow>(LIST_STATIONS_SQL).all(limit, offset);
    return rows.map(mapStationRow);
}

export function searchStations(query: string, limit: number, offset: number): StationListRow[] {
    const normalizedCallsign = query.toUpperCase();
    const callsignPattern = `${normalizedCallsign}%`;
    const namePattern = `%${query.toLowerCase()}%`;

    const rows = db
        .prepare<StationSummaryRow>(SEARCH_STATIONS_SQL)
        .all(callsignPattern, namePattern, limit, offset);
    return rows.map(mapStationRow);
}

export function countStations(query?: string): number {
    if (!query) {
        const row = db.prepare<StationCountRow>(COUNT_STATIONS_SQL).get();
        return row?.count ?? 0;
    }

    const normalizedCallsign = query.toUpperCase();
    const callsignPattern = `${normalizedCallsign}%`;
    const namePattern = `%${query.toLowerCase()}%`;

    const row = db
        .prepare<StationCountRow>(COUNT_SEARCH_STATIONS_SQL)
        .get(callsignPattern, namePattern);

    return row?.count ?? 0;
}