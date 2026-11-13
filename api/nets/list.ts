import {
    t,
    type Context
} from 'elysia';

import {
    countNets,
    listNets
} from '@netminder/dal';

import { netWithCountsSchema } from './schema';

export const listContract = {
    query: t.Object({
        limit: t.Optional(t.Number({
            description: 'Maximum number of nets to return (1-100)',
            examples: [25]
        })),
        offset: t.Optional(t.Number({
            description: 'Number of nets to skip before returning results',
            examples: [0]
        }))
    }, { description: 'Query parameters controlling pagination of nets' }),
    detail: {
        summary: 'List nets',
        description: 'Returns a paginated list of nets with participant counts.',
        tags: ['Nets'] as string[]
    },
    response: t.Object({
        nets: t.Array(netWithCountsSchema, { description: 'Nets matching the pagination request' }),
        meta: t.Object({
            total: t.Number({ description: 'Total number of nets available' }),
            hasMore: t.Boolean({ description: 'Indicates whether more nets can be fetched with a higher offset' })
        }, { description: 'Pagination metadata for the nets list' })
    }, { description: 'Paginated nets response' })
} as const;

export type ListRequest = typeof listContract.query.static;
export type ListResponse = typeof listContract.response.static;
interface ListContext {
    query: ListRequest;
    set: Context['set'];
}

export const listHandler = ({ query }: ListContext): ListResponse => {
    const limit = Math.max(1, Math.min(query.limit ?? 50, 100));
    const offset = Math.max(0, query.offset ?? 0);
    const nets = listNets(limit, offset);
    const total = countNets();
    const hasMore = offset + nets.length < total;

    return {
        nets: nets.map(net => ({
            id: net.id,
            started_at: net.started_at ?? null,
            ended_at: net.ended_at,
            formal_ended_at: net.formal_ended_at,
            topic: net.topic,
            created_at: net.created_at,
            counts: {
                total: net.counts.total,
                staying: net.counts.staying,
                in_and_out: net.counts.in_and_out,
                mobile: net.counts.mobile,
                portable: net.counts.portable
            }
        })),
        meta: {
            total,
            hasMore
        }
    };
};