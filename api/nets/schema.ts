import { t } from 'elysia';

export const netSchema = t.Object({
    id: t.Number(),
    started_at: t.Nullable(t.String()),
    ended_at: t.Nullable(t.String()),
    formal_ended_at: t.Nullable(t.String()),
    topic: t.Nullable(t.String()),
    created_at: t.String()
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
    counts: netCountsSchema
});

export type NetWithCountsSchema = typeof netWithCountsSchema.static;