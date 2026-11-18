import {
    t,
    type Context,
    type Static
} from 'elysia';

import {
    getGeocodingEnabled,
    getGeocodingStatus,
    getMobilityEnabled,
    setGeocodingEnabled,
    setMobilityEnabled,
    startGeocodingBackfill
} from '@netminder/dal';

import {
    appConfigSchema,
    errorResponse
} from '../config/schema';

const geocodingStatusSchema = t.Object({
    geocoded: t.Integer({ description: 'Stations with a geocoded street-address position' }),
    no_match: t.Integer({ description: 'Stations geocoded without an acceptable match; not retried until the address changes' }),
    pending: t.Integer({ description: 'Stations with a street address that still need geocoding' })
}, { description: 'Geocoding progress counts' });

const adminAppConfigResponseSchema = t.Object({
    config: appConfigSchema,
    geocoding_status: geocodingStatusSchema
}, { description: 'Instance settings plus geocoding progress, for administrators' });

const buildAdminConfig = (): Static<typeof adminAppConfigResponseSchema> => ({
    config: {
        mobility_enabled: getMobilityEnabled(),
        geocoding_enabled: getGeocodingEnabled()
    },
    geocoding_status: getGeocodingStatus()
});

export const getAppContract = {
    detail: {
        summary: 'Get application settings',
        description: 'Returns instance-wide application settings along with geocoding progress counts.',
        tags: ['Settings'] as string[]
    },
    response: {
        200: adminAppConfigResponseSchema,
        500: errorResponse
    }
} as const;

export type GetAppResponse = Static<typeof getAppContract.response[200]>;
export type GetAppErrorResponse = Static<typeof getAppContract.response[500]>;

interface GetAppContext { set: Context['set'] }

export const getAppHandler = ({ set }: GetAppContext): GetAppResponse | GetAppErrorResponse => {
    try {
        return buildAdminConfig();
    } catch (error) {
        console.error('Error fetching app settings:', error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch application settings.'
            }
        };
    }
};

export const updateAppContract = {
    body: t.Object({
        mobility_enabled: t.Optional(t.Boolean({
            description: 'Enable or disable check-in mobility tracking; stored mobility values are kept when disabled',
            examples: [true]
        })),
        geocoding_enabled: t.Optional(t.Boolean({
            description: 'Enable or disable geocoding of station street addresses with OpenStreetMap Nominatim; geocoded positions already saved are kept when disabled',
            examples: [false]
        }))
    }, { description: 'Instance-wide application settings; only the fields provided are changed' }),
    detail: {
        summary: 'Update application settings',
        description: 'Updates instance-wide application settings. When mobility tracking is disabled, new check-ins save as neither and existing mobility values are preserved. Enabling geocoding sends members\' registered street addresses to the geocoding service and starts a backfill; disabling it stops new requests but keeps saved positions.',
        tags: ['Settings'] as string[]
    },
    response: {
        200: adminAppConfigResponseSchema,
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
        if (body.mobility_enabled !== undefined) {
            setMobilityEnabled(body.mobility_enabled);
        }

        if (body.geocoding_enabled !== undefined) {
            setGeocodingEnabled(body.geocoding_enabled);
            if (body.geocoding_enabled) {
                startGeocodingBackfill();
            }
        }

        return buildAdminConfig();
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