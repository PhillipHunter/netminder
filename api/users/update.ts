import {
    t,
    type Context,
    type Static
} from 'elysia';

import {
    countAdmins,
    findUserById,
    findUserByUsername,
    updateUserRecord
} from '@netminder/dal';

import type { AuthUser } from '../auth/middleware';
import { hashPassword } from '../auth/passwords';
import {
    errorResponse,
    type ErrorResponse
} from '../common/errors';
import { parsePositiveInt } from '../common/validation';

import { userSchema } from './schema';

const SALT_ROUNDS = 12;

export const updateContract = {
    params: t.Object({
        id: t.String({
            description: 'Identifier of the user to update',
            examples: ['42']
        })
    }, { description: 'Route parameters identifying the user being modified' }),
    body: t.Object({
        username: t.Optional(t.String({
            description: 'New unique username for the user',
            examples: ['operator2']
        })),
        full_name: t.Optional(t.String({
            description: 'Updated full name for the user',
            examples: ['Casey Operator']
        })),
        password: t.Optional(t.String({
            description: 'New password for the user; only the account owner may update their password directly',
            examples: ['correct horse battery staple']
        })),
        is_admin: t.Optional(t.Boolean({ description: 'Set to true to promote to admin or false to demote' }))
    }, { description: 'Fields that can be updated on the user record' }),
    detail: {
        summary: 'Update user',
        description: 'Modifies user attributes, enforcing uniqueness and admin safety rules.',
        tags: ['Users'] as string[]
    },
    response: {
        200: t.Object({ user: userSchema }, { description: 'Updated user resource' }),
        400: errorResponse,
        403: errorResponse,
        404: errorResponse,
        409: errorResponse
    }
} as const;

export type UpdateParams = Static<typeof updateContract.params>;
export type UpdateBody = Static<typeof updateContract.body>;
export type UpdateResponse = Static<typeof updateContract.response[200]>;

interface UpdateContext {
    params: UpdateParams;
    body: UpdateBody;
    set: Context['set'];
    user?: AuthUser | null;
}

export const updateHandler = async ({
    params,
    body,
    set,
    user
}: UpdateContext): Promise<UpdateResponse | ErrorResponse> => {
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

    const existingUser = findUserById(id);
    if (!existingUser) {
        set.status = 404;
        return {
            error: {
                code: 'USER_NOT_FOUND',
                message: `User with id ${id} not found`
            }
        };
    }

    const updates: {
        username?: string;
        is_admin?: boolean;
        full_name?: string;
        password_hash?: string;
        must_change_password?: boolean;
    } = {};

    if (body.username !== undefined) {
        const trimmed = body.username.trim();
        if (trimmed.length === 0) {
            set.status = 400;
            return {
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Username is required and cannot be empty'
                }
            };
        }

        if (trimmed !== existingUser.username) {
            const userWithUsername = findUserByUsername(trimmed);
            if (userWithUsername) {
                set.status = 409;
                return {
                    error: {
                        code: 'USERNAME_TAKEN',
                        message: `Username "${trimmed}" is already taken`
                    }
                };
            }
        }

        updates.username = trimmed;
    }

    if (body.full_name !== undefined) {
        const trimmedName = body.full_name.trim();
        if (trimmedName.length === 0) {
            set.status = 400;
            return {
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Full name is required and cannot be empty'
                }
            };
        }

        updates.full_name = trimmedName;
    }

    if (body.password !== undefined) {
        if (body.password.length < 8) {
            set.status = 400;
            return {
                error: {
                    code: 'WEAK_PASSWORD',
                    message: 'Password must be at least 8 characters long'
                }
            };
        }

        if (!user || user.userId !== id) {
            set.status = 403;
            return {
                error: {
                    code: 'FORBIDDEN',
                    message: 'Only the account owner can change their password from this screen'
                }
            };
        }

        updates.password_hash = await hashPassword(body.password, SALT_ROUNDS);
        updates.must_change_password = false;
    }

    if (body.is_admin !== undefined) {
        const currentAdminCount = countAdmins();
        const targetAdmin = body.is_admin;

        if (targetAdmin && !existingUser.is_admin) {
            if (currentAdminCount > 0) {
                set.status = 400;
                return {
                    error: {
                        code: 'ADMIN_EXISTS',
                        message: 'An admin user already exists. Only one admin is allowed.'
                    }
                };
            }
        }

        if (!targetAdmin && existingUser.is_admin) {
            if (currentAdminCount <= 1) {
                set.status = 400;
                return {
                    error: {
                        code: 'LAST_ADMIN',
                        message: 'Cannot demote the only admin user. Promote another user to admin first.'
                    }
                };
            }
        }

        updates.is_admin = targetAdmin;
    }

    const updatedUser = updateUserRecord(id, updates);
    if (!updatedUser) {
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to update user'
            }
        };
    }

    return {
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
};