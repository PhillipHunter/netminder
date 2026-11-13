import { t } from 'elysia';

export const userSchema = t.Object({
    id: t.Number(),
    username: t.String(),
    full_name: t.String(),
    is_admin: t.Boolean(),
    must_change_password: t.Boolean(),
    last_login_at: t.Nullable(t.String()),
    created_at: t.String(),
    updated_at: t.String()
});

export type UserSchema = typeof userSchema.static;