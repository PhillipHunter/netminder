import {
    t,
    type Context,
    type Static
} from 'elysia';

import { findVisibleNet } from '@netminder/dal';

import type { AuthUser } from '../auth/middleware';
import {
    errorResponse,
    unauthorizedResponse,
    type ErrorResponse
} from '../common/errors';
import { parsePositiveInt } from '../common/validation';

import {
    netSchema,
    toNetPayload
} from './schema';

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
    user?: AuthUser | null;
    set: Context['set'];
}

function parseId(raw: GetParams): number | null {
    return parsePositiveInt(raw.id);
}

export const getHandler = ({ params, user, set }: GetContext): GetResponse | ErrorResponse => {
    if (!user) {
        set.status = 401;
        return unauthorizedResponse();
    }

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

    const net = findVisibleNet(id, user.userId);
    if (!net) {
        set.status = 404;
        return {
            error: {
                code: 'NET_NOT_FOUND',
                message: 'Net not found'
            }
        };
    }

    return { net: toNetPayload(net, user.userId) };
};