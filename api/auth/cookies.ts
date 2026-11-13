const TOKEN_COOKIE_NAME = 'nm_auth';
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

const HTTPS_HEADER = 'x-forwarded-proto';

const isSecureRequest = (request: Request): boolean => {
    const forwardedProto = request.headers.get(HTTPS_HEADER);
    if (forwardedProto) {
        return forwardedProto
            .split(',')
            .map(proto => proto.trim().toLowerCase())
            .includes('https');
    }

    try {
        const url = new URL(request.url);
        return url.protocol === 'https:';
    } catch {
        return false;
    }
};

export function buildAuthCookie(token: string, request: Request): string {
    const attributes = [
        `Max-Age=${TOKEN_TTL_SECONDS}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Strict'
    ];

    if (isSecureRequest(request)) {
        attributes.push('Secure');
    }

    return `${TOKEN_COOKIE_NAME}=${token}; ${attributes.join('; ')}`;
}

export function buildExpiredCookie(request: Request): string {
    const attributes = [
        'Max-Age=0',
        'Path=/',
        'HttpOnly',
        'SameSite=Strict'
    ];

    if (isSecureRequest(request)) {
        attributes.push('Secure');
    }

    return `${TOKEN_COOKIE_NAME}=; ${attributes.join('; ')}`;
}