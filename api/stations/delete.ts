import {
    t,
    type Context,
    type Static
} from 'elysia';

import { deleteStationRecord } from '@netminder/dal';

import {
    errorResponse,
    type ErrorResponse
} from '../common/errors';

import {
    decodeCallsignParam,
    normalizeCallsignValue
} from './utils';

export const deleteContract = {
    params: t.Object({
        callsign: t.String({
            description: 'Callsign of the station to delete',
            examples: ['K1ABC']
        })
    }, { description: 'Route parameters identifying the station to remove' }),
    detail: {
        summary: 'Delete station',
        description: 'Removes a station record from the NetMinder directory.',
        tags: ['Stations'] as string[]
    },
    response: {
        204: t.Null(),
        400: errorResponse,
        404: errorResponse,
        500: errorResponse
    }
} as const;

export type DeleteParams = Static<typeof deleteContract.params>;
export type DeleteResponse = Static<typeof deleteContract.response[204]>;
interface DeleteContext {
    params: DeleteParams;
    set: Context['set'];
}

export const deleteHandler = ({
    params,
    set
}: DeleteContext): null | ErrorResponse => {
    const decoded = decodeCallsignParam(params.callsign);
    if (!decoded) {
        set.status = 400;
        return {
            error: {
                code: 'INVALID_CALLSIGN',
                message: 'Callsign parameter is required'
            }
        };
    }

    try {
        const normalized = normalizeCallsignValue(decoded);
        const deleted = deleteStationRecord(normalized);

        if (!deleted) {
            set.status = 404;
            return {
                error: {
                    code: 'NOT_FOUND',
                    message: 'Station not found'
                }
            };
        }

        set.status = 204;
        return null;
    } catch (error) {
        console.error('Error deleting station:', error);
        set.status = 500;
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to delete station'
            }
        };
    }
};