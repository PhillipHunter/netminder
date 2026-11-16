import {
    t,
    type Context,
    type Static
} from 'elysia';

import {
    createCheckinWithMeta,
    findVisibleNet
} from '@netminder/dal';

import type { AuthUser } from '../auth/middleware';
import {
    errorResponse,
    unauthorizedResponse,
    type ErrorResponse
} from '../common/errors';
import { parsePositiveInt } from '../common/validation';

import {
    checkinMetaSchema,
    checkinSchema,
    mobilitySchema,
    normalizeMobility,
    toCheckinPayload
} from './schema';

export const createContract = {
    params: t.Object({
        id: t.String({
            description: 'Identifier of the net receiving the checkin',
            examples: ['42']
        })
    }, { description: 'Route parameters identifying the destination net' }),
    body: t.Object({
        callsign: t.String({
            description: 'Callsign reported by the station',
            examples: ['K1ABC']
        }),
        mobility: t.Optional(mobilitySchema),
        staying: t.Optional(t.Boolean({ description: 'True when the station is staying for the duration of the net' })),
        topic_answer: t.Optional(t.String({ description: 'Answer the station provided for the current net topic' })),
        operator_notes: t.Optional(t.String({ description: 'Internal notes for net control regarding this station' })),
        preferred_name: t.Optional(t.String({
            description: 'Preferred name for the station; stored on the station profile',
            examples: ['Jamie']
        })),
        location: t.Optional(t.String({
            description: 'Location update for the station; stored on the station profile',
            examples: ['Downtown EOC']
        }))
    }, { description: 'Payload describing the station checkin and optional profile updates' }),
    detail: {
        summary: 'Create checkin',
        description: 'Adds a checkin to the specified net and returns metadata about prior participation.',
        tags: ['Checkins'] as string[]
    },
    response: {
        201: t.Object({
            checkin: checkinSchema,
            meta: checkinMetaSchema
        }, { description: 'Newly created checkin and associated station metadata' }),
        400: errorResponse,
        404: errorResponse,
        500: errorResponse
    }
} as const;

export type CreateParams = Static<typeof createContract.params>;
export type CreateBody = Static<typeof createContract.body>;
export type CreateResponse = Static<typeof createContract.response[201]>;

interface CreateContext {
    params: CreateParams;
    body: CreateBody;
    user?: AuthUser | null;
    set: Context['set'];
}

function parseNetId(params: CreateParams): number | null {
    return parsePositiveInt(params.id);
}

export const createHandler = async ({ params, body, user, set }: CreateContext): Promise<CreateResponse | ErrorResponse> => {
    if (!user) {
        set.status = 401;
        return unauthorizedResponse();
    }

    const netId = parseNetId(params);
    if (netId === null) {
        set.status = 400;
        return {
            error: {
                code: 'INVALID_NET_ID',
                message: 'Invalid net ID'
            }
        };
    }

    const net = findVisibleNet(netId, user.userId);
    if (!net) {
        set.status = 404;
        return {
            error: {
                code: 'NET_NOT_FOUND',
                message: 'Net not found'
            }
        };
    }

    if (net.started_at === null) {
        set.status = 400;
        return {
            error: {
                code: 'NET_NOT_STARTED',
                message: 'Cannot add checkins before the net has started'
            }
        };
    }

    if (net.ended_at !== null) {
        set.status = 400;
        return {
            error: {
                code: 'NET_ALREADY_ENDED',
                message: 'Cannot add checkins after the net has ended'
            }
        };
    }

    try {
        const normalizedMobility = body.mobility ? normalizeMobility(body.mobility) : undefined;
        const result = await createCheckinWithMeta(netId, {
            callsign: body.callsign,
            mobility: normalizedMobility,
            staying: body.staying,
            topic_answer: body.topic_answer,
            operator_notes: body.operator_notes,
            preferred_name: body.preferred_name,
            location: body.location
        });

        set.status = 201;
        return {
            checkin: toCheckinPayload(result.checkin),
            meta: result.meta
        };
    } catch (error) {
        console.error('Error creating checkin:', error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to create checkin'
            }
        };
    }
};