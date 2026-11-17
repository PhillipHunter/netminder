import {
    t,
    type Context,
    type Static
} from 'elysia';

import {
    endAllActiveNets,
    findVisibleNet,
    insertNet,
    updateNetRecord
} from '@netminder/dal';

import type { AuthUser } from '../auth/middleware';
import {
    errorResponse,
    unauthorizedResponse,
    type ErrorResponse
} from '../common/errors';
import { requireNetOwner } from '../common/ownership';
import { parsePositiveInt } from '../common/validation';

import {
    netSchema,
    toNetPayload
} from './schema';

export const createContract = {
    body: t.Object({
        topic: t.Optional(t.String({
            description: 'Topic to display for the newly created net',
            examples: ['Severe weather preparedness']
        })),
        end_active: t.Optional(t.Boolean({ description: 'End any of your own currently active nets before starting this one' })),
        shared: t.Optional(t.Boolean({ description: 'Make the net visible to all users so they can add check-ins (defaults to false)' }))
    }, { description: 'Fields used to create a new net' }),
    detail: {
        summary: 'Create net',
        description: 'Creates a new (initially pending) net and optionally ends your other active nets.',
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
    user?: AuthUser | null;
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

export const createHandler = ({ body, user, set }: CreateContext): CreateResponse | ErrorResponse => {
    if (!user) {
        set.status = 401;
        return unauthorizedResponse();
    }

    const topic = normalizeTopic(body.topic);

    if (body.end_active) {
        endAllActiveNets(user.userId);
    }

    const net = insertNet(topic ?? null, user.userId, body.shared ?? false);
    set.status = 201;
    return { net: toNetPayload(net, user.userId) };
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
        ended_at: t.Optional(t.Union([t.String({ description: 'Timestamp indicating the net has ended' }), t.Null()], { description: 'Provide a timestamp to end the net or null to mark it active' })),
        shared: t.Optional(t.Boolean({ description: 'Set whether the net is visible to all users (creator only)' }))
    }, { description: 'Fields that can be updated for an active or historical net' }),
    detail: {
        summary: 'Update net',
        description: 'Adjusts topic information or marks a net as ended.',
        tags: ['Nets'] as string[]
    },
    response: {
        200: t.Object({ net: netSchema }, { description: 'Net after applying updates' }),
        400: errorResponse,
        403: errorResponse,
        404: errorResponse
    }
} as const;

export type UpdateParams = Static<typeof updateContract.params>;
export type UpdateBody = Static<typeof updateContract.body>;
export type UpdateResponse = Static<typeof updateContract.response[200]>;

interface UpdateContext {
    params: UpdateParams;
    body: UpdateBody;
    user?: AuthUser | null;
    set: Context['set'];
}

function parseId(raw: UpdateParams): number | null {
    return parsePositiveInt(raw.id);
}

export const updateHandler = ({ params, body, user, set }: UpdateContext): UpdateResponse | ErrorResponse => {
    if (!user) {
        set.status = 401;
        return unauthorizedResponse();
    }

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

    const existing = findVisibleNet(id, user.userId);
    if (!existing) {
        set.status = 404;
        return {
            error: {
                code: 'NET_NOT_FOUND',
                message: 'Net not found'
            }
        };
    }

    const forbidden = requireNetOwner(existing, user.userId);
    if (forbidden) {
        set.status = 403;
        return forbidden;
    }

    const topic = normalizeTopic(body.topic);

    const updated = updateNetRecord(id, {
        topic,
        ended_at: body.ended_at,
        shared: body.shared
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

    return { net: toNetPayload(updated, user.userId) };
};