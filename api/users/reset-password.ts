import {
    t,
    type Context,
    type Static
} from 'elysia';

import {
    findUserById,
    updateUserRecord
} from '@netminder/dal';

import { hashPassword } from '../auth/passwords';
import {
    errorResponse,
    type ErrorResponse
} from '../common/errors';
import { parsePositiveInt } from '../common/validation';

import { generateTemporaryPassword } from './passwords';
import { userSchema } from './schema';

const SALT_ROUNDS = 12;

export const resetPasswordContract = {
    params: t.Object({
        id: t.String({
            description: 'Identifier of the user to reset',
            examples: ['7']
        })
    }, { description: 'Route parameters identifying the user whose password should be reset' }),
    detail: {
        summary: 'Reset user password',
        description: 'Generates a temporary password for the specified user and marks the account to require a password change upon next login.',
        tags: ['Users'] as string[]
    },
    response: {
        200: t.Object({
            user: userSchema,
            temporary_password: t.String({ description: 'New temporary password assigned to the user.' })
        }),
        400: errorResponse,
        404: errorResponse,
        500: errorResponse
    }
} as const;

export type ResetPasswordParams = Static<typeof resetPasswordContract.params>;
export type ResetPasswordResponse = Static<typeof resetPasswordContract.response[200]>;

interface ResetPasswordContext {
    params: ResetPasswordParams;
    set: Context['set'];
}

export const resetPasswordHandler = async ({
    params,
    set
}: ResetPasswordContext): Promise<ResetPasswordResponse | ErrorResponse> => {
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

    try {
        const temporaryPassword = generateTemporaryPassword();
        const passwordHash = await hashPassword(temporaryPassword, SALT_ROUNDS);

        const updatedUser = updateUserRecord(id, {
            password_hash: passwordHash,
            must_change_password: true
        });

        if (!updatedUser) {
            throw new Error(`Failed to update user ${id} during password reset`);
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
            },
            temporary_password: temporaryPassword
        };
    } catch (error) {
        console.error(`Failed to reset password for user ${id}:`, error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to reset password'
            }
        };
    }
};