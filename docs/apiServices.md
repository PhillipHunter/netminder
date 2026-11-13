# API Service Layer Plan

This note expands on **api cleanup item #2**: _“Introduce a slim service layer between handlers and `@netminder/dal` so cross-cutting behaviors (logging, transactions, retries) live in one place instead of repeating try/catch blocks in every route.”_ The examples below outline how the service layer would look in practice.

## Guiding Principles
- Keep route handlers focused on HTTP concerns (validation, status codes, response shapes).
- Centralize DAL access and shared policies (logging, transactions, retries) in service functions.
- Provide a common utility context so new cross-cutting behavior can be added once.
- Re-export services from `api/services/index.ts` for consistent import paths and testability.

## Shared Context

```ts
// api/services/context.ts
import { db } from '@netminder/dal';

export interface ServiceContext {
    logger: Pick<typeof console, 'debug' | 'info' | 'warn' | 'error'>;
    runInTransaction<T>(fn: () => Promise<T>): Promise<T>;
}

export const defaultServiceContext = (): ServiceContext => ({
    logger: console,
    runInTransaction: async <T>(fn: () => Promise<T>) => db.transaction(fn)
});
```

Handlers can call `defaultServiceContext()` (or inject a custom implementation in tests) to get consistent logging and transaction behavior without touching DAL primitives directly.

## Example: Station Updates

```ts
// api/services/stations/updateStation.ts
import {
    getStationDetail,
    renameStation,
    updateStationProfile
} from '@netminder/dal';
import type { ServiceContext } from '../context';
import { mapStationDetail } from '../../stations/utils';

export type UpdateStationInput = {
    callsign: string;
    newCallsign?: string;
    profile?: {
        preferred_name?: string | null;
        location?: string | null;
        notes?: string | null;
    };
};

export type UpdateStationResult =
    | { status: 'ok'; station: ReturnType<typeof mapStationDetail> }
    | { status: 'not_found'; code: 'STATION_NOT_FOUND' }
    | { status: 'conflict'; code: 'CALLSIGN_CONFLICT'; conflictingCallsign: string }
    | { status: 'error'; code: 'INTERNAL_ERROR'; cause: unknown };

export async function updateStation(
    ctx: ServiceContext,
    input: UpdateStationInput
): Promise<UpdateStationResult> {
    try {
        return await ctx.runInTransaction(async () => {
            ctx.logger.debug('[station.update]', { input });

            const normalized = input.callsign.trim().toUpperCase();
            let effectiveCallsign = normalized;

            if (input.newCallsign) {
                const renameResult = await renameStation(normalized, input.newCallsign);
                if (renameResult.status === 'not_found') {
                    return { status: 'not_found', code: 'STATION_NOT_FOUND' } as const;
                }
                if (renameResult.status === 'conflict') {
                    return {
                        status: 'conflict',
                        code: 'CALLSIGN_CONFLICT',
                        conflictingCallsign: renameResult.conflictingCallsign
                    } as const;
                }
                effectiveCallsign = renameResult.station.callsign;
            }

            if (input.profile) {
                const updated = await updateStationProfile(effectiveCallsign, input.profile);
                if (!updated) {
                    return { status: 'not_found', code: 'STATION_NOT_FOUND' } as const;
                }
            }

            const detail = await getStationDetail(effectiveCallsign);
            if (!detail) {
                ctx.logger.error('[station.update] missing detail post-update', {
                    callsign: effectiveCallsign
                });
                return { status: 'error', code: 'INTERNAL_ERROR', cause: new Error('Detail missing') };
            }

            return { status: 'ok', station: mapStationDetail(detail) } as const;
        });
    } catch (cause) {
        ctx.logger.error('[station.update] unexpected failure', { cause });
        return { status: 'error', code: 'INTERNAL_ERROR', cause };
    }
}
```

```ts
// api/stations/update.ts (handler excerpt)
import { defaultServiceContext } from '../services/context';
import { updateStation } from '../services/stations/updateStation';

export const updateHandler = async ({ params, body, set }: UpdateContext) => {
    const callsign = decodeCallsignParam(params.callsign);
    if (!callsign) {
        set.status = 400;
        return { error: { code: 'INVALID_CALLSIGN', message: 'Callsign parameter is required' } };
    }

    if (body.new_callsign === undefined && !hasProfileUpdates(body)) {
        set.status = 400;
        return {
            error: {
                code: 'INVALID_REQUEST',
                message: 'Request body must contain at least one field to update'
            }
        };
    }

    const result = await updateStation(defaultServiceContext(), {
        callsign,
        newCallsign: body.new_callsign,
        profile: hasProfileUpdates(body)
            ? {
                  preferred_name: body.preferred_name ?? null,
                  location: body.location ?? null,
                  notes: body.notes ?? null
              }
            : undefined
    });

    switch (result.status) {
        case 'ok':
            return { station: result.station };
        case 'not_found':
            set.status = 404;
            return { error: { code: result.code, message: `Station ${callsign} not found` } };
        case 'conflict':
            set.status = 409;
            return {
                error: {
                    code: result.code,
                    message: `Station ${result.conflictingCallsign} already exists`
                }
            };
        default:
            set.status = 500;
            return { error: { code: result.code, message: 'Failed to update station' } };
    }
};
```

## Example: Net Management

```ts
// api/services/nets/manageNet.ts
import {
    endAllActiveNets,
    insertNet,
    updateNetRecord
} from '@netminder/dal';
import type { ServiceContext } from '../context';

export async function createNet(
    ctx: ServiceContext,
    input: { topic?: string | null; endActive?: boolean }
) {
    return ctx.runInTransaction(async () => {
        if (input.endActive) {
            await endAllActiveNets();
        }
        const net = await insertNet(input.topic ?? null);
        ctx.logger.info('[net.create] inserted', { netId: net.id });
        return net;
    });
}

export async function updateNet(
    ctx: ServiceContext,
    input: { id: number; topic?: string | null; ended_at?: string | null }
) {
    return ctx.runInTransaction(async () => {
        const updated = await updateNetRecord(input.id, input);
        return updated ?? null;
    });
}
```

```ts
// api/nets/manage.ts (handler excerpt)
import { createNet, updateNet } from '../services/nets/manageNet';

export const createHandler = ({ body, set }: CreateContext) => {
    const topic = normalizeTopic(body.topic);
    const net = await createNet(defaultServiceContext(), {
        topic,
        endActive: body.end_active
    });
    set.status = 201;
    return { net: toNetSchema(net) };
};

export const updateHandler = async ({ params, body, set }: UpdateContext) => {
    const id = parseId(params);
    if (id === null) {
        set.status = 400;
        return { error: { code: 'INVALID_ID', message: 'Invalid net ID' } };
    }

    const topic = normalizeTopic(body.topic);
    const updated = await updateNet(defaultServiceContext(), {
        id,
        topic,
        ended_at: body.ended_at ?? undefined
    });

    if (!updated) {
        set.status = 404;
        return { error: { code: 'NET_NOT_FOUND', message: 'Net not found' } };
    }

    return { net: toNetSchema(updated) };
};
```

## Example: Check-in Updates

```ts
// api/services/checkins/updateCheckin.ts
import { updateCheckinRecord } from '@netminder/dal';
import type { ServiceContext } from '../context';
import { normalizeMobility, toCheckinPayload } from '../../checkins/schema';

export type UpdateCheckinInput = {
    id: number;
    mobility?: Parameters<typeof normalizeMobility>[0];
    staying?: boolean;
    called_back?: boolean;
    topic_answer?: string | null;
    operator_notes?: string | null;
};

export type UpdateCheckinResult =
    | { status: 'ok'; checkin: ReturnType<typeof toCheckinPayload> }
    | { status: 'not_found'; code: 'CHECKIN_NOT_FOUND' }
    | { status: 'error'; code: 'INTERNAL_ERROR'; cause: unknown };

export async function updateCheckin(
    ctx: ServiceContext,
    input: UpdateCheckinInput
): Promise<UpdateCheckinResult> {
    try {
        return await ctx.runInTransaction(async () => {
            const mobility = input.mobility ? normalizeMobility(input.mobility) : undefined;

            const updated = await updateCheckinRecord(input.id, {
                mobility,
                staying: input.staying,
                called_back: input.called_back,
                topic_answer: input.topic_answer ?? undefined,
                operator_notes: input.operator_notes ?? undefined
            });

            return { status: 'ok', checkin: toCheckinPayload(updated) } as const;
        });
    } catch (cause) {
        if (cause instanceof Error && cause.message === 'Checkin not found') {
            return { status: 'not_found', code: 'CHECKIN_NOT_FOUND' } as const;
        }

        ctx.logger.error('[checkin.update] unexpected failure', { cause });
        return { status: 'error', code: 'INTERNAL_ERROR', cause };
    }
}
```

```ts
// api/checkins/update.ts (handler excerpt)
import { updateCheckin } from '../services/checkins/updateCheckin';

export const updateHandler = async ({ params, body, set }: UpdateContext) => {
    const id = parseId(params);
    if (id === null) {
        set.status = 400;
        return { error: { code: 'INVALID_ID', message: 'Invalid checkin ID' } };
    }

    const result = await updateCheckin(defaultServiceContext(), {
        id,
        mobility: body.mobility,
        staying: body.staying,
        called_back: body.called_back,
        topic_answer: body.topic_answer,
        operator_notes: body.operator_notes
    });

    if (result.status === 'not_found') {
        set.status = 404;
        return { error: { code: result.code, message: 'Checkin not found' } };
    }

    if (result.status === 'error') {
        set.status = 500;
        return { error: { code: result.code, message: 'Failed to update checkin' } };
    }

    return { checkin: result.checkin };
};
```

## Next Steps
- Codify the directory structure (`api/services/<domain>/...`).
- Replace existing handler logic with service calls incrementally (nets, stations, checkins first).
- Capture new cross-cutting needs (metrics, retries) inside `ServiceContext` as the implementation grows.
- Add service-level tests to lock down DAL integration paths and simplify handler testing.
