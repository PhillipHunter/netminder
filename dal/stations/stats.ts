import { isQRZConfigured } from '@netminder/core';

import {
    getDisplayNameWithSuffixFromSource,
    getLocationWithSuffixFromSource
} from '../checkins/stationHelpers';
import { db } from '../db';
import { NET_VISIBLE_SQL } from '../nets/access';

import { findStationByCallsign } from './get';

interface StationStatsAggregateRow {
    first_seen_at: string | null;
    last_seen_at: string | null;
    total_checkins: number | null;
}

interface StationRecentCheckinRow {
    checkin_id: number;
    net_id: number;
    time_entered: string;
    mobility: string;
    staying: number;
    topic_answer: string | null;
}

export interface StationStatsSummary {
    callsign: string;
    preferred_name: string | null;
    location: string | null;
    display_name: string | null;
    location_display: string | null;
    first_seen_at: string | null;
    last_seen_at: string | null;
    total_checkins: number;
    qrz_enabled: boolean;
    recent: {
        checkin_id: number;
        net_id: number;
        time_entered: string;
        mobility: string;
        staying: boolean;
        topic_answer: string | null;
    }[];
}

export function getStationStats(callsign: string, userId: number): StationStatsSummary | null {
    const station = findStationByCallsign(callsign);
    if (!station) {
        return null;
    }

    const stats = db.prepare<StationStatsAggregateRow>(`
        SELECT
            MIN(c.time_entered) as first_seen_at,
            MAX(c.time_entered) as last_seen_at,
            COUNT(c.id) as total_checkins
        FROM checkins c
        JOIN nets n ON n.id = c.net_id
        WHERE c.station_id = ?
          AND ${NET_VISIBLE_SQL}
    `).get(station.id, userId);

    const recentRows = db.prepare<StationRecentCheckinRow>(`
        SELECT
            c.id as checkin_id,
            c.net_id,
            c.time_entered,
            c.mobility,
            c.staying,
            c.topic_answer
        FROM checkins c
        JOIN nets n ON n.id = c.net_id
        WHERE c.station_id = ?
          AND ${NET_VISIBLE_SQL}
        ORDER BY c.time_entered DESC
        LIMIT 10
    `).all(station.id, userId);

    const source = {
        preferred_name: station.preferred_name,
        location: station.location,
        qrz_data: station.qrz_data
    };

    return {
        callsign: station.callsign,
        preferred_name: station.preferred_name ?? null,
        location: station.location ?? null,
        display_name: getDisplayNameWithSuffixFromSource(source),
        location_display: getLocationWithSuffixFromSource(source),
        first_seen_at: stats?.first_seen_at ?? null,
        last_seen_at: stats?.last_seen_at ?? null,
        total_checkins: stats?.total_checkins ?? 0,
        qrz_enabled: isQRZConfigured(),
        recent: recentRows.map(row => ({
            checkin_id: row.checkin_id,
            net_id: row.net_id,
            time_entered: row.time_entered,
            mobility: row.mobility,
            staying: Boolean(row.staying),
            topic_answer: row.topic_answer
        }))
    };
}