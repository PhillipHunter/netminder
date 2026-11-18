import {
    type Context,
    type Static
} from 'elysia';

import {
    getGeocodingEnabled,
    getMobilityEnabled
} from '@netminder/dal';

import {
    appConfigResponseSchema,
    errorResponse
} from './schema';

export const getContract = {
    detail: {
        summary: 'Get instance configuration',
        description: 'Returns non-secret instance settings the client needs, such as whether mobility tracking and address geocoding are enabled. Available to any signed-in user.',
        tags: ['Config'] as string[]
    },
    response: {
        200: appConfigResponseSchema,
        500: errorResponse
    }
} as const;

export type GetResponse = Static<typeof getContract.response[200]>;
export type GetErrorResponse = Static<typeof getContract.response[500]>;

interface GetContext { set: Context['set'] }

export const getHandler = ({ set }: GetContext): GetResponse | GetErrorResponse => {
    try {
        return {
            config: {
                mobility_enabled: getMobilityEnabled(),
                geocoding_enabled: getGeocodingEnabled()
            }
        };
    } catch (error) {
        console.error('Error fetching config:', error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch configuration.'
            }
        };
    }
};