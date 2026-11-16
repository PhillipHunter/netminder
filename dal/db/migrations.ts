import type { TypedDatabase } from './wrapper';

interface Migration {
    id: string;
    name: string;
    /**
     * If provided, runs before the transaction begins. Returning a cleanup function
     * allows migrations to temporarily tweak connection-level settings (e.g., PRAGMA)
     * and reliably restore them after commit/rollback.
     */
    before?(db: TypedDatabase): (() => void) | undefined;
    run(db: TypedDatabase): void;
}

function assertIdentifier(value: string, kind: 'table' | 'column'): void {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
        throw new Error(`Invalid ${kind} identifier: ${value}`);
    }
}

/**
 * SQLite does not allow parameter binding for identifiers, so we proactively validate
 * the names we interpolate. This keeps defensive checks local to the migration module
 * instead of trusting every migration author to remember it.
 */
function tableHasColumn(db: TypedDatabase, table: string, column: string): boolean {
    assertIdentifier(table, 'table');
    assertIdentifier(column, 'column');

    const info = db
        .prepare<{ name: string }>(`PRAGMA table_info(${table})`)
        .all();

    return info.some(field => field.name === column);
}

function getColumnMetadata(
    db: TypedDatabase,
    table: string,
    column: string
): { name: string; notnull: number } | null {
    assertIdentifier(table, 'table');
    assertIdentifier(column, 'column');

    const info = db
        .prepare<{ name: string; notnull: number }>(`PRAGMA table_info(${table})`)
        .all();

    return info.find(field => field.name === column) ?? null;
}

function columnIsNotNull(db: TypedDatabase, table: string, column: string): boolean {
    const metadata = getColumnMetadata(db, table, column);
    if (!metadata) {
        return false;
    }

    return metadata.notnull === 1;
}

/**
 * Migrations must stay idempotent; each entry defends itself when rerun after a crash.
 * Guard clauses (e.g., `tableHasColumn`) prevent SQLite from throwing if the migration
 * has already been applied outside the tracking table.
 */
const pendingNetSupportMigration: Migration = (() => {
    let hasCreatedAt = false;
    let startedAtIsNotNull = false;
    let needsRebuild = false;

    const evaluateState = (db: TypedDatabase): void => {
        hasCreatedAt = tableHasColumn(db, 'nets', 'created_at');
        startedAtIsNotNull = columnIsNotNull(db, 'nets', 'started_at');
        needsRebuild = !hasCreatedAt || startedAtIsNotNull;
    };

    const getForeignKeysState = (db: TypedDatabase): number => {
        const result = db.prepare<{ foreign_keys: number }>('PRAGMA foreign_keys').get();
        return result?.foreign_keys === 1 ? 1 : 0;
    };

    return {
        id: '20251125_pending_net_support',
        name: 'Allow pending nets and track creation timestamp',
        before: (db) => {
            evaluateState(db);

            if (!needsRebuild) {
                return;
            }

            const foreignKeysWereEnabled = getForeignKeysState(db) === 1;
            if (!foreignKeysWereEnabled) {
                return;
            }

            db.run('PRAGMA foreign_keys = OFF');

            return () => {
                db.run('PRAGMA foreign_keys = ON');
            };
        },
        run: (db) => {
            const createdAtExpression = hasCreatedAt
                ? 'COALESCE(created_at, started_at, datetime(\'now\'))'
                : 'COALESCE(started_at, datetime(\'now\'))';

            if (!needsRebuild) {
                db.run(`
                    UPDATE nets
                    SET created_at = COALESCE(created_at, started_at, datetime('now'))
                    WHERE created_at IS NULL
                `);
                return;
            }

            db.run(`
                CREATE TABLE nets_new (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  started_at TEXT,
                  ended_at TEXT,
                  formal_ended_at TEXT,
                  topic TEXT,
                  created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            `);
            db.run(`
                INSERT INTO nets_new (id, started_at, ended_at, formal_ended_at, topic, created_at)
                SELECT
                    id,
                    started_at,
                    ended_at,
                    formal_ended_at,
                    topic,
                    ${createdAtExpression}
                FROM nets
            `);
            db.run('DROP TABLE nets');
            db.run('ALTER TABLE nets_new RENAME TO nets');
        }
    };
})();

const MIGRATIONS: Migration[] = [
    {
        id: '20251014_add_formal_ended_at',
        name: 'Add formal_ended_at column to nets table',
        run: (db) => {
            if (!tableHasColumn(db, 'nets', 'formal_ended_at')) {
                db.run('ALTER TABLE nets ADD COLUMN formal_ended_at TEXT');
            }

            db.run(`
                UPDATE nets
                SET formal_ended_at = ended_at
                WHERE ended_at IS NOT NULL
                  AND formal_ended_at IS NULL
            `);
        }
    },
    {
        id: '20251014_add_station_location',
        name: 'Add location column to stations table',
        run: (db) => {
            if (!tableHasColumn(db, 'stations', 'location')) {
                db.run('ALTER TABLE stations ADD COLUMN location TEXT');
            }
        }
    },
    {
        id: '20251102_add_user_profile_fields',
        name: 'Add full name, password reset flag, and last login tracking to users table',
        run: (db) => {
            if (!tableHasColumn(db, 'users', 'full_name')) {
                db.run('ALTER TABLE users ADD COLUMN full_name TEXT NOT NULL DEFAULT \'\'');
                db.run(`
                    UPDATE users
                    SET full_name = username
                    WHERE full_name = '' OR full_name IS NULL
                `);
            }

            if (!tableHasColumn(db, 'users', 'must_change_password')) {
                db.run('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0');
            }

            if (!tableHasColumn(db, 'users', 'last_login_at')) {
                db.run('ALTER TABLE users ADD COLUMN last_login_at TEXT');
            }
        }
    },
    pendingNetSupportMigration,
    {
        id: '20261116_net_ownership_sharing',
        name: 'Add created_by and shared columns to nets table',
        run: (db) => {
            if (!tableHasColumn(db, 'nets', 'created_by')) {
                db.run('ALTER TABLE nets ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL');

                db.run(`
                    UPDATE nets
                    SET created_by = (SELECT MIN(id) FROM users WHERE is_admin = 1)
                `);
            }

            if (!tableHasColumn(db, 'nets', 'shared')) {
                db.run('ALTER TABLE nets ADD COLUMN shared INTEGER NOT NULL DEFAULT 0');
                db.run('UPDATE nets SET shared = 1');
            }

            db.run('CREATE INDEX IF NOT EXISTS idx_nets_created_by ON nets(created_by)');
        }
    }
];

/**
 * Applies outstanding migrations in declaration order. The migration log is created on
 * first run so fresh databases skip redundant `ALTER TABLE` statements. Each migration
 * executes inside an explicit transaction to keep partial failures from leaking through
 * (Bun's SQLite driver leaves autocommit on by default).
 */
export function runMigrations(db: TypedDatabase): void {
    db.run(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    const appliedMigrations = new Set(
        db.prepare<{ id: string }>('SELECT id FROM schema_migrations').all().map(row => row.id)
    );

    for (const migration of MIGRATIONS) {
        if (appliedMigrations.has(migration.id)) {
            continue;
        }

        console.log(`Applying migration ${migration.id} - ${migration.name} ...`);

        let cleanup: (() => void) | undefined = undefined;
        let inTransaction = false;
        // Bun's Database object does not expose an "in transaction" flag, so we track
        // it manually to guarantee we only issue ROLLBACK when a BEGIN succeeded.
        try {
            cleanup = migration.before?.(db);

            db.run('BEGIN');
            inTransaction = true;

            migration.run(db);

            db.run(
                'INSERT INTO schema_migrations (id, name) VALUES (?, ?)',
                migration.id,
                migration.name
            );

            db.run('COMMIT');
            inTransaction = false;

            console.log(`Migration ${migration.id} applied successfully.`);
        } catch (error) {
            if (inTransaction) {
                db.run('ROLLBACK');
            }
            console.error(`Migration ${migration.id} failed:`, error);
            throw error;
        } finally {
            if (cleanup) {
                try {
                    cleanup();
                } catch (cleanupError) {
                    console.error('Error running migration cleanup hook:', cleanupError);
                }
            }
        }
    }
}