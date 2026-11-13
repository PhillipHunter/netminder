import { type Context } from 'elysia';

import { findUserById } from '@netminder/dal';

import {
    errorResponse,
    type ErrorResponse
} from '../common/errors';

import type { AuthUser } from './middleware';
import {
    userResponseSchema,
    type UserResponseSchema
} from './schema';

export const meContract = {
    detail: {
        summary: 'Fetch current authenticated user',
        description: 'Returns the authenticated operator derived from the session token.',
        tags: ['Auth'] as string[]
    },
    response: {
        200: userResponseSchema,
        401: errorResponse,
        500: errorResponse
    }
} as const;

export type MeResponse = UserResponseSchema;

interface MeContext {
    user?: AuthUser | null;
    set: Context['set'];
}

export const meHandler = ({
    user,
    set
}: MeContext): MeResponse | ErrorResponse => {
    if (!user) {
        set.status = 401;
        return {
            error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required'
            }
        };
    }

    try {
        const dbUser = findUserById(user.userId);

        if (!dbUser) {
            set.status = 401;
            return {
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User no longer exists'
                }
            };
        }

        return {
            user: {
                id: dbUser.id,
                username: dbUser.username,
                full_name: dbUser.full_name,
                is_admin: dbUser.is_admin,
                must_change_password: dbUser.must_change_password,
                last_login_at: dbUser.last_login_at,
                created_at: dbUser.created_at,
                updated_at: dbUser.updated_at
            }
        };
    } catch (error) {
        console.error('Error fetching current user:', error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch user'
            }
        };
    }
};