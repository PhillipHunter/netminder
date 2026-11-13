import {
    t,
    type Context,
    type Static
} from 'elysia';

import { findUserById } from '@netminder/dal';

import {
    errorResponse,
    type ErrorResponse
} from '../common/errors';
import { parsePositiveInt } from '../common/validation';

import { userSchema } from './schema';

export const getContract = {
    params: t.Object({
        id: t.String({
            description: 'Identifier of the user to retrieve',
            examples: ['42']
        })
    }, { description: 'Route parameters identifying the requested user' }),
    detail: {
        summary: 'Get user',
        description: 'Retrieves a single user record by its identifier.',
        tags: ['Users'] as string[]
    },
    response: {
        200: t.Object({ user: userSchema }, { description: 'User resource matching the requested identifier' }),
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

export const getHandler = ({
    params,
    set
}: GetContext): GetResponse | ErrorResponse => {
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

    const user = findUserById(id);
    if (!user) {
        set.status = 404;
        return {
            error: {
                code: 'USER_NOT_FOUND',
                message: `User with id ${id} not found`
            }
        };
    }

    return {
        user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            is_admin: user.is_admin,
            must_change_password: user.must_change_password,
            last_login_at: user.last_login_at,
            created_at: user.created_at,
            updated_at: user.updated_at
        }
    };
};