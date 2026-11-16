import {
    db,
    type MobilityType
} from '../db';
import { upsertStationWithQRZ } from '../stations/mutations';

import { listCheckinsByNet } from './list';
import { getCheckinById } from './single';
import {
    getDisplayNameFromSource,
    getDisplayNameWithSuffixFromSource
} from './stationHelpers';

export interface CheckinMeta {
    prior_checkins: number;
    is_new: boolean;
    last_seen_at: string | null;
    first_seen_at: string | null;
}

export type CheckinRecord = ReturnType<typeof listCheckinsByNet>[number];

function fetchCheckinRecord(id: number, netId: number): CheckinRecord {
    const collection = listCheckinsByNet(netId);
    const record = collection.find(checkin => checkin.id === id);
    if (!record) {
        throw new Error('Failed to load checkin');
    }
    return record;
}

export async function createCheckinWithMeta(
    netId: number,
    userId: number | null,
    data: {
        callsign: string;
        mobility?: MobilityType;
        staying?: boolean;
        topic_answer?: string;
        operator_notes?: string;
        display_name?: string | null;
        preferred_name?: string | null;
        location?: string | null;
    }
): Promise<{ checkin: CheckinRecord; meta: CheckinMeta }> {
    return db.transaction(async () => {
        const normalizedCallsign = data.callsign.toUpperCase();
        const preferredNameInput = data.preferred_name?.trim();
        const preferredName = preferredNameInput === '' ? null : preferredNameInput ?? undefined;
        const locationInput = data.location?.trim();
        const normalizedLocation = locationInput === '' ? null : locationInput ?? undefined;

        const station = await upsertStationWithQRZ(normalizedCallsign, userId, {
            preferred_name: preferredName,
            location: normalizedLocation
        });

        const duplicate = db.prepare<{ id: number }>(`
            SELECT c.id
            FROM checkins c
            JOIN stations s ON c.station_id = s.id
            WHERE s.callsign = ? AND c.net_id = ?
        `).get(normalizedCallsign, netId);

        const displayName = getDisplayNameFromSource(station);
        const displayNameWithSuffix = getDisplayNameWithSuffixFromSource(station);
        const priorCheckinsResult = db.prepare<{ count: number }>(`
            SELECT COUNT(*) as count
            FROM checkins
            WHERE station_id = ? AND net_id != ?
        `).get(station.id, netId);
        const priorCheckins = priorCheckinsResult?.count ?? 0;

        const history = db.prepare<{
            first_seen_at: string | null;
            last_seen_at: string | null;
        }>(`
            SELECT
                MIN(time_entered) as first_seen_at,
                MAX(time_entered) as last_seen_at
            FROM checkins
            WHERE station_id = ? AND net_id != ?
        `).get(station.id, netId);

        const lastSeenAt = history?.last_seen_at ?? null;
        const firstSeenAt = history?.first_seen_at ?? null;

        if (duplicate) {
            const updated = updateCheckinRecord(duplicate.id, {
                mobility: data.mobility,
                staying: data.staying,
                topic_answer: data.topic_answer,
                operator_notes: data.operator_notes,
                display_name: displayName ?? undefined
            });

            return {
                checkin: updated,
                meta: {
                    prior_checkins: priorCheckins,
                    is_new: false,
                    last_seen_at: lastSeenAt,
                    first_seen_at: firstSeenAt
                }
            };
        }

        const result = db.prepare(`
            INSERT INTO checkins (
                net_id,
                station_id,
                callsign,
                display_name,
                time_entered,
                mobility,
                staying,
                called_back,
                topic_answer,
                operator_notes
            ) VALUES (?, ?, ?, ?, datetime('now'), ?, ?, 0, ?, ?)
        `).run(
            netId,
            station.id,
            station.callsign,
            displayNameWithSuffix,
            data.mobility ?? 'neither',
            data.staying ?? false,
            data.topic_answer ?? null,
            data.operator_notes ?? null
        ) as { lastInsertRowid: number | bigint };

        const created = getCheckinById(Number(result.lastInsertRowid));
        if (!created) {
            throw new Error('Failed to retrieve created checkin');
        }

        const record = fetchCheckinRecord(Number(result.lastInsertRowid), netId);

        return {
            checkin: record,
            meta: {
                prior_checkins: priorCheckins,
                is_new: true,
                last_seen_at: lastSeenAt,
                first_seen_at: firstSeenAt
            }
        };
    });
}

export function updateCheckinRecord(
    id: number,
    updates: {
        mobility?: MobilityType;
        staying?: boolean;
        called_back?: boolean;
        topic_answer?: string | null;
        operator_notes?: string | null;
        display_name?: string | null;
    }
): CheckinRecord {
    const existing = getCheckinById(id);
    if (!existing) {
        throw new Error('Checkin not found');
    }

    const fields: string[] = [];
    const values: (string | number | boolean | null)[] = [];

    if (updates.mobility !== undefined) {
        fields.push('mobility = ?');
        values.push(updates.mobility);
    }

    if (updates.staying !== undefined) {
        fields.push('staying = ?');
        values.push(updates.staying ? 1 : 0);
    }

    if (updates.called_back !== undefined) {
        fields.push('called_back = ?');
        values.push(updates.called_back ? 1 : 0);
    }

    if (updates.topic_answer !== undefined) {
        fields.push('topic_answer = ?');
        values.push(updates.topic_answer);
    }

    if (updates.operator_notes !== undefined) {
        fields.push('operator_notes = ?');
        values.push(updates.operator_notes);
    }

    if (updates.display_name !== undefined) {
        fields.push('display_name = ?');
        values.push(updates.display_name);
    }

    if (fields.length > 0) {
        const sql = `
            UPDATE checkins
            SET ${fields.join(', ')}
            WHERE id = ?
        `;
        db.prepare(sql).run(...values, id);
    }

    return fetchCheckinRecord(id, existing.net_id);
}

export function deleteCheckinRecord(id: number): boolean {
    const result = db.prepare('DELETE FROM checkins WHERE id = ?').run(id);
    return result.changes > 0;
}