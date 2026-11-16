import {
    t,
    type Context,
    type Static
} from 'elysia';

import {
    SettingsServiceError,
    clearQRZSessionCache
} from '@netminder/core';
import { clearUserQRZCredentials } from '@netminder/dal';

import type { AuthUser } from '../auth/middleware';

import { errorResponse } from './schema';
import {
    GLOBAL_MODE_ERROR,
    UNAUTHORIZED_ERROR,
    isGlobalMode
} from './utils';

export const deleteContract = {
    detail: {
        summary: 'Remove my QRZ credentials',
        description: 'Removes the signed-in user\'s stored QRZ credentials. Not available while the organization uses global credentials.',
        tags: ['Account'] as string[]
    },
    response: {
        204: t.Void(),
        401: errorResponse,
        409: errorResponse,
        500: errorResponse
    }
} as const;

export type DeleteResponse = Static<typeof deleteContract.response[204]>;
export type DeleteErrorResponse = Static<typeof deleteContract.response[409]>;

interface DeleteContext {
    set: Context['set'];
    user?: AuthUser | null;
}

export const deleteHandler = ({ set, user }: DeleteContext): DeleteErrorResponse | undefined => {
    if (!user) {
        set.status = 401;
        return UNAUTHORIZED_ERROR;
    }

    try {
        if (isGlobalMode()) {
            set.status = 409;
            return GLOBAL_MODE_ERROR;
        }

        clearUserQRZCredentials(user.userId);
        clearQRZSessionCache();
        set.status = 204;
        return undefined;
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

        console.error('Error clearing user QRZ settings:', error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to remove QRZ credentials.'
            }
        };
    }
};