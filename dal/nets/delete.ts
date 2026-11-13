import type { Net } from '../db';
import { db } from '../db';

const SELECT_NET_SQL = `
    SELECT
        id,
        started_at,
        ended_at,
        formal_ended_at,
        topic,
        created_at
    FROM nets
    WHERE id = ?
`;

const DELETE_CHECKINS_SQL = 'DELETE FROM checkins WHERE net_id = ?';
const DELETE_NET_SQL = 'DELETE FROM nets WHERE id = ?';

export function findNetById(id: number): Net | null {
    const net = db.prepare<Net>(SELECT_NET_SQL).get(id);
    return net ?? null;
}

export function removeNet(id: number): boolean {
    return db.transaction(() => {
        const net = findNetById(id);
        if (!net) {
            return false;
        }

        db.prepare(DELETE_CHECKINS_SQL).run(id);

        const result = db.prepare(DELETE_NET_SQL).run(id);
        return result.changes > 0;
    });
}