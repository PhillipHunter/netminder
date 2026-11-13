import { type Context } from 'elysia';

import { buildExpiredCookie } from './cookies';
import {
    logoutResponseSchema,
    type LogoutResponseSchema
} from './schema';

export const logoutContract = {
    detail: {
        summary: 'End current session',
        description: 'Clears the authentication cookie to terminate the active session.',
        tags: ['Auth'] as string[]
    },
    response: { 200: logoutResponseSchema }
} as const;

export type LogoutResponse = LogoutResponseSchema;
interface LogoutContext {
    set: Context['set'];
    request: Context['request'];
}

export const logoutHandler = ({ set, request }: LogoutContext): LogoutResponse => {
    set.headers['Set-Cookie'] = buildExpiredCookie(request);

    return { success: true };
};