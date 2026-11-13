import {
    t,
    type Context,
    type Static
} from 'elysia';

import { getStationDetail } from '@netminder/dal';

import {
    errorResponse,
    type ErrorResponse
} from '../common/errors';

import { stationDetailSchema } from './schema';
import {
    decodeCallsignParam,
    mapStationDetail,
    normalizeCallsignValue
} from './utils';

export const getContract = {
    params: t.Object({
        callsign: t.String({
            description: 'Callsign of the station to load',
            examples: ['K1ABC']
        })
    }, { description: 'Route parameters describing the station to fetch' }),
    detail: {
        summary: 'Get station detail',
        description: 'Returns the station profile if found, including cached QRZ information.',
        tags: ['Stations'] as string[]
    },
    response: {
        200: t.Object({ station: t.Nullable(stationDetailSchema) }, { description: 'Station detail when the station exists, otherwise null' }),
        400: errorResponse,
        500: errorResponse
    }
} as const;

export type GetParams = Static<typeof getContract.params>;
export type GetResponse = Static<typeof getContract.response[200]>;
interface GetContext {
    params: GetParams;
    set: Context['set'];
}

export const getHandler = ({
    params,
    set
}: GetContext): GetResponse | ErrorResponse => {
    const decoded = decodeCallsignParam(params.callsign);
    if (!decoded) {
        set.status = 400;
        return {
            error: {
                code: 'INVALID_CALLSIGN',
                message: 'Callsign parameter is required'
            }
        };
    }

    try {
        const normalized = normalizeCallsignValue(decoded);
        const detail = getStationDetail(normalized);
        if (!detail) {
            return { station: null };
        }

        return { station: mapStationDetail(detail) };
    } catch (error) {
        console.error('Error fetching station:', error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch station'
            }
        };
    }
};