import {
    t,
    type Context,
    type Static
} from 'elysia';

import {
    SettingsServiceError,
    clearQRZSessionCache,
    verifyQRZCredentials
} from '@netminder/core';
import { updateUserQRZCredentials } from '@netminder/dal';

import type { AuthUser } from '../auth/middleware';
import { isEncryptionKeyAvailable } from '../settings/utils';

import {
    accountQrzStatusResponseSchema,
    errorResponse
} from './schema';
import {
    GLOBAL_MODE_ERROR,
    UNAUTHORIZED_ERROR,
    buildAccountStatusResponse,
    isGlobalMode
} from './utils';

export const updateContract = {
    body: t.Object({
        username: t.String({
            description: 'QRZ username to authenticate API requests',
            examples: ['K1ABC']
        }),
        password: t.String({
            description: 'QRZ password; stored encrypted when CONFIG_ENCRYPTION_KEY is set',
            examples: ['super secure password']
        })
    }, { description: 'QRZ credentials for the signed-in user' }),
    detail: {
        summary: 'Save my QRZ credentials',
        description: 'Validates and stores the signed-in user\'s QRZ credentials. Not available while the organization uses global credentials.',
        tags: ['Account'] as string[]
    },
    response: {
        200: accountQrzStatusResponseSchema,
        400: errorResponse,
        401: errorResponse,
        409: errorResponse,
        500: errorResponse
    }
} as const;

export type UpdateBody = Static<typeof updateContract.body>;
export type UpdateResponse = Static<typeof updateContract.response[200]>;
export type UpdateErrorResponse = Static<typeof updateContract.response[400]>;

interface UpdateContext {
    body: UpdateBody;
    set: Context['set'];
    user?: AuthUser | null;
}

const SERVER_ERROR_CODES = new Set(['CONFIG_ENCRYPTION_KEY_REQUIRED', 'SETTINGS_TABLE_MISSING', 'STATEMENTS_NOT_INITIALIZED']);

function toError(value: unknown): Error {
    return value instanceof Error ? value : new Error(String(value));
}

export const updateHandler = async ({
    body,
    set,
    user
}: UpdateContext): Promise<UpdateResponse | UpdateErrorResponse> => {
    if (!user) {
        set.status = 401;
        return UNAUTHORIZED_ERROR;
    }

    try {
        if (isGlobalMode()) {
            set.status = 409;
            return GLOBAL_MODE_ERROR;
        }

        if (!isEncryptionKeyAvailable()) {
            set.status = 500;
            return {
                error: {
                    code: 'CONFIG_ENCRYPTION_KEY_REQUIRED',
                    message: 'CONFIG_ENCRYPTION_KEY must be set before updating QRZ credentials.'
                }
            };
        }

        const validation = await verifyQRZCredentials(body.username, body.password);
        if (!validation.valid) {
            set.status = 400;
            return {
                error: {
                    code: 'INVALID_QRZ_CREDENTIALS',
                    message: validation.message ?? 'QRZ rejected the provided credentials.'
                }
            };
        }

        const status = updateUserQRZCredentials(user.userId, {
            username: body.username,
            password: body.password
        });

        clearQRZSessionCache();

        return buildAccountStatusResponse(status);
    } catch (unknownError) {
        const error = toError(unknownError);
        if (error instanceof SettingsServiceError) {
            const statusCode = SERVER_ERROR_CODES.has(error.code) ? 500 : 400;
            set.status = statusCode;
            return {
                error: {
                    code: error.code,
                    message: error.message
                }
            };
        }

        console.error('Error updating user QRZ settings:', error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to update QRZ settings.'
            }
        };
    }
};