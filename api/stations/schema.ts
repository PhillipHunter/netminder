import { t } from 'elysia';

import { mobilitySchema } from '../checkins/schema';

export const fieldSourceSchema = t.Union([
    t.Literal('manual'),
    t.Literal('qrz'),
    t.Literal('none')
]);

export const stationDetailSchema = t.Object({
    callsign: t.String(),
    preferred_name: t.Nullable(t.String()),
    location: t.Nullable(t.String()),
    notes: t.Nullable(t.String()),
    qrz_data: t.Nullable(t.String()),
    qrz_last_fetched_at: t.Nullable(t.String()),
    display_name: t.Nullable(t.String()),
    location_display: t.Nullable(t.String())
});

export const lookupFieldSchema = t.Object({
    value: t.Nullable(t.String()),
    source: fieldSourceSchema,
    manual: t.Nullable(t.String()),
    qrz: t.Nullable(t.String())
});

export const lookupSchema = t.Object({
    callsign: t.String(),
    station: t.Nullable(t.Object({
        preferred_name: t.Nullable(t.String()),
        location: t.Nullable(t.String()),
        qrz_last_fetched_at: t.Nullable(t.String()),
        qrz_data_present: t.Boolean()
    })),
    preferred_name: lookupFieldSchema,
    location: lookupFieldSchema,
    qrz: t.Object({
        enabled: t.Boolean(),
        fetched_now: t.Boolean(),
        last_fetched_at: t.Nullable(t.String())
    }),
    source: fieldSourceSchema
});

export const stationRecentCheckinSchema = t.Object({
    checkin_id: t.Number(),
    net_id: t.Number(),
    time_entered: t.String(),
    mobility: mobilitySchema,
    staying: t.Boolean(),
    topic_answer: t.Nullable(t.String())
});

export const stationStatsScopeSchema = t.Object({
    first_seen_at: t.Nullable(t.String({ description: 'Timestamp of the earliest check-in in this scope' })),
    last_seen_at: t.Nullable(t.String({ description: 'Timestamp of the latest check-in in this scope' })),
    total_checkins: t.Number({ description: 'Total number of check-ins in this scope' }),
    recent: t.Array(stationRecentCheckinSchema, { description: 'Up to 10 most recent check-ins in this scope' })
});

export const stationStatsSchema = t.Object({
    callsign: t.String(),
    preferred_name: t.Nullable(t.String()),
    location: t.Nullable(t.String()),
    display_name: t.Nullable(t.String()),
    location_display: t.Nullable(t.String()),
    qrz_enabled: t.Boolean(),
    own: t.Object(stationStatsScopeSchema.properties, { description: 'Activity in nets created by the requesting user' }),
    visible: t.Object(stationStatsScopeSchema.properties, { description: 'Activity across all nets visible to the requesting user (shared nets plus the user\'s own)' })
});

export type StationDetailSchema = typeof stationDetailSchema.static;
export type StationLookupFieldSchema = typeof lookupFieldSchema.static;
export type StationLookupSchema = typeof lookupSchema.static;
export type StationStatsSchema = typeof stationStatsSchema.static;