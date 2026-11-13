import {
    t,
    type Context,
    type Static
} from 'elysia';

import { findNetById } from '@netminder/dal';

import {
    errorResponse,
    type ErrorResponse
} from '../common/errors';
import { parsePositiveInt } from '../common/validation';

import { netSchema } from './schema';

export const getContract = {
    params: t.Object({
        id: t.String({
            description: 'Identifier of the net to retrieve',
            examples: ['17']
        })
    }, { description: 'Route parameters identifying the desired net' }),
    detail: {
        summary: 'Get net',
        description: 'Loads a single net record, including its timestamps and topic.',
        tags: ['Nets'] as string[]
    },
    response: {
        200: t.Object({ net: netSchema }, { description: 'Net resource for the requested identifier' }),
        400: errorResponse,
        404: errorResponse
    }
} as const;

export type GetParams = Static<typeof getContract.params>;
export type GetResponse = Static<typeof getContract.response[200]>;

interface GetContext {
    params: GetParams;
    set: Context['set'];
}

function parseId(raw: GetParams): number | null {
    return parsePositiveInt(raw.id);
}

export const getHandler = ({ params, set }: GetContext): GetResponse | ErrorResponse => {
    const id = parseId(params);
    if (id === null) {
        set.status = 400;
        return {
            error: {
                code: 'INVALID_ID',
                message: 'Invalid net ID'
            }
        };
    }

    const net = findNetById(id);
    if (!net) {
        set.status = 404;
        return {
            error: {
                code: 'NET_NOT_FOUND',
                message: 'Net not found'
            }
        };
    }

    return {
        net: {
            id: net.id,
            started_at: net.started_at ?? null,
            ended_at: net.ended_at ?? null,
            formal_ended_at: net.formal_ended_at ?? null,
            topic: net.topic ?? null,
            created_at: net.created_at
        }
    };
};