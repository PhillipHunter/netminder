import {
    EncryptionError,
    SettingsServiceError,
    decryptSecret,
    encryptSecret,
    type QRZCredentials
} from '@netminder/core';

import {
    db,
    type UserQRZCredential
} from '../db';

export interface UserQRZStatus {
    username: string | null;
    configured: boolean;
    updatedAt: string | null;
}

function selectRow(userId: number): UserQRZCredential | null {
    try {
        const row = db
            .prepare<UserQRZCredential>(`
                SELECT user_id, username, password, created_at, updated_at
                FROM user_qrz_credentials
                WHERE user_id = ?
            `)
            .get(userId);

        return (row as UserQRZCredential | undefined) ?? null;
    } catch (error: unknown) {
        if (error instanceof Error && error.message.includes('no such table')) {
            throw new SettingsServiceError(
                'SETTINGS_TABLE_MISSING',
                'User QRZ credentials table is not initialized. Run database migrations before accessing settings.'
            );
        }

        throw error;
    }
}

function buildStatus(row: UserQRZCredential | null): UserQRZStatus {
    return {
        username: row?.username ?? null,
        configured: Boolean(row),
        updatedAt: row?.updated_at ?? null
    };
}

export function getUserQRZStatus(userId: number): UserQRZStatus {
    return buildStatus(selectRow(userId));
}

export function getUserQRZCredentials(userId: number): QRZCredentials | null {
    const row = selectRow(userId);

    if (!row) {
        return null;
    }

    try {
        return {
            username: row.username,
            password: decryptSecret(row.password)
        };
    } catch (error: unknown) {
        if (error instanceof EncryptionError && error.code === 'CONFIG_ENCRYPTION_KEY_REQUIRED') {
            throw new SettingsServiceError(error.code, error.message);
        }

        clearUserQRZCredentials(userId);
        return null;
    }
}

export function updateUserQRZCredentials(userId: number, input: QRZCredentials): UserQRZStatus {
    const username = input.username.trim();
    const password = input.password;

    if (username.length === 0) {
        throw new SettingsServiceError('INVALID_USERNAME', 'QRZ username is required.');
    }

    if (!password || password.trim().length === 0) {
        throw new SettingsServiceError('INVALID_PASSWORD', 'QRZ password is required.');
    }

    let encryptedPassword: string;

    try {
        encryptedPassword = encryptSecret(password);
    } catch (error: unknown) {
        if (error instanceof EncryptionError) {
            throw new SettingsServiceError(error.code, error.message);
        }

        throw new SettingsServiceError('ENCRYPTION_FAILED', 'Failed to encrypt QRZ password.');
    }

    db.run(`
        INSERT INTO user_qrz_credentials (user_id, username, password, created_at, updated_at)
        VALUES (?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
            username = excluded.username,
            password = excluded.password,
            updated_at = datetime('now')
    `, userId, username, encryptedPassword);

    return buildStatus(selectRow(userId));
}

export function clearUserQRZCredentials(userId: number): void {
    db.run('DELETE FROM user_qrz_credentials WHERE user_id = ?', userId);
}