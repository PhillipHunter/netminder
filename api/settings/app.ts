import {
    t,
    type Context,
    type Static
} from 'elysia';

import {
    getMobilityEnabled,
    setMobilityEnabled
} from '@netminder/dal';

import {
    appConfigResponseSchema,
    errorResponse
} from '../config/schema';

export const updateAppContract = {
    body: t.Object({
        mobility_enabled: t.Boolean({
            description: 'Enable or disable check-in mobility tracking; stored mobility values are kept when disabled',
            examples: [true]
        })
    }, { description: 'Instance-wide application settings' }),
    detail: {
        summary: 'Update application settings',
        description: 'Updates instance-wide application settings. When mobility tracking is disabled, new check-ins save as neither and existing mobility values are preserved.',
        tags: ['Settings'] as string[]
    },
    response: {
        200: appConfigResponseSchema,
        500: errorResponse
    }
} as const;

export type UpdateAppBody = Static<typeof updateAppContract.body>;
export type UpdateAppResponse = Static<typeof updateAppContract.response[200]>;
export type UpdateAppErrorResponse = Static<typeof updateAppContract.response[500]>;

interface UpdateAppContext {
    body: UpdateAppBody;
    set: Context['set'];
}

export const updateAppHandler = ({ body, set }: UpdateAppContext): UpdateAppResponse | UpdateAppErrorResponse => {
    try {
        setMobilityEnabled(body.mobility_enabled);
        return { config: { mobility_enabled: getMobilityEnabled() } };
    } catch (error) {
        console.error('Error updating app settings:', error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to update application settings.'
            }
        };
    }
};