import {
    t,
    type Context
} from 'elysia';

import {
    findUserWithPasswordByUsername,
    updateUserRecord
} from '@netminder/dal';

import {
    errorResponse,
    type ErrorResponse
} from '../common/errors';

import { buildAuthCookie } from './cookies';
import { comparePassword } from './passwords';
import {
    loginResponseSchema,
    type LoginResponseSchema
} from './schema';
import { signToken } from './tokens';

const LOGIN_BODY = t.Object({
    username: t.String({
        description: 'Unique username assigned to the operator',
        examples: ['netcontrol']
    }),
    password: t.String({
        description: 'Plain text password to authenticate the operator',
        examples: ['correct horse battery staple']
    })
}, { description: 'Credentials required to authenticate a user session' });

export const loginContract = {
    body: LOGIN_BODY,
    detail: {
        summary: 'Authenticate user and return a session token',
        description: 'Validates provided credentials and establishes an authenticated session for the operator.',
        tags: ['Auth'] as string[]
    },
    response: {
        200: loginResponseSchema,
        400: errorResponse,
        401: errorResponse,
        500: errorResponse
    }
} as const;

export type LoginBody = typeof LOGIN_BODY.static;
export type LoginResponse = LoginResponseSchema;
interface LoginContext {
    body: LoginBody;
    set: Context['set'];
    request: Context['request'];
}

export const loginHandler = async ({ body, set, request }: LoginContext): Promise<LoginResponse | ErrorResponse> => {
    const username = body.username.trim();
    const password = body.password;

    if (username.length === 0 || password.length === 0) {
        set.status = 400;
        return {
            error: {
                code: 'INVALID_INPUT',
                message: 'Username and password are required'
            }
        };
    }

    try {
        const user = findUserWithPasswordByUsername(username);
        if (!user) {
            set.status = 401;
            return {
                error: {
                    code: 'INVALID_CREDENTIALS',
                    message: 'Invalid username or password'
                }
            };
        }

        const isValid = await comparePassword(password, user.password_hash);
        if (!isValid) {
            set.status = 401;
            return {
                error: {
                    code: 'INVALID_CREDENTIALS',
                    message: 'Invalid username or password'
                }
            };
        }

        const updatedUser = updateUserRecord(user.id, { last_login_at: new Date().toISOString() });
        if (!updatedUser) {
            set.status = 500;
            return {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to update user login state'
                }
            };
        }

        const token = signToken(updatedUser.id, updatedUser.username, updatedUser.is_admin);
        set.headers['Set-Cookie'] = buildAuthCookie(token, request);

        return {
            token,
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                full_name: updatedUser.full_name,
                is_admin: updatedUser.is_admin,
                must_change_password: updatedUser.must_change_password,
                last_login_at: updatedUser.last_login_at,
                created_at: updatedUser.created_at,
                updated_at: updatedUser.updated_at
            }
        };
    } catch (error) {
        console.error('Error during login:', error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Login failed'
            }
        };
    }
};