import {
    t,
    type Context
} from 'elysia';

import { removeNet } from '@netminder/dal';

import {
    errorResponse,
    type ErrorResponse
} from '../common/errors';
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
        description: 'Deletes a net and all associated references.',
        tags: ['Nets'] as string[]
    },
    response: {
        204: t.Void(),
        400: errorResponse,
        404: errorResponse
    }
} as const;

export type DeleteParams = typeof deleteContract.params.static;
export type DeleteResponse = ErrorResponse;
interface DeleteContext {
    params: DeleteParams;
    set: Context['set'];
}

export const deleteHandler = ({ params, set }: DeleteContext): DeleteResponse | undefined => {
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