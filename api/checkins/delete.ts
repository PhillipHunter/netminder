import {
    t,
    type Context,
    type Static
} from 'elysia';

import { deleteCheckinRecord } from '@netminder/dal';

import {
    errorResponse,
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
    set: Context['set'];
}

function parseId(params: DeleteParams): number | null {
    return parsePositiveInt(params.id);
}

export const deleteHandler = ({ params, set }: DeleteContext): ErrorResponse | undefined => {
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