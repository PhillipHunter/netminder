import { t } from 'elysia';

import type { Net } from '@netminder/dal';

import { isNetOwner } from '../common/ownership';

export const netSchema = t.Object({
    id: t.Number(),
    started_at: t.Nullable(t.String()),
    ended_at: t.Nullable(t.String()),
    formal_ended_at: t.Nullable(t.String()),
    topic: t.Nullable(t.String()),
    created_at: t.String(),
    shared: t.Boolean({ description: 'True when the net is visible to and open for check-ins from all users' }),
    is_owner: t.Boolean({ description: 'True when the requesting user created the net and may run its lifecycle' })
});

export type NetSchema = typeof netSchema.static;

export const netCountsSchema = t.Object({
    total: t.Number(),
    staying: t.Number(),
    in_and_out: t.Number(),
    mobile: t.Number(),
    portable: t.Number()
});

export type NetCountsSchema = typeof netCountsSchema.static;

export const netWithCountsSchema = t.Object({
    id: t.Number(),
    started_at: t.Nullable(t.String()),
    ended_at: t.Nullable(t.String()),
    formal_ended_at: t.Nullable(t.String()),
    topic: t.Nullable(t.String()),
    created_at: t.String(),
    shared: t.Boolean({ description: 'True when the net is visible to and open for check-ins from all users' }),
    is_owner: t.Boolean({ description: 'True when the requesting user created the net and may run its lifecycle' }),
    counts: netCountsSchema
});

export type NetWithCountsSchema = typeof netWithCountsSchema.static;

export function toNetPayload(net: Net, userId: number): NetSchema {
    return {
        id: net.id,
        started_at: net.started_at ?? null,
        ended_at: net.ended_at ?? null,
        formal_ended_at: net.formal_ended_at ?? null,
        topic: net.topic ?? null,
        created_at: net.created_at,
        shared: net.shared === 1,
        is_owner: isNetOwner(net, userId)
    };
}