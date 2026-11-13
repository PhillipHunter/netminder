import { t } from 'elysia';

import { userSchema } from '../users/schema';

export const setupStatusSchema = t.Object({
    needs_setup: t.Boolean(),
    user_count: t.Number()
});

export const userResponseSchema = t.Object({ user: userSchema });

export const loginResponseSchema = t.Object({
    token: t.String(),
    user: userSchema
});

export const logoutResponseSchema = t.Object({ success: t.Boolean() });

export type SetupStatusSchema = typeof setupStatusSchema.static;
export type UserResponseSchema = typeof userResponseSchema.static;
export type LoginResponseSchema = typeof loginResponseSchema.static;
export type LogoutResponseSchema = typeof logoutResponseSchema.static;