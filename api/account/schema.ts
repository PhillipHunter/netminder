import { t } from 'elysia';

import { qrzModeSchema } from '../settings/schema';

export { errorResponse } from '../common/errors';
export type { ErrorResponse } from '../common/errors';

export const accountQrzStatusSchema = t.Object({
    mode: qrzModeSchema,
    username: t.Nullable(t.String({ description: 'QRZ username stored for the current user if configured' })),
    configured: t.Boolean({ description: 'Indicates whether the current user has stored QRZ credentials' }),
    updatedAt: t.Nullable(t.String({ description: 'ISO-8601 timestamp of the most recent credential update' })),
    encryptionKeyConfigured: t.Boolean({ description: 'True when CONFIG_ENCRYPTION_KEY is available for credential storage' })
}, { description: 'Current status of the signed-in user\'s QRZ credentials' });

export const accountQrzStatusResponseSchema = t.Object({ settings: accountQrzStatusSchema }, { description: 'Response envelope for the user\'s QRZ credential status' });

export const accountQrzTestResponseSchema = t.Object({
    valid: t.Boolean({ description: 'True when QRZ accepted the stored credentials' }),
    message: t.Optional(t.String({ description: 'QRZ error message when the credentials were rejected' }))
}, { description: 'Result of re-verifying the stored QRZ credentials' });

export type AccountQrzStatusSchema = typeof accountQrzStatusSchema.static;
export type AccountQrzStatusResponseSchema = typeof accountQrzStatusResponseSchema.static;
export type AccountQrzTestResponseSchema = typeof accountQrzTestResponseSchema.static;