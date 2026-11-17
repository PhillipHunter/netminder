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
import {
    getQRZCredentialMode,
    updateQRZCredentials
} from '@netminder/dal';

import {
    errorResponse,
    qrzStatusResponseSchema
} from './schema';
import {
    buildStatusResponse,
    isEncryptionKeyAvailable
} from './utils';

export const updateContract = {
    body: t.Object({
        username: t.String({
            description: 'QRZ username to authenticate API requests',
            examples: ['WV1NET']
        }),
        password: t.String({
            description: 'QRZ password; stored encrypted when CONFIG_ENCRYPTION_KEY is set',
            examples: ['super secure password']
        })
    }, { description: 'Credentials used to configure the QRZ integration' }),
    detail: {
        summary: 'Update QRZ credentials',
        description: 'Validates and stores QRZ credentials for callsign lookups, clearing cached sessions on success.',
        tags: ['Settings'] as string[]
    },
    response: {
        200: qrzStatusResponseSchema,
        400: errorResponse,
        500: errorResponse
    }
} as const;

export type UpdateBody = Static<typeof updateContract.body>;
export type UpdateResponse = Static<typeof updateContract.response[200]>;
export type UpdateErrorResponse = Static<typeof updateContract.response[400]>;

interface UpdateContext {
    body: UpdateBody;
    set: Context['set'];
}

const SERVER_ERROR_CODES = new Set(['CONFIG_ENCRYPTION_KEY_REQUIRED', 'SETTINGS_TABLE_MISSING', 'STATEMENTS_NOT_INITIALIZED']);

function toError(value: unknown): Error {
    return value instanceof Error ? value : new Error(String(value));
}

export const updateHandler = async ({ body, set }: UpdateContext): Promise<UpdateResponse | UpdateErrorResponse> => {
    try {
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

        const status = updateQRZCredentials({
            username: body.username,
            password: body.password
        });

        clearQRZSessionCache();

        const encryptionAvailable = isEncryptionKeyAvailable();
        return buildStatusResponse(status, getQRZCredentialMode(), encryptionAvailable);
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

        console.error('Error updating QRZ settings:', error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to update QRZ settings.'
            }
        };
    }
};