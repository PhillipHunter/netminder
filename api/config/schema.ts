import { t } from 'elysia';

export { errorResponse } from '../common/errors';
export type { ErrorResponse } from '../common/errors';

export const appConfigSchema = t.Object({
    mobility_enabled: t.Boolean({ description: 'Whether check-in mobility tracking (fixed, mobile, portable) is enabled for this instance' }),
    geocoding_enabled: t.Boolean({ description: 'Whether station street addresses are geocoded with OpenStreetMap Nominatim' })
}, { description: 'Non-secret instance settings needed by the client' });

export const appConfigResponseSchema = t.Object({ config: appConfigSchema }, { description: 'Response envelope for instance configuration' });

export const clientConfigSchema = t.Object({
    mobility_enabled: t.Boolean({ description: 'Whether check-in mobility tracking (fixed, mobile, portable) is enabled for this instance' }),
    geocoding_enabled: t.Boolean({ description: 'Whether station street addresses are geocoded with OpenStreetMap Nominatim' }),
    carto_api_key: t.Nullable(t.String({ description: 'CARTO basemaps API key for the dark map, or null when none is set. Sent to every signed-in user because it appears in tile URLs.' }))
}, { description: 'Non-secret instance settings needed by the client' });

export const clientConfigResponseSchema = t.Object({ config: clientConfigSchema }, { description: 'Response envelope for instance configuration' });

export type AppConfigSchema = typeof appConfigSchema.static;
export type AppConfigResponseSchema = typeof appConfigResponseSchema.static;
export type ClientConfigSchema = typeof clientConfigSchema.static;
export type ClientConfigResponseSchema = typeof clientConfigResponseSchema.static;