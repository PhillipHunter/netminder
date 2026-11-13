import { type Context } from 'elysia';

import { countUsers } from '@netminder/dal';

import {
    errorResponse,
    type ErrorResponse
} from '../common/errors';

import {
    setupStatusSchema,
    type SetupStatusSchema
} from './schema';

export const setupCheckContract = {
    detail: {
        summary: 'Check if initial setup is required',
        description: 'Reports whether any users exist and whether the bootstrap admin workflow still needs to run.',
        tags: ['Auth'] as string[]
    },
    response: {
        200: setupStatusSchema,
        500: errorResponse
    }
} as const;

export type SetupCheckResponse = SetupStatusSchema;

interface SetupCheckContext { set: Context['set'] }

export const setupCheckHandler = ({ set }: SetupCheckContext): SetupCheckResponse | ErrorResponse => {
    try {
        const userCount = countUsers();
        return {
            needs_setup: userCount === 0,
            user_count: userCount
        };
    } catch (error) {
        console.error('Error checking setup status:', error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to check setup status'
            }
        };
    }
};