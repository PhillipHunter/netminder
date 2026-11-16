import {
    t,
    type Context,
    type Static
} from 'elysia';

import { isQRZConfigured } from '@netminder/core';
import {
    getStationDetail,
    refreshStationQRZ
} from '@netminder/dal';

import type { AuthUser } from '../auth/middleware';
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

export const refreshContract = {
    params: t.Object({
        callsign: t.String({
            description: 'Callsign for which QRZ data should be refreshed',
            examples: ['K1ABC']
        })
    }, { description: 'Route parameters identifying the station whose QRZ details will be refreshed' }),
    detail: {
        summary: 'Refresh station QRZ data',
        description: 'Fetches the latest QRZ information for a station and returns updated station details.',
        tags: ['Stations'] as string[]
    },
    response: {
        200: t.Object({ station: stationDetailSchema }, { description: 'Station detail after refresh' }),
        400: errorResponse,
        404: errorResponse,
        500: errorResponse
    }
} as const;

export type RefreshParams = Static<typeof refreshContract.params>;
export type RefreshResponse = Static<typeof refreshContract.response[200]>;
interface RefreshContext {
    params: RefreshParams;
    set: Context['set'];
    user?: AuthUser | null;
}

export const refreshHandler = async ({
    params,
    set,
    user
}: RefreshContext): Promise<RefreshResponse | ErrorResponse> => {
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

    if (!isQRZConfigured(user?.userId ?? null)) {
        set.status = 400;
        return {
            error: {
                code: 'QRZ_DISABLED',
                message: 'QRZ integration is not configured'
            }
        };
    }

    try {
        const normalized = normalizeCallsignValue(decoded);
        const updated = await refreshStationQRZ(normalized, user?.userId ?? null);
        if (!updated) {
            set.status = 404;
            return {
                error: {
                    code: 'STATION_NOT_FOUND',
                    message: 'Station not found'
                }
            };
        }

        const detail = getStationDetail(updated.callsign);
        if (!detail) {
            set.status = 500;
            return {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to load refreshed station'
                }
            };
        }

        return { station: mapStationDetail(detail) };
    } catch (error) {
        console.error('Error refreshing station QRZ data:', error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to refresh QRZ data'
            }
        };
    }
};