import type { Net } from '../db';
import { db } from '../db';

import { findNetById } from './delete';

export interface NetUpdate {
    topic?: string | null;
    ended_at?: string | null;
    formal_ended_at?: string | null;
    shared?: boolean;
}

export function insertNet(topic: string | null | undefined, createdBy: number, shared: boolean): Net {
    const stmt = db.prepare(`
        INSERT INTO nets (started_at, topic, created_by, shared)
        VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(null, topic ?? null, createdBy, shared ? 1 : 0) as { lastInsertRowid: number | bigint };
    const id = Number(result.lastInsertRowid);
    const net = findNetById(id);

    if (!net) {
        throw new Error('Failed to retrieve created net');
    }

    return net;
}

export function endAllActiveNets(userId: number): void {
    const now = new Date().toISOString();
    db.prepare(`
        UPDATE nets
        SET
            ended_at = ?,
            formal_ended_at = COALESCE(formal_ended_at, ?)
        WHERE ended_at IS NULL
          AND started_at IS NOT NULL
          AND created_by = ?
    `).run(now, now, userId);
}

export function updateNetRecord(id: number, updates: NetUpdate): Net | null {
    const existing = findNetById(id);
    if (!existing) {
        return null;
    }

    const fields: string[] = [];
    const values: (string | null | number)[] = [];

    if (updates.topic !== undefined) {
        fields.push('topic = ?');
        values.push(updates.topic ?? null);
    }

    if (updates.ended_at !== undefined) {
        fields.push('ended_at = ?');
        values.push(updates.ended_at);
    }

    if (updates.formal_ended_at !== undefined) {
        fields.push('formal_ended_at = ?');
        values.push(updates.formal_ended_at);
    }

    if (updates.shared !== undefined) {
        fields.push('shared = ?');
        values.push(updates.shared ? 1 : 0);
    }

    if (fields.length === 0) {
        return existing;
    }

    values.push(id);

    const sql = `
        UPDATE nets
        SET ${fields.join(', ')}
        WHERE id = ?
    `;

    db.prepare(sql).run(...values);
    return findNetById(id);
}