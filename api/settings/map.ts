import {
    t,
    type Context,
    type Static
} from 'elysia';

import {
    getCartoApiKey,
    setCartoApiKey
} from '@netminder/dal';

import { errorResponse } from './schema';

const CARTO_KEY_PATTERN = /^[A-Za-z0-9._-]{8,200}$/;
const HINT_LENGTH = 4;

export const mapSettingsResponseSchema = t.Object({
    map: t.Object({
        carto_key_set: t.Boolean({ description: 'Whether a CARTO basemaps API key is stored' }),
        carto_key_hint: t.Nullable(t.String({ description: 'Last 4 characters of the stored key, or null when none is set' }))
    }, { description: 'Map settings status' })
}, { description: 'Response envelope for map settings' });

export const getMapContract = {
    detail: {
        summary: 'Get map settings',
        description: 'Returns whether a CARTO basemaps API key is configured, with a hint of its last 4 characters. The key itself is returned only by /api/config.',
        tags: ['Settings'] as string[]
    },
    response: {
        200: mapSettingsResponseSchema,
        500: errorResponse
    }
} as const;

export const updateMapContract = {
    body: t.Object({
        carto_api_key: t.Nullable(t.String({
            description: 'CARTO basemaps API key (8-200 letters, digits, dots, underscores or hyphens). Empty or null removes the stored key.',
            examples: ['abc123XYZ_456']
        }))
    }, { description: 'Instance-wide map settings' }),
    detail: {
        summary: 'Update map settings',
        description: 'Stores or removes the CARTO basemaps API key. When set, dark mode uses CARTO Dark Matter tiles instead of a darkened OpenStreetMap.',
        tags: ['Settings'] as string[]
    },
    response: {
        200: mapSettingsResponseSchema,
        400: errorResponse,
        500: errorResponse
    }
} as const;

export type GetMapResponse = Static<typeof getMapContract.response[200]>;
export type GetMapErrorResponse = Static<typeof getMapContract.response[500]>;
export type UpdateMapBody = Static<typeof updateMapContract.body>;
export type UpdateMapResponse = Static<typeof updateMapContract.response[200]>;
export type UpdateMapErrorResponse = Static<typeof updateMapContract.response[400]>;

function mapStatus(): GetMapResponse {
    const key = getCartoApiKey();
    return {
        map: {
            carto_key_set: key !== null,
            carto_key_hint: key === null ? null : key.slice(-HINT_LENGTH)
        }
    };
}

interface GetMapContext { set: Context['set'] }

export const getMapHandler = ({ set }: GetMapContext): GetMapResponse | GetMapErrorResponse => {
    try {
        return mapStatus();
    } catch (error) {
        console.error('Error fetching map settings:', error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch map settings.'
            }
        };
    }
};

interface UpdateMapContext {
    body: UpdateMapBody;
    set: Context['set'];
}

export const updateMapHandler = ({ body, set }: UpdateMapContext): UpdateMapResponse | UpdateMapErrorResponse => {
    const key = body.carto_api_key?.trim() ?? '';
    if (key !== '' && !CARTO_KEY_PATTERN.test(key)) {
        set.status = 400;
        return {
            error: {
                code: 'VALIDATION_ERROR',
                message: 'CARTO API key must be 8 to 200 characters: letters, digits, dots, underscores or hyphens.'
            }
        };
    }

    try {
        setCartoApiKey(key === '' ? null : key);
        return mapStatus();
    } catch (error) {
        console.error('Error updating map settings:', error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to update map settings.'
            }
        };
    }
};