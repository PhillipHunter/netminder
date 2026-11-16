import type { User } from '../db';
import { db } from '../db';

export interface UserRow {
    id: number;
    username: string;
    full_name: string;
    is_admin: boolean;
    must_change_password: boolean;
    last_login_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface UserRowWithPassword extends UserRow {
    password_hash: string;
}

interface UserRowDB {
    id: number;
    username: string;
    full_name: string;
    is_admin: number;
    must_change_password: number;
    last_login_at: string | null;
    created_at: string;
    updated_at: string;
}

interface CountRow {
    count: number;
}

const SELECT_ALL_USERS_SQL = `
    SELECT
        id,
        username,
        full_name,
        is_admin,
        must_change_password,
        last_login_at,
        created_at,
        updated_at
    FROM users
    ORDER BY created_at DESC
`;

const SELECT_USER_BY_ID_SQL = `
    SELECT
        id,
        username,
        full_name,
        is_admin,
        must_change_password,
        last_login_at,
        created_at,
        updated_at
    FROM users
    WHERE id = ?
`;

const SELECT_USER_BY_USERNAME_SQL = `
    SELECT
        id,
        username,
        full_name,
        is_admin,
        must_change_password,
        last_login_at,
        created_at,
        updated_at,
        password_hash
    FROM users
    WHERE username = ?
`;

const SELECT_USER_WITH_PASSWORD_BY_ID_SQL = `
    SELECT
        id,
        username,
        full_name,
        is_admin,
        must_change_password,
        last_login_at,
        created_at,
        updated_at,
        password_hash
    FROM users
    WHERE id = ?
`;

const COUNT_PRIVATE_NETS_SQL = `
    SELECT COUNT(*) as count
    FROM nets
    WHERE created_by = ?
      AND shared = 0
`;

const COUNT_USERS_SQL = `
    SELECT COUNT(*) as count
    FROM users
`;

const COUNT_ADMINS_SQL = `
    SELECT COUNT(*) as count
    FROM users
    WHERE is_admin = 1
`;

function mapUserRow(row: UserRowDB): UserRow {
    return {
        id: row.id,
        username: row.username,
        full_name: row.full_name,
        is_admin: Boolean(row.is_admin),
        must_change_password: Boolean(row.must_change_password),
        last_login_at: row.last_login_at ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at
    };
}

export function listUsers(): UserRow[] {
    const rows = db.prepare<UserRowDB>(SELECT_ALL_USERS_SQL).all();
    return rows.map(mapUserRow);
}

export function findUserById(id: number): UserRow | null {
    const row = db.prepare<UserRowDB>(SELECT_USER_BY_ID_SQL).get(id);
    if (!row) {
        return null;
    }
    return mapUserRow(row);
}

export function findUserWithPasswordByUsername(username: string): UserRowWithPassword | null {
    const row = db.prepare<User>(SELECT_USER_BY_USERNAME_SQL).get(username);
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        username: row.username,
        full_name: row.full_name,
        is_admin: Boolean(row.is_admin),
        must_change_password: Boolean(row.must_change_password),
        last_login_at: row.last_login_at ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        password_hash: row.password_hash
    };
}

export function findUserWithPasswordById(id: number): UserRowWithPassword | null {
    const row = db.prepare<User>(SELECT_USER_WITH_PASSWORD_BY_ID_SQL).get(id);
    if (!row) {
        return null;
    }

    return {
        id: row.id,
        username: row.username,
        full_name: row.full_name,
        is_admin: Boolean(row.is_admin),
        must_change_password: Boolean(row.must_change_password),
        last_login_at: row.last_login_at ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        password_hash: row.password_hash
    };
}

export function findUserByUsername(username: string): UserRow | null {
    const row = findUserWithPasswordByUsername(username);
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        username: row.username,
        full_name: row.full_name,
        is_admin: row.is_admin,
        must_change_password: row.must_change_password,
        last_login_at: row.last_login_at,
        created_at: row.created_at,
        updated_at: row.updated_at
    };
}

export function countAdmins(): number {
    const row = db.prepare<CountRow>(COUNT_ADMINS_SQL).get();
    return row?.count ?? 0;
}

export function countUsers(): number {
    const row = db.prepare<CountRow>(COUNT_USERS_SQL).get();
    return row?.count ?? 0;
}

export function countPrivateNetsOwnedBy(userId: number): number {
    const row = db.prepare<CountRow>(COUNT_PRIVATE_NETS_SQL).get(userId);
    return row?.count ?? 0;
}