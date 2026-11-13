import {
    t,
    type Static
} from 'elysia';

import { listUsers } from '@netminder/dal';

import { userSchema } from './schema';

export const listContract = {
    detail: {
        summary: 'List users',
        description: 'Returns all user accounts sorted by creation order.',
        tags: ['Users'] as string[]
    },
    response: t.Object({ users: t.Array(userSchema, { description: 'Collection of user resources available in the system' }) }, { description: 'Users payload containing all known user accounts' })
} as const;

export type ListResponse = Static<typeof listContract.response>;

export const listHandler = (): ListResponse => {
    const users = listUsers();
    return {
        users: users.map(user => ({
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            is_admin: user.is_admin,
            must_change_password: user.must_change_password,
            last_login_at: user.last_login_at,
            created_at: user.created_at,
            updated_at: user.updated_at
        }))
    };
};