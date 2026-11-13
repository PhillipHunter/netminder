import type { SQLQueryBindings } from 'bun:sqlite';

import { db } from '../db';

import {
    findUserById,
    type UserRow
} from './list';

interface CreateUserRecord {
    username: string;
    full_name: string;
    password_hash: string;
    must_change_password: boolean;
    is_admin: boolean;
    last_login_at?: string | null;
}

interface UpdateUserRecord {
    username?: string;
    password_hash?: string;
    is_admin?: boolean;
    full_name?: string;
    must_change_password?: boolean;
    last_login_at?: string | null;
}

const INSERT_USER_SQL = `
    INSERT INTO users (username, full_name, password_hash, must_change_password, is_admin, last_login_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`;

const DELETE_USER_SQL = 'DELETE FROM users WHERE id = ?';

export function insertUser(record: CreateUserRecord): UserRow {
    const stmt = db.prepare(INSERT_USER_SQL);
    const result = stmt.run(
        record.username,
        record.full_name,
        record.password_hash,
        record.must_change_password ? 1 : 0,
        record.is_admin ? 1 : 0,
        record.last_login_at ?? null
    );
    const id = Number(result.lastInsertRowid);
    const created = findUserById(id);
    if (!created) {
        throw new Error(`Failed to load inserted user ${id}`);
    }
    return created;
}

export function updateUserRecord(id: number, updates: UpdateUserRecord): UserRow | null {
    const fields: string[] = [];
    const values: SQLQueryBindings[] = [];

    if (updates.username !== undefined) {
        fields.push('username = ?');
        values.push(updates.username);
    }

    if (updates.password_hash !== undefined) {
        fields.push('password_hash = ?');
        values.push(updates.password_hash);
    }

    if (updates.is_admin !== undefined) {
        fields.push('is_admin = ?');
        values.push(updates.is_admin ? 1 : 0);
    }

    if (updates.full_name !== undefined) {
        fields.push('full_name = ?');
        values.push(updates.full_name);
    }

    if (updates.must_change_password !== undefined) {
        fields.push('must_change_password = ?');
        values.push(updates.must_change_password ? 1 : 0);
    }

    if (updates.last_login_at !== undefined) {
        fields.push('last_login_at = ?');
        values.push(updates.last_login_at ?? null);
    }

    if (fields.length === 0) {
        return findUserById(id);
    }

    fields.push('updated_at = datetime(\'now\')');
    const updateSql = `
        UPDATE users
        SET ${fields.join(', ')}
        WHERE id = ?
    `;

    values.push(id);
    db.prepare(updateSql).run(...values);
    return findUserById(id);
}

export function deleteUserRecord(id: number): boolean {
    const result = db.prepare(DELETE_USER_SQL).run(id);
    return result.changes > 0;
}