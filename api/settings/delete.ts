import {
    t,
    type Context,
    type Static
} from 'elysia';

import {
    SettingsServiceError,
    clearQRZSessionCache
} from '@netminder/core';
import { clearQRZCredentials } from '@netminder/dal';

import { errorResponse } from './schema';

export const deleteContract = {
    detail: {
        summary: 'Clear QRZ credentials',
        description: 'Removes stored QRZ integration credentials and clears any cached sessions.',
        tags: ['Settings'] as string[]
    },
    response: {
        204: t.Void(),
        500: errorResponse
    }
} as const;

export type DeleteResponse = Static<typeof deleteContract.response[204]>;
export type DeleteErrorResponse = Static<typeof deleteContract.response[500]>;

interface DeleteContext { set: Context['set'] }

function toError(value: unknown): Error {
    return value instanceof Error ? value : new Error(String(value));
}

export const deleteHandler = ({ set }: DeleteContext): DeleteErrorResponse | undefined => {
    try {
        clearQRZCredentials();
        clearQRZSessionCache();
        set.status = 204;
        return undefined;
    } catch (unknownError) {
        const error = toError(unknownError);
        if (error instanceof SettingsServiceError) {
            console.error('QRZ settings service error:', error);
            set.status = 500;
            return {
                error: {
                    code: error.code,
                    message: error.message
                }
            };
        }

        console.error('Error clearing QRZ settings:', error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to remove QRZ credentials.'
            }
        };
    }
};