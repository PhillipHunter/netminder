import type { Net } from '../db';
import { db } from '../db';

/**
 * Single source of truth for net visibility: shared nets are visible to everyone, private
 * nets only to their creator. Expects the nets table to be aliased as `n` and binds one
 * parameter (the requesting user's id). Admins get no override.
 */
export const NET_VISIBLE_SQL = '(n.shared = 1 OR n.created_by = ?)';

const SELECT_VISIBLE_NET_SQL = `
    SELECT n.*
    FROM nets n
    WHERE n.id = ?
      AND ${NET_VISIBLE_SQL}
`;

const SELECT_VISIBLE_NET_FOR_CHECKIN_SQL = `
    SELECT n.*
    FROM checkins c
    JOIN nets n ON n.id = c.net_id
    WHERE c.id = ?
      AND ${NET_VISIBLE_SQL}
`;

export function findVisibleNet(id: number, userId: number): Net | null {
    const net = db.prepare<Net>(SELECT_VISIBLE_NET_SQL).get(id, userId);
    return net ?? null;
}

export function findVisibleNetForCheckin(checkinId: number, userId: number): Net | null {
    const net = db.prepare<Net>(SELECT_VISIBLE_NET_FOR_CHECKIN_SQL).get(checkinId, userId);
    return net ?? null;
}