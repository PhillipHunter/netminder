import type { Net } from '@netminder/dal';

import type { ErrorResponse } from './errors';

export function isNetOwner(net: Net, userId: number): boolean {
    return net.created_by === userId;
}

/**
 * Returns the 403 payload for creator-only actions, or null when the user owns the net.
 * Callers must already have resolved the net through a visibility check so that
 * invisible nets keep returning 404.
 */
export function requireNetOwner(net: Net, userId: number): ErrorResponse | null {
    if (isNetOwner(net, userId)) {
        return null;
    }

    return {
        error: {
            code: 'NET_FORBIDDEN',
            message: 'Only the net creator can perform this action'
        }
    };
}