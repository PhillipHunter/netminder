import { db } from '../db';

import type { StationSource } from './stationHelpers';
import {
    getDisplayNameWithSuffixFromSource,
    getLocationWithSuffixFromSource
} from './stationHelpers';

export interface CheckinRow {
    id: number;
    net_id: number;
    station_id: number;
    callsign: string;
    display_name: string | null;
    location_display: string | null;
    time_entered: string;
    mobility: string;
    staying: boolean;
    called_back: boolean;
    topic_answer: string | null;
    operator_notes: string | null;
}

interface JoinedCheckinRow {
    id: number;
    net_id: number;
    station_id: number;
    callsign: string;
    display_name: string | null;
    time_entered: string;
    mobility: string;
    staying: number;
    called_back: number;
    topic_answer: string | null;
    operator_notes: string | null;
    station_preferred_name: string | null;
    station_location: string | null;
    station_qrz_data: string | null;
}

function mapRow(row: JoinedCheckinRow): CheckinRow {
    const stationSource: StationSource = {
        preferred_name: row.station_preferred_name,
        location: row.station_location,
        qrz_data: row.station_qrz_data
    };

    return {
        id: row.id,
        net_id: row.net_id,
        station_id: row.station_id,
        callsign: row.callsign,
        display_name: getDisplayNameWithSuffixFromSource(stationSource),
        location_display: getLocationWithSuffixFromSource(stationSource),
        time_entered: row.time_entered,
        mobility: row.mobility,
        staying: row.staying === 1,
        called_back: row.called_back === 1,
        topic_answer: row.topic_answer,
        operator_notes: row.operator_notes
    };
}

export function listCheckinsByNet(netId: number): CheckinRow[] {
    const rows = db.prepare<JoinedCheckinRow>(`
        SELECT
            c.*,
            s.preferred_name AS station_preferred_name,
            s.location AS station_location,
            s.qrz_data AS station_qrz_data
        FROM checkins c
        LEFT JOIN stations s ON c.station_id = s.id
        WHERE c.net_id = ?
        ORDER BY c.time_entered DESC
    `).all(netId);

    return rows.map(mapRow);
}