import {
    t,
    type Context
} from 'elysia';

import {
    findVisibleNet,
    removeNet
} from '@netminder/dal';

import type { AuthUser } from '../auth/middleware';
import {
    errorResponse,
    unauthorizedResponse,
    type ErrorResponse
} from '../common/errors';
import { requireNetOwner } from '../common/ownership';
import { parsePositiveInt } from '../common/validation';

export const deleteContract = {
    params: t.Object({
        id: t.String({
            description: 'Identifier of the net to delete',
            examples: ['17']
        })
    }, { description: 'Route parameters identifying the net to remove' }),
    detail: {
        summary: 'Delete net',
        description: 'Deletes a net and all associated references. Only the net creator may delete it.',
        tags: ['Nets'] as string[]
    },
    response: {
        204: t.Void(),
        400: errorResponse,
        403: errorResponse,
        404: errorResponse
    }
} as const;

export type DeleteParams = typeof deleteContract.params.static;
export type DeleteResponse = ErrorResponse;
interface DeleteContext {
    params: DeleteParams;
    user?: AuthUser | null;
    set: Context['set'];
}

export const deleteHandler = ({ params, user, set }: DeleteContext): DeleteResponse | undefined => {
    if (!user) {
        set.status = 401;
        return unauthorizedResponse();
    }

    const parsedId = parsePositiveInt(params.id);

    if (parsedId === null) {
        set.status = 400;
        return {
            error: {
                code: 'INVALID_ID',
                message: 'Invalid net ID'
            }
        };
    }

    const existing = findVisibleNet(parsedId, user.userId);
    if (!existing) {
        set.status = 404;
        return {
            error: {
                code: 'NET_NOT_FOUND',
                message: 'Net not found'
            }
        };
    }

    const forbidden = requireNetOwner(existing, user.userId);
    if (forbidden) {
        set.status = 403;
        return forbidden;
    }

    const deleted = removeNet(parsedId);

    if (!deleted) {
        set.status = 404;
        return {
            error: {
                code: 'NET_NOT_FOUND',
                message: 'Net not found'
            }
        };
    }

    set.status = 204;
    return undefined;
};