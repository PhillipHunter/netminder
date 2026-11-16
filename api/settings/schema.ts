import { t } from 'elysia';

export { errorResponse } from '../common/errors';
export type { ErrorResponse } from '../common/errors';

export const qrzModeSchema = t.Union([t.Literal('per_user'), t.Literal('global')], {
    description: 'Who supplies QRZ credentials: each user (per_user) or the shared global account (global)',
    examples: ['per_user']
});

export const qrzStatusSchema = t.Object({
    mode: qrzModeSchema,
    username: t.Nullable(t.String({ description: 'Username stored for the QRZ integration if configured' })),
    configured: t.Boolean({ description: 'Indicates whether QRZ credentials are currently stored' }),
    updatedAt: t.Nullable(t.String({ description: 'ISO-8601 timestamp of the most recent credential update' })),
    encryptionKeyConfigured: t.Boolean({ description: 'True when CONFIG_ENCRYPTION_KEY is available for credential storage' })
}, { description: 'Current status of the QRZ credential configuration' });

export const qrzStatusResponseSchema = t.Object({ settings: qrzStatusSchema }, { description: 'Response envelope for QRZ settings status' });

export type QRZModeSchema = typeof qrzModeSchema.static;
export type QRZStatusSchema = typeof qrzStatusSchema.static;
export type QRZStatusResponseSchema = typeof qrzStatusResponseSchema.static;