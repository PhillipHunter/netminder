import {
    t,
    type Context,
    type Static
} from 'elysia';

import type { Net } from '@netminder/dal';
import {
    endAllActiveNets,
    insertNet,
    updateNetRecord
} from '@netminder/dal';

import {
    errorResponse,
    type ErrorResponse
} from '../common/errors';
import { parsePositiveInt } from '../common/validation';

import {
    netSchema,
    type NetSchema
} from './schema';

export const createContract = {
    body: t.Object({
        topic: t.Optional(t.String({
            description: 'Topic to display for the newly created net',
            examples: ['Severe weather preparedness']
        })),
        end_active: t.Optional(t.Boolean({ description: 'End any currently active nets before starting this one' }))
    }, { description: 'Fields used to create a new net' }),
    detail: {
        summary: 'Create net',
        description: 'Creates a new (initially pending) net and optionally ends any other active nets.',
        tags: ['Nets'] as string[]
    },
    response: {
        201: t.Object({ net: netSchema }, { description: 'Net that was created' }),
        400: errorResponse
    }
} as const;

export type CreateBody = Static<typeof createContract.body>;
export type CreateResponse = Static<typeof createContract.response[201]>;

interface CreateContext {
    body: CreateBody;
    set: Context['set'];
}

function normalizeTopic(raw?: string | null): string | null | undefined {
    if (raw === undefined) {
        return undefined;
    }

    if (raw === null) {
        return null;
    }

    const trimmed = raw.trim();
    return trimmed.length === 0 ? null : trimmed;
}

function toNetSchema(net: Net): NetSchema {
    return {
        id: net.id,
        started_at: net.started_at ?? null,
        ended_at: net.ended_at ?? null,
        formal_ended_at: net.formal_ended_at ?? null,
        topic: net.topic ?? null,
        created_at: net.created_at
    };
}

export const createHandler = ({ body, set }: CreateContext): CreateResponse | ErrorResponse => {
    const topic = normalizeTopic(body.topic);

    if (body.end_active) {
        endAllActiveNets();
    }

    const net = insertNet(topic ?? null);
    set.status = 201;
    return { net: toNetSchema(net) };
};

export const updateContract = {
    params: t.Object({
        id: t.String({
            description: 'Identifier of the net to update',
            examples: ['17']
        })
    }, { description: 'Route parameters identifying the net being modified' }),
    body: t.Object({
        topic: t.Optional(t.Union([t.String({ description: 'Updated topic for the net' }), t.Null()], { description: 'Set to a string to update the topic or null to clear' })),
        ended_at: t.Optional(t.Union([t.String({ description: 'Timestamp indicating the net has ended' }), t.Null()], { description: 'Provide a timestamp to end the net or null to mark it active' }))
    }, { description: 'Fields that can be updated for an active or historical net' }),
    detail: {
        summary: 'Update net',
        description: 'Adjusts topic information or marks a net as ended.',
        tags: ['Nets'] as string[]
    },
    response: {
        200: t.Object({ net: netSchema }, { description: 'Net after applying updates' }),
        400: errorResponse,
        404: errorResponse
    }
} as const;

export type UpdateParams = Static<typeof updateContract.params>;
export type UpdateBody = Static<typeof updateContract.body>;
export type UpdateResponse = Static<typeof updateContract.response[200]>;

interface UpdateContext {
    params: UpdateParams;
    body: UpdateBody;
    set: Context['set'];
}

function parseId(raw: UpdateParams): number | null {
    return parsePositiveInt(raw.id);
}

export const updateHandler = ({ params, body, set }: UpdateContext): UpdateResponse | ErrorResponse => {
    const id = parseId(params);
    if (id === null) {
        set.status = 400;
        return {
            error: {
                code: 'INVALID_ID',
                message: 'Invalid net ID'
            }
        };
    }

    const topic = normalizeTopic(body.topic);

    const updated = updateNetRecord(id, {
        topic,
        ended_at: body.ended_at
    });

    if (!updated) {
        set.status = 404;
        return {
            error: {
                code: 'NET_NOT_FOUND',
                message: 'Net not found'
            }
        };
    }

    return { net: toNetSchema(updated) };
};