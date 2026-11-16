import {
    t,
    type Context,
    type Static
} from 'elysia';

import {
    deleteCheckinRecord,
    findVisibleNetForCheckin
} from '@netminder/dal';

import type { AuthUser } from '../auth/middleware';
import {
    errorResponse,
    unauthorizedResponse,
    type ErrorResponse
} from '../common/errors';
import { parsePositiveInt } from '../common/validation';

export const deleteContract = {
    params: t.Object({
        id: t.String({
            description: 'Identifier of the checkin to remove',
            examples: ['123']
        })
    }, { description: 'Route parameters identifying the checkin targeted for deletion' }),
    detail: {
        summary: 'Delete checkin',
        description: 'Removes a checkin from the specified net.',
        tags: ['Checkins'] as string[]
    },
    response: {
        204: t.Void(),
        400: errorResponse,
        404: errorResponse
    }
} as const;

export type DeleteParams = Static<typeof deleteContract.params>;
export type DeleteResponse = Static<typeof deleteContract.response[204]>;

interface DeleteContext {
    params: DeleteParams;
    user?: AuthUser | null;
    set: Context['set'];
}

function parseId(params: DeleteParams): number | null {
    return parsePositiveInt(params.id);
}

export const deleteHandler = ({ params, user, set }: DeleteContext): ErrorResponse | undefined => {
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
                message: 'Invalid checkin ID'
            }
        };
    }

    if (!findVisibleNetForCheckin(id, user.userId)) {
        set.status = 404;
        return {
            error: {
                code: 'CHECKIN_NOT_FOUND',
                message: 'Checkin not found'
            }
        };
    }

    const deleted = deleteCheckinRecord(id);
    if (!deleted) {
        set.status = 404;
        return {
            error: {
                code: 'CHECKIN_NOT_FOUND',
                message: 'Checkin not found'
            }
        };
    }

    set.status = 204;
    return undefined;
};