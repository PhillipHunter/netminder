import {
    t,
    type Context,
    type Static
} from 'elysia';

import {
    findUserWithPasswordById,
    updateUserRecord
} from '@netminder/dal';

import {
    errorResponse,
    type ErrorResponse
} from '../common/errors';

import type { AuthUser } from './middleware';
import {
    comparePassword,
    hashPassword
} from './passwords';
import {
    userResponseSchema,
    type UserResponseSchema
} from './schema';

const BODY = t.Object({
    current_password: t.String({
        description: 'Existing password for the authenticated user',
        examples: ['temporaryPass123!']
    }),
    new_password: t.String({
        description: 'Replacement password that must be at least eight characters long',
        examples: ['MuchStrongerPassword!']
    })
}, { description: 'Request payload required to rotate the authenticated user password' });

export const changePasswordContract = {
    body: BODY,
    detail: {
        summary: 'Change authenticated user password',
        description: 'Validates the current password, applies the new secret, and clears the password reset requirement.',
        tags: ['Auth'] as string[]
    },
    response: {
        200: userResponseSchema,
        400: errorResponse,
        401: errorResponse,
        500: errorResponse
    }
} as const;

export type ChangePasswordBody = Static<typeof BODY>;
export type ChangePasswordResponse = UserResponseSchema;

interface ChangePasswordContext {
    body: ChangePasswordBody;
    user?: AuthUser | null;
    set: Context['set'];
}

const MIN_PASSWORD_LENGTH = 8;

export const changePasswordHandler = async ({
    body,
    user,
    set
}: ChangePasswordContext): Promise<ChangePasswordResponse | ErrorResponse> => {
    if (!user) {
        set.status = 401;
        return {
            error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required'
            }
        };
    }

    const currentPassword = body.current_password;
    const newPassword = body.new_password;

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
        set.status = 400;
        return {
            error: {
                code: 'INVALID_INPUT',
                message: 'New password must be at least 8 characters long'
            }
        };
    }

    try {
        const dbUser = findUserWithPasswordById(user.userId);

        if (!dbUser) {
            set.status = 401;
            return {
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User no longer exists'
                }
            };
        }

        const matches = await comparePassword(currentPassword, dbUser.password_hash);
        if (!matches) {
            set.status = 400;
            return {
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Current password is incorrect'
                }
            };
        }

        const passwordHash = await hashPassword(newPassword);
        const updatedUser = updateUserRecord(dbUser.id, {
            password_hash: passwordHash,
            must_change_password: false
        });

        if (!updatedUser) {
            throw new Error(`Failed to update password for user ${dbUser.id}`);
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
    } catch (error) {
        console.error(`Failed to change password for user ${user.userId}:`, error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to change password'
            }
        };
    }
};