import {
    t,
    type Context,
    type Static
} from 'elysia';

import {
    countAdmins,
    findUserByUsername,
    insertUser
} from '@netminder/dal';

import { hashPassword } from '../auth/passwords';
import {
    errorResponse,
    type ErrorResponse
} from '../common/errors';

import { generateTemporaryPassword } from './passwords';
import { userSchema } from './schema';

const SALT_ROUNDS = 12;

export const createContract = {
    body: t.Object({
        username: t.String({
            description: 'Unique username assigned to the operator',
            examples: ['operator1']
        }),
        full_name: t.String({
            description: 'Full name of the operator',
            examples: ['Jordan Smith']
        }),
        is_admin: t.Optional(t.Boolean({ description: 'Flag indicating whether the user should have administrator privileges; only one admin is allowed' }))
    }, { description: 'Payload required to create a new user within the system' }),
    detail: {
        summary: 'Create user',
        description: 'Creates a new user account and optionally promotes them to administrator if no admin exists.',
        tags: ['Users'] as string[]
    },
    response: {
        201: t.Object({
            user: userSchema,
            temporary_password: t.String({ description: 'System-generated password that the operator must change on first login.' })
        }, { description: 'Created user resource along with the temporary password assigned to the operator' }),
        400: errorResponse,
        409: errorResponse
    }
} as const;

export type CreateBody = Static<typeof createContract.body>;
export type CreateResponse = Static<typeof createContract.response[201]>;

interface CreateContext {
    body: CreateBody;
    set: Context['set'];
}

export const createHandler = async ({
    body,
    set
}: CreateContext): Promise<CreateResponse | ErrorResponse> => {
    const username = body.username.trim();
    const fullName = body.full_name.trim();
    const isAdmin = body.is_admin ?? false;

    if (username.length === 0) {
        set.status = 400;
        return {
            error: {
                code: 'INVALID_INPUT',
                message: 'Username is required and cannot be empty'
            }
        };
    }

    if (fullName.length === 0) {
        set.status = 400;
        return {
            error: {
                code: 'INVALID_INPUT',
                message: 'Full name is required and cannot be empty'
            }
        };
    }

    if (findUserByUsername(username)) {
        set.status = 409;
        return {
            error: {
                code: 'USERNAME_TAKEN',
                message: `Username "${username}" is already taken`
            }
        };
    }

    if (isAdmin) {
        const adminCount = countAdmins();
        if (adminCount > 0) {
            set.status = 400;
            return {
                error: {
                    code: 'ADMIN_EXISTS',
                    message: 'An admin user already exists. Only one admin is allowed.'
                }
            };
        }
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword, SALT_ROUNDS);
    const user = insertUser({
        username,
        full_name: fullName,
        password_hash: passwordHash,
        must_change_password: true,
        is_admin: isAdmin
    });

    set.status = 201;
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
        },
        temporary_password: temporaryPassword
    };
};