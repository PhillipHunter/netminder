import {
    type Context,
    type Static
} from 'elysia';

import { getUserQRZStatus } from '@netminder/dal';

import type { AuthUser } from '../auth/middleware';

import {
    accountQrzStatusResponseSchema,
    errorResponse
} from './schema';
import {
    UNAUTHORIZED_ERROR,
    buildAccountStatusResponse
} from './utils';

export const getContract = {
    detail: {
        summary: 'Get my QRZ credential status',
        description: 'Returns the active QRZ credential mode and whether the signed-in user has stored credentials. The password is never returned.',
        tags: ['Account'] as string[]
    },
    response: {
        200: accountQrzStatusResponseSchema,
        401: errorResponse,
        500: errorResponse
    }
} as const;

export type GetResponse = Static<typeof getContract.response[200]>;
export type GetErrorResponse = Static<typeof getContract.response[500]>;

interface GetContext {
    set: Context['set'];
    user?: AuthUser | null;
}

export const getHandler = ({ set, user }: GetContext): GetResponse | GetErrorResponse | typeof UNAUTHORIZED_ERROR => {
    if (!user) {
        set.status = 401;
        return UNAUTHORIZED_ERROR;
    }

    try {
        return buildAccountStatusResponse(getUserQRZStatus(user.userId));
    } catch (error) {
        console.error('Error fetching user QRZ settings:', error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch QRZ settings.'
            }
        };
    }
};