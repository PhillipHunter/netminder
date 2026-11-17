import {
    t,
    type Context,
    type Static
} from 'elysia';

import { getStationStats } from '@netminder/dal';

import type { AuthUser } from '../auth/middleware';
import { normalizeMobility } from '../checkins/schema';
import {
    errorResponse,
    unauthorizedResponse,
    type ErrorResponse
} from '../common/errors';

import { stationStatsSchema } from './schema';
import {
    decodeCallsignParam,
    normalizeCallsignValue
} from './utils';

export const statsContract = {
    params: t.Object({
        callsign: t.String({
            description: 'Callsign whose net participation statistics should be returned',
            examples: ['K1ABC']
        })
    }, { description: 'Route parameters identifying the station whose stats are requested' }),
    detail: {
        summary: 'Get station stats',
        description: 'Provides aggregated participation metrics and recent checkins for a station, limited to nets visible to the requesting user.',
        tags: ['Stations'] as string[]
    },
    response: {
        200: t.Object({ stats: stationStatsSchema }, { description: 'Aggregated stats for the requested station' }),
        400: errorResponse,
        404: errorResponse,
        500: errorResponse
    }
} as const;

export type StatsParams = Static<typeof statsContract.params>;
export type StatsResponse = Static<typeof statsContract.response[200]>;
interface StatsContext {
    params: StatsParams;
    user?: AuthUser | null;
    set: Context['set'];
}

export const statsHandler = ({
    params,
    user,
    set
}: StatsContext): StatsResponse | ErrorResponse => {
    if (!user) {
        set.status = 401;
        return unauthorizedResponse();
    }

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
        const stats = getStationStats(normalized, user.userId);

        if (!stats) {
            set.status = 404;
            return {
                error: {
                    code: 'NOT_FOUND',
                    message: 'Station not found'
                }
            };
        }

        return {
            stats: {
                ...stats,
                recent: stats.recent.map(checkin => ({
                    ...checkin,
                    mobility: normalizeMobility(checkin.mobility)
                }))
            }
        };
    } catch (error) {
        console.error('Error fetching station stats:', error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch station stats'
            }
        };
    }
};