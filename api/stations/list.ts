import {
    t,
    type Context
} from 'elysia';

import {
    countStations,
    listStations,
    searchStations
} from '@netminder/dal';

import type { AuthUser } from '../auth/middleware';
import {
    errorResponse,
    unauthorizedResponse,
    type ErrorResponse
} from '../common/errors';

export const listContract = {
    query: t.Object({
        query: t.Optional(t.String({
            description: 'Search term applied to callsign, name, or location',
            examples: ['K1ABC']
        })),
        limit: t.Optional(t.Number({
            description: 'Maximum number of stations to return (range 1-100)',
            examples: [25]
        })),
        offset: t.Optional(t.Number({
            description: 'Number of stations to skip before collecting results',
            examples: [0]
        }))
    }, { description: 'Query parameters controlling station search and pagination' }),
    detail: {
        summary: 'List stations',
        description: 'Retrieves a paginated list of stations, optionally filtered by a search term.',
        tags: ['Stations'] as string[]
    },
    response: {
        200: t.Object({
            stations: t.Array(t.Object({
                callsign: t.String(),
                preferred_name: t.Nullable(t.String()),
                location: t.Nullable(t.String()),
                display_name: t.Nullable(t.String()),
                location_display: t.Nullable(t.String()),
                first_seen_at: t.Nullable(t.String()),
                last_seen_at: t.Nullable(t.String()),
                total_checkins: t.Number()
            }, { description: 'Station summary information' }), { description: 'Stations matching the requested filters' }),
            meta: t.Object({
                total: t.Number({ description: 'Total count of stations that satisfy the current filter' }),
                hasMore: t.Boolean({ description: 'Indicates whether additional pages are available' })
            }, { description: 'Pagination metadata for the station collection' })
        }, { description: 'Response payload for station listing' }),
        401: errorResponse
    }
} as const;

export type ListRequest = typeof listContract.query.static;
export type ListResponse = typeof listContract.response[200]['static'];
interface ListContext {
    query: ListRequest;
    set: Context['set'];
    user?: AuthUser | null;
}

export const listHandler = ({ query, set, user }: ListContext): ListResponse | ErrorResponse => {
    if (!user) {
        set.status = 401;
        return unauthorizedResponse();
    }

    const limit = Math.max(1, Math.min(query.limit ?? 10, 100));
    const offset = Math.max(0, query.offset ?? 0);
    const trimmedQuery = query.query?.trim() ?? '';
    const effectiveQuery = trimmedQuery.length > 0 ? trimmedQuery : undefined;

    const rows = effectiveQuery
        ? searchStations(user.userId, effectiveQuery, limit, offset)
        : listStations(user.userId, limit, offset);
    const total = countStations(effectiveQuery);
    const hasMore = offset + rows.length < total;

    return {
        stations: rows.map(row => ({
            callsign: row.callsign,
            preferred_name: row.preferred_name,
            location: row.location,
            display_name: row.display_name,
            location_display: row.location_display,
            first_seen_at: row.first_seen_at,
            last_seen_at: row.last_seen_at,
            total_checkins: row.total_checkins
        })),
        meta: {
            total,
            hasMore
        }
    };
};