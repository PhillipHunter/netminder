import type {
    Changes,
    Database,
    SQLQueryBindings,
    Statement
} from 'bun:sqlite';

export type TypedRunResult = Changes;

export type TypedStatement<T = unknown> = Statement<T, SQLQueryBindings[]>;

function isPromiseLike<T>(value: unknown): value is Promise<T> {
    return (
        typeof value === 'object'
        && value !== null
        && typeof (value as { then?: unknown }).then === 'function'
    );
}

export class TypedDatabase {
    constructor(private readonly db: Database) {}

    run(sql: string, ...params: SQLQueryBindings[]): TypedRunResult {
        return this.db.prepare<unknown, SQLQueryBindings[]>(sql).run(...params);
    }

    prepare<ReturnType = unknown>(sql: string): TypedStatement<ReturnType> {
        return this.db.prepare<ReturnType, SQLQueryBindings[]>(sql);
    }

    query<ReturnType = unknown>(sql: string): TypedStatement<ReturnType> {
        return this.db.query<ReturnType, SQLQueryBindings[]>(sql);
    }

    close(): void {
        this.db.close();
    }

    transaction<T>(fn: () => T): T;
    transaction<T>(fn: () => Promise<T>): Promise<T>;
    transaction<T>(fn: () => T | Promise<T>): T | Promise<T> {
        this.db.run('BEGIN IMMEDIATE');

        let result: T | Promise<T>;
        try {
            result = fn();
        } catch (error: unknown) {
            try {
                this.db.run('ROLLBACK');
            } catch {
                // Ignore rollback failure; original error is more actionable.
            }
            throw error;
        }

        if (isPromiseLike<T>(result)) {
            return result.then(
                (value) => {
                    try {
                        this.db.run('COMMIT');
                    } catch (commitError: unknown) {
                        try {
                            this.db.run('ROLLBACK');
                        } catch {
                            // Ignore rollback failure to surface commit error.
                        }
                        throw commitError;
                    }
                    return value;
                },
                (error: unknown) => {
                    try {
                        this.db.run('ROLLBACK');
                    } catch {
                        // Ignore rollback failure; rejection error is primary.
                    }
                    throw error;
                }
            );
        }

        try {
            this.db.run('COMMIT');
        } catch (commitError: unknown) {
            try {
                this.db.run('ROLLBACK');
            } catch {
                // Ignore rollback failure; commit error already raised.
            }
            throw commitError;
        }

        return result;
    }

    getRawDatabase(): Database {
        return this.db;
    }
}