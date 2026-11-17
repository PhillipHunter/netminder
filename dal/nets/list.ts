import type { Net } from '../db';
import { db } from '../db';

import { NET_VISIBLE_SQL } from './access';

export interface NetCountsRow {
    total: number;
    staying: number;
    in_and_out: number;
    mobile: number;
    portable: number;
    neither: number;
}

export interface NetRow extends Net {
    counts: NetCountsRow;
}

interface NetCountResult {
    count: number;
}

const LIST_NETS_SQL = `
    SELECT
      n.id,
      n.started_at,
      n.ended_at,
      n.formal_ended_at,
      n.topic,
      n.created_at,
      n.created_by,
      n.shared
    FROM nets n
    WHERE ${NET_VISIBLE_SQL}
    ORDER BY COALESCE(n.started_at, n.created_at) DESC, n.id DESC
    LIMIT ? OFFSET ?
`;

/**
 * Aggregates the mobility and attendance counters we surface alongside each net. The
 * COALESCE calls clamp null sums so downstream consumers always receive zeroed buckets.
 */
const NET_COUNTS_SQL = `
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN staying = 1 THEN 1 ELSE 0 END), 0) as staying,
      COALESCE(SUM(CASE WHEN staying = 0 THEN 1 ELSE 0 END), 0) as in_and_out,
      COALESCE(SUM(CASE WHEN mobility = 'mobile' THEN 1 ELSE 0 END), 0) as mobile,
      COALESCE(SUM(CASE WHEN mobility = 'portable' THEN 1 ELSE 0 END), 0) as portable,
      COALESCE(SUM(CASE WHEN mobility = 'neither' THEN 1 ELSE 0 END), 0) as neither
    FROM checkins
    WHERE net_id = ?
`;

const NET_TOTAL_SQL = `SELECT COUNT(*) as count FROM nets n WHERE ${NET_VISIBLE_SQL}`;

/**
 * Returns the per-net attendance breakdown used by the UI pagination view. Missing
 * nets (e.g., when a net was deleted mid-refresh) resolve to a zeroed structure so
 * callers can safely destructure without defensive null checks.
 */
function selectNetCounts(netId: number): NetCountsRow {
    const counts = db.prepare<NetCountsRow>(NET_COUNTS_SQL).get(netId);

    if (!counts) {
        return {
            total: 0,
            staying: 0,
            in_and_out: 0,
            mobile: 0,
            portable: 0,
            neither: 0
        };
    }

    return counts;
}

/**
 * Loads a page of nets ordered by newest first and augments each row with its mobility
 * counters. The counts call remains per-row for now so cached statements (see cleanup
 * item #3) can hoist naturally once implemented.
 */
export function listNets(userId: number, limit: number, offset: number): NetRow[] {
    const nets = db.prepare<Net>(LIST_NETS_SQL).all(userId, limit, offset);
    return nets.map(net => ({
        ...net,
        counts: selectNetCounts(net.id)
    }));
}

/**
 * Gives the total number of nets for pagination. The nullable guard preserves backwards
 * compatibility in case the query returns no rows during bootstrapping.
 */
export function countNets(userId: number): number {
    const result = db.prepare<NetCountResult>(NET_TOTAL_SQL).get(userId);
    return result?.count ?? 0;
}