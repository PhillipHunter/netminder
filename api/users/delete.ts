import {
    t,
    type Context,
    type Static
} from 'elysia';

import {
    deleteUserRecord,
    findUserById
} from '@netminder/dal';

import {
    errorResponse,
    type ErrorResponse
} from '../common/errors';
import { parsePositiveInt } from '../common/validation';

export const deleteContract = {
    params: t.Object({
        id: t.String({
            description: 'Identifier of the user to delete',
            examples: ['42']
        })
    }, { description: 'Route parameters identifying the target user' }),
    detail: {
        summary: 'Delete user',
        description: 'Removes a user account. Safeguards prevent deleting the last or current admin.',
        tags: ['Users'] as string[]
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

export const deleteHandler = ({
    params,
    set
}: DeleteContext): ErrorResponse | undefined => {
    const id = parsePositiveInt(params.id);

    if (id === null) {
        set.status = 400;
        return {
            error: {
                code: 'INVALID_INPUT',
                message: 'Invalid user ID'
            }
        };
    }

    const targetUser = findUserById(id);
    if (!targetUser) {
        set.status = 404;
        return {
            error: {
                code: 'USER_NOT_FOUND',
                message: `User with id ${id} not found`
            }
        };
    }

    if (targetUser.is_admin) {
        set.status = 400;
        return {
            error: {
                code: 'ADMIN_UNDELETABLE',
                message: 'The administrator account cannot be deleted.'
            }
        };
    }

    const deleted = deleteUserRecord(id);
    if (!deleted) {
        set.status = 404;
        return {
            error: {
                code: 'USER_NOT_FOUND',
                message: `User with id ${id} not found`
            }
        };
    }

    set.status = 204;
    return undefined;
};