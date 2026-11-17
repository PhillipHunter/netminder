import {
    t,
    type Context,
    type Static
} from 'elysia';

import {
    SettingsServiceError,
    clearQRZSessionCache
} from '@netminder/core';
import {
    getQRZCredentialMode,
    setQRZCredentialMode
} from '@netminder/dal';

import {
    errorResponse,
    qrzModeSchema
} from './schema';

export const updateModeContract = {
    body: t.Object({ mode: qrzModeSchema }, { description: 'Credential mode to activate for QRZ lookups' }),
    detail: {
        summary: 'Update QRZ credential mode',
        description: 'Switches QRZ lookups between per-user credentials and the shared global credentials.',
        tags: ['Settings'] as string[]
    },
    response: {
        200: t.Object({ mode: qrzModeSchema }, { description: 'Credential mode now in effect' }),
        500: errorResponse
    }
} as const;

export type UpdateModeBody = Static<typeof updateModeContract.body>;
export type UpdateModeResponse = Static<typeof updateModeContract.response[200]>;
export type UpdateModeErrorResponse = Static<typeof updateModeContract.response[500]>;

interface UpdateModeContext {
    body: UpdateModeBody;
    set: Context['set'];
}

export const updateModeHandler = ({ body, set }: UpdateModeContext): UpdateModeResponse | UpdateModeErrorResponse => {
    try {
        setQRZCredentialMode(body.mode);
        clearQRZSessionCache();
        return { mode: getQRZCredentialMode() };
    } catch (error) {
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

        console.error('Error updating QRZ credential mode:', error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to update QRZ credential mode.'
            }
        };
    }
};