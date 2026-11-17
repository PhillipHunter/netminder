import type {
    QRZCredentialMode,
    QRZSettingsStatus
} from '@netminder/dal';

import type { QRZStatusResponseSchema } from './schema';

export function isEncryptionKeyAvailable(): boolean {
    const rawKey = process.env.CONFIG_ENCRYPTION_KEY;
    if (rawKey && rawKey.trim().length > 0) {
        return true;
    }

    return process.env.NODE_ENV !== 'production';
}

export function buildStatusResponse(
    status: QRZSettingsStatus,
    mode: QRZCredentialMode,
    encryptionAvailable: boolean
): QRZStatusResponseSchema {
    return {
        settings: {
            mode,
            username: status.username,
            configured: status.configured,
            updatedAt: status.updatedAt,
            encryptionKeyConfigured: encryptionAvailable
        }
    };
}