import {
    isQRZConfigured,
    lookupCallsign,
    shouldRefreshQRZ
} from '@netminder/core';

import type { Station } from '../db';
import { db } from '../db';

import {
    findStationByCallsign,
    normalizeCallsign
} from './get';

export interface StationMutationInput {
    preferred_name?: string | null;
    location?: string | null;
    notes?: string | null;
    qrz_data?: string | null;
    qrz_last_fetched_at?: string | null;
}

export function createOrUpdateStationRecord(
    callsign: string,
    data: StationMutationInput
): Station {
    const normalizedCallsign = normalizeCallsign(callsign);
    const now = new Date().toISOString();
    const existing = findStationByCallsign(normalizedCallsign);

    if (existing) {
        const updates: string[] = [];
        const values: (string | null | number)[] = [];

        if (data.preferred_name !== undefined) {
            updates.push('preferred_name = ?');
            values.push(data.preferred_name);
        }

        if (data.location !== undefined) {
            updates.push('location = ?');
            values.push(data.location);
        }

        if (data.notes !== undefined) {
            updates.push('notes = ?');
            values.push(data.notes);
        }

        if (data.qrz_data !== undefined) {
            updates.push('qrz_data = ?');
            values.push(data.qrz_data);
        }

        if (data.qrz_last_fetched_at !== undefined) {
            updates.push('qrz_last_fetched_at = ?');
            values.push(data.qrz_last_fetched_at);
        }

        updates.push('updated_at = ?');
        values.push(now);
        values.push(normalizedCallsign);

        db.prepare(`UPDATE stations SET ${updates.join(', ')} WHERE callsign = ?`).run(...values);

        const updated = findStationByCallsign(normalizedCallsign);
        if (!updated) {
            throw new Error(`Failed to retrieve updated station: ${normalizedCallsign}`);
        }

        return updated;
    }

    const stmt = db.prepare(`
        INSERT INTO stations (
            callsign,
            preferred_name,
            location,
            notes,
            qrz_data,
            qrz_last_fetched_at,
            created_at,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        normalizedCallsign,
        data.preferred_name ?? null,
        data.location ?? null,
        data.notes ?? null,
        data.qrz_data ?? null,
        data.qrz_last_fetched_at ?? null,
        now,
        now
    );

    const created = findStationByCallsign(normalizedCallsign);
    if (!created) {
        throw new Error(`Failed to retrieve created station: ${normalizedCallsign}`);
    }

    return created;
}

export function updateStationProfile(
    callsign: string,
    updates: Pick<StationMutationInput, 'preferred_name' | 'location' | 'notes'>
): Station | null {
    const hasUpdates = (
        updates.preferred_name !== undefined
        || updates.location !== undefined
        || updates.notes !== undefined
    );

    if (!hasUpdates) {
        return findStationByCallsign(callsign);
    }

    return createOrUpdateStationRecord(callsign, updates);
}

interface FetchQrzResult {
    qrz_data: string | null;
    qrz_last_fetched_at: string | null;
}

async function fetchAndCacheQRZ(callsign: string, userId: number | null): Promise<FetchQrzResult> {
    if (!isQRZConfigured(userId)) {
        return {
            qrz_data: null,
            qrz_last_fetched_at: null
        };
    }

    try {
        const qrzResult = await lookupCallsign(callsign, userId);
        if (!qrzResult) {
            return {
                qrz_data: null,
                qrz_last_fetched_at: null
            };
        }

        return {
            qrz_data: JSON.stringify(qrzResult),
            qrz_last_fetched_at: new Date().toISOString()
        };
    } catch (error) {
        console.error(`QRZ lookup failed for ${callsign}:`, error);
        return {
            qrz_data: null,
            qrz_last_fetched_at: null
        };
    }
}

export async function upsertStationWithQRZ(
    callsign: string,
    userId: number | null,
    options?: {
        preferred_name?: string | null;
        location?: string | null;
        notes?: string | null;
        skipQRZ?: boolean;
    }
): Promise<Station> {
    const normalizedCallsign = normalizeCallsign(callsign);
    const existing = findStationByCallsign(normalizedCallsign);

    const shouldAttemptFetch = !options?.skipQRZ
        && isQRZConfigured(userId)
        && (
            !existing
            || shouldRefreshQRZ(existing.qrz_last_fetched_at ?? null)
        );

    let qrzData = existing?.qrz_data ?? null;
    let qrzLastFetchedAt = existing?.qrz_last_fetched_at ?? null;

    if (shouldAttemptFetch) {
        const result = await fetchAndCacheQRZ(normalizedCallsign, userId);
        qrzData = result.qrz_data;
        qrzLastFetchedAt = result.qrz_last_fetched_at;
    }

    return createOrUpdateStationRecord(normalizedCallsign, {
        preferred_name: options?.preferred_name,
        location: options?.location,
        notes: options?.notes,
        qrz_data: qrzData,
        qrz_last_fetched_at: qrzLastFetchedAt
    });
}

export type RenameStationResult =
    | { status: 'not_found' }
    | { status: 'conflict'; conflictingCallsign: string }
    | { status: 'success'; station: Station };

export async function renameStation(currentCallsign: string, nextCallsign: string, userId: number | null): Promise<RenameStationResult> {
    const normalizedCurrent = normalizeCallsign(currentCallsign);
    const normalizedNext = normalizeCallsign(nextCallsign);

    if (normalizedCurrent === normalizedNext) {
        const existing = findStationByCallsign(normalizedCurrent);
        return existing
            ? { status: 'success', station: existing }
            : { status: 'not_found' };
    }

    const existingStation = findStationByCallsign(normalizedCurrent);
    if (!existingStation) {
        return { status: 'not_found' };
    }

    const conflict = findStationByCallsign(normalizedNext);
    if (conflict) {
        return {
            status: 'conflict',
            conflictingCallsign: normalizedNext
        };
    }

    const updatedStation = await db.transaction(async () => {
        const now = new Date().toISOString();

        db.prepare('UPDATE stations SET callsign = ?, updated_at = ? WHERE id = ?').run(
            normalizedNext,
            now,
            existingStation.id
        );

        db.prepare('UPDATE checkins SET callsign = ? WHERE station_id = ?').run(
            normalizedNext,
            existingStation.id
        );

        return upsertStationWithQRZ(normalizedNext, userId);
    });
    return {
        status: 'success',
        station: updatedStation
    };
}

export async function refreshStationQRZ(callsign: string, userId: number | null): Promise<Station | null> {
    const existing = findStationByCallsign(callsign);
    if (!existing) {
        return null;
    }

    const { qrz_data, qrz_last_fetched_at } = await fetchAndCacheQRZ(existing.callsign, userId);

    return createOrUpdateStationRecord(existing.callsign, {
        qrz_data,
        qrz_last_fetched_at
    });
}

export function deleteStationRecord(callsign: string): boolean {
    const existing = findStationByCallsign(callsign);
    if (!existing) {
        return false;
    }

    return db.transaction(() => {
        db.prepare('DELETE FROM checkins WHERE station_id = ?').run(existing.id);
        const result = db.prepare('DELETE FROM stations WHERE id = ?').run(existing.id);
        return result.changes > 0;
    });
}