import {
    db,
    type Setting,
    type TypedStatement
} from '../db';

const MOBILITY_ENABLED_KEY = 'mobility_enabled';

let selectStmt: TypedStatement<Setting> | null = null;
let upsertStmt: TypedStatement | null = null;

function requireStatements(): { select: TypedStatement<Setting>; upsert: TypedStatement } {
    selectStmt ??= db.prepare<Setting>(`
        SELECT key, value, created_at, updated_at
        FROM settings
        WHERE key = ?
    `);

    upsertStmt ??= db.prepare(`
        INSERT INTO settings (key, value, created_at, updated_at)
        VALUES (?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = datetime('now')
    `);

    return {
        select: selectStmt,
        upsert: upsertStmt
    };
}

export function getMobilityEnabled(): boolean {
    const { select } = requireStatements();
    const setting = select.get(MOBILITY_ENABLED_KEY) as Setting | undefined;
    return setting?.value !== 'false';
}

export function setMobilityEnabled(enabled: boolean): void {
    const { upsert } = requireStatements();
    upsert.run(MOBILITY_ENABLED_KEY, enabled ? 'true' : 'false');
}