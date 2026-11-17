import {
    t,
    type Context,
    type Static
} from 'elysia';

import type { Net } from '@netminder/dal';
import {
    clearNetEnd,
    clearNetFormalEnd,
    findVisibleNet,
    markNetEnded,
    markNetFormalEnded,
    markNetStarted
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

const paramsSchema = t.Object({
    id: t.String({
        description: 'Identifier of the net whose status will change',
        examples: ['17']
    })
}, { description: 'Route parameters used to select a net' });
const netResponseSchema = t.Object({ net: netSchema }, { description: 'Net payload reflecting the updated status' });

type NetParams = Static<typeof paramsSchema>;
type NetResponse = Static<typeof netResponseSchema>;

function parseNetId(raw: NetParams): number | null {
    return parsePositiveInt(raw.id);
}

function buildError(code: string, message: string): ErrorResponse {
    return {
        error: {
            code,
            message
        }
    };
}

function toPayload(net: Net, userId: number): NetResponse {
    return { net: toNetPayload(net, userId) };
}

export const endContract = {
    params: paramsSchema,
    detail: {
        summary: 'End net',
        description: 'Marks the specified net as ended.',
        tags: ['Nets'] as string[]
    },
    response: {
        200: netResponseSchema,
        400: errorResponse,
        403: errorResponse,
        404: errorResponse
    }
} as const;

export type EndParams = Static<typeof endContract.params>;
export type EndResponse = Static<typeof endContract.response[200]>;
interface EndContext {
    params: EndParams;
    user?: AuthUser | null;
    set: Context['set'];
}

export const endHandler = ({ params, user, set }: EndContext): EndResponse | ErrorResponse => {
    if (!user) {
        set.status = 401;
        return unauthorizedResponse();
    }

    const netId = parseNetId(params);
    if (netId === null) {
        set.status = 400;
        return buildError('INVALID_ID', 'Invalid net ID');
    }

    const current = findVisibleNet(netId, user.userId);
    if (!current) {
        set.status = 404;
        return buildError('NET_NOT_FOUND', 'Net not found');
    }

    const forbidden = requireNetOwner(current, user.userId);
    if (forbidden) {
        set.status = 403;
        return forbidden;
    }

    if (current.started_at === null) {
        set.status = 400;
        return buildError('NET_NOT_STARTED', 'Net has not been started');
    }

    const net = markNetEnded(netId);
    if (!net) {
        set.status = 404;
        return buildError('NET_NOT_FOUND', 'Net not found');
    }

    return toPayload(net, user.userId);
};

export const startContract = {
    params: paramsSchema,
    detail: {
        summary: 'Start net',
        description: 'Marks a pending net as active.',
        tags: ['Nets'] as string[]
    },
    response: {
        200: netResponseSchema,
        400: errorResponse,
        403: errorResponse,
        404: errorResponse
    }
} as const;

export type StartParams = Static<typeof startContract.params>;
export type StartResponse = Static<typeof startContract.response[200]>;
interface StartContext {
    params: StartParams;
    user?: AuthUser | null;
    set: Context['set'];
}

export const startHandler = ({ params, user, set }: StartContext): StartResponse | ErrorResponse => {
    if (!user) {
        set.status = 401;
        return unauthorizedResponse();
    }

    const netId = parseNetId(params);
    if (netId === null) {
        set.status = 400;
        return buildError('INVALID_ID', 'Invalid net ID');
    }

    const net = findVisibleNet(netId, user.userId);
    if (!net) {
        set.status = 404;
        return buildError('NET_NOT_FOUND', 'Net not found');
    }

    const forbidden = requireNetOwner(net, user.userId);
    if (forbidden) {
        set.status = 403;
        return forbidden;
    }

    if (net.started_at !== null && net.ended_at === null) {
        set.status = 400;
        return buildError('NET_ALREADY_ACTIVE', 'Net is already active');
    }

    if (net.started_at !== null && net.ended_at !== null) {
        set.status = 400;
        return buildError('NET_ALREADY_STARTED', 'Net has already been started');
    }

    const updated = markNetStarted(netId);
    if (!updated) {
        set.status = 404;
        return buildError('NET_NOT_FOUND', 'Net not found');
    }

    return toPayload(updated, user.userId);
};

export const restartContract = {
    params: paramsSchema,
    detail: {
        summary: 'Restart net',
        description: 'Clears the end timestamp to mark the net as active again.',
        tags: ['Nets'] as string[]
    },
    response: {
        200: netResponseSchema,
        400: errorResponse,
        403: errorResponse,
        404: errorResponse
    }
} as const;

export type RestartParams = Static<typeof restartContract.params>;
export type RestartResponse = Static<typeof restartContract.response[200]>;
interface RestartContext {
    params: RestartParams;
    user?: AuthUser | null;
    set: Context['set'];
}

export const restartHandler = ({ params, user, set }: RestartContext): RestartResponse | ErrorResponse => {
    if (!user) {
        set.status = 401;
        return unauthorizedResponse();
    }

    const netId = parseNetId(params);
    if (netId === null) {
        set.status = 400;
        return buildError('INVALID_ID', 'Invalid net ID');
    }

    const existing = findVisibleNet(netId, user.userId);
    if (!existing) {
        set.status = 404;
        return buildError('NET_NOT_FOUND', 'Net not found');
    }

    const forbidden = requireNetOwner(existing, user.userId);
    if (forbidden) {
        set.status = 403;
        return forbidden;
    }

    if (existing.started_at === null) {
        set.status = 400;
        return buildError('NET_NOT_STARTED', 'Net has not been started');
    }

    if (existing.ended_at === null) {
        set.status = 400;
        return buildError('NET_NOT_ENDED', 'Net is already active');
    }

    const net = clearNetEnd(netId);
    if (!net) {
        set.status = 404;
        return buildError('NET_NOT_FOUND', 'Net not found');
    }

    return toPayload(net, user.userId);
};

export const endFormalContract = {
    params: paramsSchema,
    detail: {
        summary: 'End formal portion',
        description: 'Marks the formal portion of an active net as completed.',
        tags: ['Nets'] as string[]
    },
    response: {
        200: netResponseSchema,
        400: errorResponse,
        403: errorResponse,
        404: errorResponse
    }
} as const;

export type EndFormalParams = Static<typeof endFormalContract.params>;
export type EndFormalResponse = Static<typeof endFormalContract.response[200]>;
interface EndFormalContext {
    params: EndFormalParams;
    user?: AuthUser | null;
    set: Context['set'];
}

export const endFormalHandler = ({ params, user, set }: EndFormalContext): EndFormalResponse | ErrorResponse => {
    if (!user) {
        set.status = 401;
        return unauthorizedResponse();
    }

    const netId = parseNetId(params);
    if (netId === null) {
        set.status = 400;
        return buildError('INVALID_ID', 'Invalid net ID');
    }

    const current = findVisibleNet(netId, user.userId);
    if (!current) {
        set.status = 404;
        return buildError('NET_NOT_FOUND', 'Net not found');
    }

    const forbidden = requireNetOwner(current, user.userId);
    if (forbidden) {
        set.status = 403;
        return forbidden;
    }

    if (current.started_at === null) {
        set.status = 400;
        return buildError('NET_NOT_STARTED', 'Net has not been started');
    }

    if (current.ended_at !== null) {
        set.status = 400;
        return buildError('NET_NOT_ACTIVE', 'Net is not active');
    }

    const net = markNetFormalEnded(netId);
    if (!net) {
        set.status = 404;
        return buildError('NET_NOT_FOUND', 'Net not found');
    }

    return toPayload(net, user.userId);
};

export const resumeFormalContract = {
    params: paramsSchema,
    detail: {
        summary: 'Resume formal portion',
        description: 'Clears the formal end timestamp to resume formal net operations.',
        tags: ['Nets'] as string[]
    },
    response: {
        200: netResponseSchema,
        400: errorResponse,
        403: errorResponse,
        404: errorResponse
    }
} as const;

export type ResumeFormalParams = Static<typeof resumeFormalContract.params>;
export type ResumeFormalResponse = Static<typeof resumeFormalContract.response[200]>;
interface ResumeFormalContext {
    params: ResumeFormalParams;
    user?: AuthUser | null;
    set: Context['set'];
}

export const resumeFormalHandler = ({ params, user, set }: ResumeFormalContext): ResumeFormalResponse | ErrorResponse => {
    if (!user) {
        set.status = 401;
        return unauthorizedResponse();
    }

    const netId = parseNetId(params);
    if (netId === null) {
        set.status = 400;
        return buildError('INVALID_ID', 'Invalid net ID');
    }

    const current = findVisibleNet(netId, user.userId);
    if (!current) {
        set.status = 404;
        return buildError('NET_NOT_FOUND', 'Net not found');
    }

    const forbidden = requireNetOwner(current, user.userId);
    if (forbidden) {
        set.status = 403;
        return forbidden;
    }

    if (current.started_at === null) {
        set.status = 400;
        return buildError('NET_NOT_STARTED', 'Net has not been started');
    }

    if (current.ended_at !== null) {
        set.status = 400;
        return buildError('NET_NOT_ACTIVE', 'Net is not active');
    }

    const net = clearNetFormalEnd(netId);
    if (!net) {
        set.status = 404;
        return buildError('NET_NOT_FOUND', 'Net not found');
    }

    return toPayload(net, user.userId);
};