import {
    type Context,
    type Static
} from 'elysia';

import { getQRZSettingsStatus } from '@netminder/dal';

import {
    errorResponse,
    qrzStatusResponseSchema
} from './schema';
import {
    buildStatusResponse,
    isEncryptionKeyAvailable
} from './utils';

export const getContract = {
    detail: {
        summary: 'Get QRZ settings status',
        description: 'Returns the current configuration state for the QRZ integration, including encryption readiness.',
        tags: ['Settings'] as string[]
    },
    response: {
        200: qrzStatusResponseSchema,
        500: errorResponse
    }
} as const;

export type GetResponse = Static<typeof getContract.response[200]>;
export type GetErrorResponse = Static<typeof getContract.response[500]>;

interface GetContext { set: Context['set'] }

export const getHandler = ({ set }: GetContext): GetResponse | GetErrorResponse => {
    try {
        const status = getQRZSettingsStatus();
        const encryptionAvailable = isEncryptionKeyAvailable();
        return buildStatusResponse(status, encryptionAvailable);
    } catch (error) {
        console.error('Error fetching QRZ settings:', error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch QRZ settings.'
            }
        };
    }
};