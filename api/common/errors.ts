import { t } from 'elysia';

export const errorResponse = t.Object({
    error: t.Object({
        code: t.String(),
        message: t.String()
    })
});

export type ErrorResponse = typeof errorResponse.static;