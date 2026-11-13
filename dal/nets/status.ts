import type { Net } from '../db';
import { db } from '../db';

import { findNetById } from './delete';

interface NetStatusUpdate {
    started_at?: string | null;
    ended_at?: string | null;
    formal_ended_at?: string | null;
}

function updateNetTimestamps(id: number, updates: NetStatusUpdate): Net | null {
    const assignments: string[] = [];
    const values: (string | null | number)[] = [];

    if (updates.started_at !== undefined) {
        assignments.push('started_at = ?');
        values.push(updates.started_at);
    }

    if (updates.ended_at !== undefined) {
        assignments.push('ended_at = ?');
        values.push(updates.ended_at);
    }

    if (updates.formal_ended_at !== undefined) {
        assignments.push('formal_ended_at = ?');
        values.push(updates.formal_ended_at);
    }

    if (assignments.length === 0) {
        return findNetById(id);
    }

    values.push(id);

    const sql = `
        UPDATE nets
        SET ${assignments.join(', ')}
        WHERE id = ?
    `;

    db.prepare(sql).run(...values);
    return findNetById(id);
}

export function markNetEnded(id: number): Net | null {
    const net = findNetById(id);
    if (!net) {
        return null;
    }

    if (net.ended_at && net.formal_ended_at) {
        return net;
    }

    const timestamp = net.ended_at ?? new Date().toISOString();

    const updates: NetStatusUpdate = {};

    if (!net.ended_at) {
        updates.ended_at = timestamp;
    }

    if (!net.formal_ended_at) {
        updates.formal_ended_at = timestamp;
    }

    return updateNetTimestamps(id, updates);
}

export function markNetStarted(id: number): Net | null {
    const net = findNetById(id);
    if (!net) {
        return null;
    }

    if (net.started_at !== null) {
        return null;
    }

    return updateNetTimestamps(id, {
        started_at: new Date().toISOString(),
        ended_at: null,
        formal_ended_at: null
    });
}

export function clearNetEnd(id: number): Net | null {
    const net = findNetById(id);
    if (!net) {
        return null;
    }

    if (net.ended_at === null) {
        return net;
    }

    return updateNetTimestamps(id, { ended_at: null });
}

export function markNetFormalEnded(id: number): Net | null {
    const net = findNetById(id);
    if (!net) {
        return null;
    }

    if (net.formal_ended_at) {
        return net;
    }

    return updateNetTimestamps(id, { formal_ended_at: new Date().toISOString() });
}

export function clearNetFormalEnd(id: number): Net | null {
    const net = findNetById(id);
    if (!net) {
        return null;
    }

    if (net.formal_ended_at === null) {
        return net;
    }

    return updateNetTimestamps(id, { formal_ended_at: null });
}