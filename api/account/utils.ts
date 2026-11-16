import {
    getQRZCredentialMode,
    type UserQRZStatus
} from '@netminder/dal';

import { isEncryptionKeyAvailable } from '../settings/utils';

import type { AccountQrzStatusResponseSchema } from './schema';

export function buildAccountStatusResponse(status: UserQRZStatus): AccountQrzStatusResponseSchema {
    return {
        settings: {
            mode: getQRZCredentialMode(),
            username: status.username,
            configured: status.configured,
            updatedAt: status.updatedAt,
            encryptionKeyConfigured: isEncryptionKeyAvailable()
        }
    };
}

export function isGlobalMode(): boolean {
    return getQRZCredentialMode() === 'global';
}

export const GLOBAL_MODE_ERROR = {
    error: {
        code: 'QRZ_GLOBAL_MODE',
        message: 'QRZ credentials are managed by an administrator in global mode.'
    }
} as const;

export const UNAUTHORIZED_ERROR = {
    error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
    }
} as const;