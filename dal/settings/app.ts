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

const CARTO_API_KEY_KEY = 'carto_api_key';

let deleteStmt: TypedStatement | null = null;

export function getCartoApiKey(): string | null {
    const { select } = requireStatements();
    const setting = select.get(CARTO_API_KEY_KEY) as Setting | undefined;
    return setting?.value ?? null;
}

export function setCartoApiKey(key: string | null): void {
    const { upsert } = requireStatements();
    if (key === null || key === '') {
        deleteStmt ??= db.prepare('DELETE FROM settings WHERE key = ?');
        deleteStmt.run(CARTO_API_KEY_KEY);
        return;
    }
    upsert.run(CARTO_API_KEY_KEY, key);
}