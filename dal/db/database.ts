import { Database } from 'bun:sqlite';
import {
    existsSync,
    mkdirSync
} from 'node:fs';
import { dirname } from 'node:path';

import { runMigrations } from './migrations';
import { SCHEMA_STATEMENTS } from './schema';
import { TypedDatabase } from './wrapper';

const DATABASE_PATH = process.env.DATABASE_PATH ?? 'data/netminder.sqlite3';

function ensureDataDirectory(): void {
    const dir = dirname(DATABASE_PATH);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        console.log(`Created database directory: ${dir}`);
    }
}

let dbInstance: TypedDatabase | null = null;
let databaseExistedOnOpen: boolean | null = null;

export function getDatabase(): TypedDatabase {
    if (!dbInstance) {
        databaseExistedOnOpen ??= existsSync(DATABASE_PATH);

        ensureDataDirectory();
        const rawDb = new Database(DATABASE_PATH, { create: true });
        dbInstance = new TypedDatabase(rawDb);

        dbInstance.run('PRAGMA foreign_keys = ON');
        dbInstance.run('PRAGMA journal_mode = WAL');

        console.log(`Database opened at: ${DATABASE_PATH}`);
    }

    return dbInstance;
}

export function initDatabase(): void {
    const db = getDatabase();

    console.log('Initializing database schema...');

    for (const statement of SCHEMA_STATEMENTS) {
        try {
            db.run(statement);
        } catch (error) {
            console.error('Error executing schema statement:', error);
            throw error;
        }
    }

    console.log('Database schema initialized successfully');

    if (databaseExistedOnOpen) {
        runMigrations(db);
    } else {
        console.log('Fresh database detected, skipping migrations on first boot.');
    }
}

export function closeDatabase(): void {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
        databaseExistedOnOpen = null;
        console.log('Database connection closed');
    }
}

export const db: TypedDatabase = getDatabase();