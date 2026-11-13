import { t } from 'elysia';

export const healthContract = {
    detail: {
        summary: 'Check service status',
        description: 'Returns the current health information for the NetMinder API.',
        tags: ['Health'] as string[]
    },
    response: t.Object({
        status: t.Literal('ok', { description: 'Indicates that the service is operating normally' }),
        timestamp: t.String({
            description: 'ISO-8601 timestamp for when the health check was generated',
            examples: ['2024-01-01T00:00:00.000Z']
        })
    }, { description: 'Standard health check payload' })
} as const;

export type HealthResponse = typeof healthContract.response.static;

export const healthHandler = (): HealthResponse => ({
    status: 'ok',
    timestamp: new Date().toISOString()
});