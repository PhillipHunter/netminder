import type {
    Context,
    Elysia,
    RouteSchema
} from 'elysia';

import { verifyTokenFromHeaders } from './tokens';

export interface AuthUser {
    userId: number;
    username: string;
    isAdmin: boolean;
}

export type AuthenticatedContext<Route extends RouteSchema = RouteSchema> = Context<Route> & {
    user?: AuthUser | null;
};

export function getAuthUserFromHeaders(headers: { authorization?: string | null; cookie?: string | null }): AuthUser | null {
    const payload = verifyTokenFromHeaders(headers);

    if (!payload) {
        return null;
    }

    return {
        userId: payload.userId,
        username: payload.username,
        isAdmin: payload.isAdmin
    };
}

function buildUserFromPayload(payload: { userId: number; username: string; isAdmin: boolean }): AuthUser {
    return {
        userId: payload.userId,
        username: payload.username,
        isAdmin: payload.isAdmin
    };
}

export const requireAuth = (app: Elysia): Elysia => {
    const extended = app
        .derive(({ headers }): { user: AuthUser | null } => {
            const payload = verifyTokenFromHeaders(headers);
            if (!payload) {
                return { user: null };
            }

            return { user: buildUserFromPayload(payload) };
        })
        .onBeforeHandle((context) => {
            const { user, set } = context as AuthenticatedContext;
            if (!user) {
                set.status = 401;
                return {
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Missing or invalid Authorization header'
                    }
                };
            }
        });

    return extended as unknown as Elysia;
};

export const requireAdmin = (app: Elysia): Elysia => {
    const extended = app
        .use(requireAuth)
        .onBeforeHandle((context) => {
            const { user, set } = context as AuthenticatedContext;
            if (!user) {
                set.status = 401;
                return {
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required'
                    }
                };
            }

            if (!user.isAdmin) {
                set.status = 403;
                return {
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Admin access required'
                    }
                };
            }
        });

    return extended as unknown as Elysia;
};