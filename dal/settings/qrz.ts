import {
    EncryptionError,
    SettingsServiceError,
    decryptSecret,
    encryptSecret,
    setQRZCredentialProvider,
    type QRZCredentials
} from '@netminder/core';

import {
    db,
    type Setting,
    type TypedStatement
} from '../db';

import { getUserQRZCredentials } from './userQrz';

const QRZ_USERNAME_KEY = 'qrz_username';
const QRZ_PASSWORD_KEY = 'qrz_password';
const QRZ_MODE_KEY = 'qrz_credential_mode';

export type QRZCredentialMode = 'per_user' | 'global';

let selectSettingStmt: TypedStatement<Setting> | null = null;
let upsertSettingStmt: TypedStatement | null = null;
let deleteSettingStmt: TypedStatement | null = null;

interface QRZCredentialCache {
    username: string | null;
    password: string | null;
    updatedAt: string | null;
}

let credentialCache: QRZCredentialCache | null = null;

function ensureStatements(): void {
    if (selectSettingStmt && upsertSettingStmt && deleteSettingStmt) {
        return;
    }

    try {
        selectSettingStmt = db.prepare<Setting>(`
            SELECT key, value, created_at, updated_at
            FROM settings
            WHERE key = ?
        `);

        upsertSettingStmt = db.prepare(`
            INSERT INTO settings (key, value, created_at, updated_at)
            VALUES (?, ?, datetime('now'), datetime('now'))
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = datetime('now')
        `);

        deleteSettingStmt = db.prepare(`
            DELETE FROM settings
            WHERE key = ?
        `);
    } catch (error: unknown) {
        if (error instanceof Error && error.message.includes('no such table')) {
            throw new SettingsServiceError(
                'SETTINGS_TABLE_MISSING',
                'Settings table is not initialized. Run database migrations before accessing settings.'
            );
        }

        throw error;
    }
}

function requireStatements(): {
    select: TypedStatement<Setting>;
    upsert: TypedStatement;
    remove: TypedStatement;
} {
    ensureStatements();

    if (!selectSettingStmt || !upsertSettingStmt || !deleteSettingStmt) {
        throw new SettingsServiceError(
            'STATEMENTS_NOT_INITIALIZED',
            'Failed to initialize settings statements.'
        );
    }

    return {
        select: selectSettingStmt,
        upsert: upsertSettingStmt,
        remove: deleteSettingStmt
    };
}

function getSetting(key: string): Setting | null {
    const { select } = requireStatements();
    const result = select.get(key);
    return (result as Setting | undefined) ?? null;
}

function setSetting(key: string, value: string): void {
    const { upsert } = requireStatements();
    upsert.run(key, value);
}

function removeSetting(key: string): void {
    const { remove } = requireStatements();
    remove.run(key);
}

function mostRecentTimestamp(values: (string | null | undefined)[]): string | null {
    const filtered = values.filter((value): value is string => Boolean(value));
    if (filtered.length === 0) {
        return null;
    }

    return filtered.reduce((latest, current) => (current > latest ? current : latest));
}

export interface QRZSettingsStatus {
    username: string | null;
    configured: boolean;
    updatedAt: string | null;
}

function buildStatusFromSettings(usernameSetting: Setting | null, passwordSetting: Setting | null): QRZSettingsStatus {
    return {
        username: usernameSetting?.value ?? null,
        configured: Boolean(usernameSetting?.value && passwordSetting?.value),
        updatedAt: mostRecentTimestamp([
            usernameSetting?.updated_at ?? usernameSetting?.created_at ?? null,
            passwordSetting?.updated_at ?? passwordSetting?.created_at ?? null
        ])
    };
}

export function getQRZSettingsStatus(): QRZSettingsStatus {
    const usernameSetting = getSetting(QRZ_USERNAME_KEY);
    const passwordSetting = getSetting(QRZ_PASSWORD_KEY);

    return buildStatusFromSettings(usernameSetting, passwordSetting);
}

export function getQRZCredentials(): QRZCredentials | null {
    if (credentialCache?.username && credentialCache.password) {
        return {
            username: credentialCache.username,
            password: credentialCache.password
        };
    }

    const usernameSetting = getSetting(QRZ_USERNAME_KEY);
    const passwordSetting = getSetting(QRZ_PASSWORD_KEY);

    if (!usernameSetting?.value || !passwordSetting?.value) {
        credentialCache = {
            username: usernameSetting?.value ?? null,
            password: null,
            updatedAt: null
        };
        return null;
    }

    try {
        const password = decryptSecret(passwordSetting.value);

        credentialCache = {
            username: usernameSetting.value,
            password,
            updatedAt: passwordSetting.updated_at
        };

        return {
            username: usernameSetting.value,
            password
        };
    } catch (error: unknown) {
        if (error instanceof EncryptionError && error.code === 'CONFIG_ENCRYPTION_KEY_REQUIRED') {
            throw new SettingsServiceError(error.code, error.message);
        }

        removeSetting(QRZ_PASSWORD_KEY);
        credentialCache = {
            username: usernameSetting.value,
            password: null,
            updatedAt: null
        };
        return null;
    }
}

interface UpdateQRZInput {
    username: string;
    password: string;
}

export function updateQRZCredentials(input: UpdateQRZInput): QRZSettingsStatus {
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

    setSetting(QRZ_USERNAME_KEY, username);
    setSetting(QRZ_PASSWORD_KEY, encryptedPassword);

    // Pin the mode so a later migration replay on a fresh database can't mistake these credentials for a legacy setup.
    if (!getSetting(QRZ_MODE_KEY)) {
        setSetting(QRZ_MODE_KEY, 'per_user');
    }

    const usernameSetting = getSetting(QRZ_USERNAME_KEY);
    const passwordSetting = getSetting(QRZ_PASSWORD_KEY);
    const updatedAt = passwordSetting ? passwordSetting.updated_at : null;

    credentialCache = {
        username,
        password,
        updatedAt
    };

    return buildStatusFromSettings(usernameSetting, passwordSetting);
}

export function clearQRZCredentials(): void {
    removeSetting(QRZ_USERNAME_KEY);
    removeSetting(QRZ_PASSWORD_KEY);
    credentialCache = null;
}

export function getQRZCredentialMode(): QRZCredentialMode {
    return getSetting(QRZ_MODE_KEY)?.value === 'global' ? 'global' : 'per_user';
}

export function setQRZCredentialMode(mode: QRZCredentialMode): void {
    setSetting(QRZ_MODE_KEY, mode);
}

export function resolveQRZCredentials(userId: number | null): QRZCredentials | null {
    if (getQRZCredentialMode() === 'global') {
        return getQRZCredentials();
    }

    return userId === null ? null : getUserQRZCredentials(userId);
}

setQRZCredentialProvider(userId => resolveQRZCredentials(userId));