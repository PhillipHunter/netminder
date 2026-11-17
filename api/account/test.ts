import {
    type Context,
    type Static
} from 'elysia';

import {
    SettingsServiceError,
    verifyQRZCredentials
} from '@netminder/core';
import { getUserQRZCredentials } from '@netminder/dal';

import type { AuthUser } from '../auth/middleware';

import {
    accountQrzTestResponseSchema,
    errorResponse
} from './schema';
import {
    GLOBAL_MODE_ERROR,
    UNAUTHORIZED_ERROR,
    isGlobalMode
} from './utils';

export const testContract = {
    detail: {
        summary: 'Test my QRZ credentials',
        description: 'Re-verifies the signed-in user\'s stored QRZ credentials against QRZ. Returns 404 when no credentials are stored.',
        tags: ['Account'] as string[]
    },
    response: {
        200: accountQrzTestResponseSchema,
        401: errorResponse,
        404: errorResponse,
        409: errorResponse,
        500: errorResponse
    }
} as const;

export type TestResponse = Static<typeof testContract.response[200]>;
export type TestErrorResponse = Static<typeof testContract.response[404]>;

interface TestContext {
    set: Context['set'];
    user?: AuthUser | null;
}

export const testHandler = async ({ set, user }: TestContext): Promise<TestResponse | TestErrorResponse> => {
    if (!user) {
        set.status = 401;
        return UNAUTHORIZED_ERROR;
    }

    try {
        if (isGlobalMode()) {
            set.status = 409;
            return GLOBAL_MODE_ERROR;
        }

        const credentials = getUserQRZCredentials(user.userId);
        if (!credentials) {
            set.status = 404;
            return {
                error: {
                    code: 'QRZ_CREDENTIALS_NOT_FOUND',
                    message: 'No QRZ credentials are stored for this account.'
                }
            };
        }

        return await verifyQRZCredentials(credentials.username, credentials.password);
    } catch (error) {
        if (error instanceof SettingsServiceError) {
            console.error('QRZ settings service error:', error);
            set.status = 500;
            return {
                error: {
                    code: error.code,
                    message: error.message
                }
            };
        }

        console.error('Error testing user QRZ credentials:', error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to test QRZ credentials.'
            }
        };
    }
};