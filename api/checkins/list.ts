import {
    t,
    type Context,
    type Static
} from 'elysia';

import { listCheckinsByNet } from '@netminder/dal';

import {
    errorResponse,
    type ErrorResponse
} from '../common/errors';
import { parsePositiveInt } from '../common/validation';

import {
    checkinSchema,
    toCheckinPayload
} from './schema';

export const listContract = {
    params: t.Object({
        id: t.String({
            description: 'Identifier of the net whose checkins should be returned',
            examples: ['42']
        })
    }, { description: 'Route parameters identifying the target net' }),
    detail: {
        summary: 'List net checkins',
        description: 'Retrieves all checkins recorded for the specified net.',
        tags: ['Checkins'] as string[]
    },
    response: {
        200: t.Object({ checkins: t.Array(checkinSchema, { description: 'Checkins ordered by time entered' }) }, { description: 'Collection of checkins for the requested net' }),
        400: errorResponse
    }
} as const;

export type ListParams = Static<typeof listContract.params>;
export type ListResponse = Static<typeof listContract.response[200]>;

interface ListContext {
    params: ListParams;
    set: Context['set'];
}

function parseNetId(params: ListParams): number | null {
    return parsePositiveInt(params.id);
}

export const listHandler = ({ params, set }: ListContext): ListResponse | ErrorResponse => {
    const netId = parseNetId(params);
    if (netId === null) {
        set.status = 400;
        return {
            error: {
                code: 'INVALID_NET_ID',
                message: 'Invalid net ID'
            }
        };
    }

    const rows = listCheckinsByNet(netId);
    return { checkins: rows.map(row => toCheckinPayload(row)) };
};