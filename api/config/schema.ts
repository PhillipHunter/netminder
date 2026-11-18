import { t } from 'elysia';

export { errorResponse } from '../common/errors';
export type { ErrorResponse } from '../common/errors';

export const appConfigSchema = t.Object({
    mobility_enabled: t.Boolean({ description: 'Whether check-in mobility tracking (fixed, mobile, portable) is enabled for this instance' }),
    geocoding_enabled: t.Boolean({ description: 'Whether station street addresses are geocoded with OpenStreetMap Nominatim' })
}, { description: 'Non-secret instance settings needed by the client' });

export const appConfigResponseSchema = t.Object({ config: appConfigSchema }, { description: 'Response envelope for instance configuration' });

export type AppConfigSchema = typeof appConfigSchema.static;
export type AppConfigResponseSchema = typeof appConfigResponseSchema.static;