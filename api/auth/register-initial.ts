import {
    t,
    type Context
} from 'elysia';

import {
    countUsers,
    findUserByUsername,
    insertUser
} from '@netminder/dal';

import {
    errorResponse,
    type ErrorResponse
} from '../common/errors';

import { hashPassword } from './passwords';
import {
    userResponseSchema,
    type UserResponseSchema
} from './schema';

const REGISTER_BODY = t.Object({
    username: t.String({
        description: 'Desired username for the first administrator account',
        examples: ['netcontrol']
    }),
    password: t.String({
        description: 'Plain text password used to bootstrap the administrator; must meet minimum length requirements',
        examples: ['correct horse battery staple']
    })
}, { description: 'Initial administrator credentials required to complete first-time setup' });

export const registerInitialContract = {
    body: REGISTER_BODY,
    detail: {
        summary: 'Create initial administrator account',
        description: 'Bootstraps the system by creating the first administrator when no users exist.',
        tags: ['Auth'] as string[]
    },
    response: {
        200: userResponseSchema,
        400: errorResponse,
        403: errorResponse,
        409: errorResponse,
        500: errorResponse
    }
} as const;

export type RegisterInitialBody = typeof REGISTER_BODY.static;
export type RegisterInitialResponse = UserResponseSchema;
interface RegisterInitialContext {
    body: RegisterInitialBody;
    set: Context['set'];
}

export const registerInitialHandler = async ({ body, set }: RegisterInitialContext): Promise<RegisterInitialResponse | ErrorResponse> => {
    const username = body.username.trim();
    const password = body.password;

    if (username.length === 0) {
        set.status = 400;
        return {
            error: {
                code: 'INVALID_INPUT',
                message: 'Username is required and cannot be empty'
            }
        };
    }

    if (password.length < 8) {
        set.status = 400;
        return {
            error: {
                code: 'INVALID_INPUT',
                message: 'Password must be at least 8 characters long'
            }
        };
    }

    try {
        const userCount = countUsers();
        if (userCount > 0) {
            set.status = 403;
            return {
                error: {
                    code: 'USERS_EXIST',
                    message: 'Cannot register initial user when users already exist'
                }
            };
        }

        if (findUserByUsername(username)) {
            set.status = 409;
            return {
                error: {
                    code: 'USERNAME_EXISTS',
                    message: 'Username already exists'
                }
            };
        }

        const passwordHash = await hashPassword(password, 12);

        const user = insertUser({
            username,
            full_name: username,
            password_hash: passwordHash,
            must_change_password: false,
            is_admin: true,
            last_login_at: null
        });

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
    } catch (error) {
        console.error('Error creating initial admin user:', error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to create user'
            }
        };
    }
};