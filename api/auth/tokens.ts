import jwt from 'jsonwebtoken';

export interface JwtPayload {
    userId: number;
    username: string;
    isAdmin: boolean;
    iat?: number;
    exp?: number;
}

const DEV_JWT_SECRET = 'development-secret-change-me-in-production';
const AUTH_COOKIE_NAME = 'nm_auth';
const BEARER_PREFIX = /^Bearer\s+/i;

function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET must be set in production environment');
        }
        return DEV_JWT_SECRET;
    }

    return secret;
}

export function signToken(userId: number, username: string, isAdmin: boolean): string {
    const secret = getJwtSecret();
    const payload: JwtPayload = {
        userId,
        username,
        isAdmin
    };

    return jwt.sign(payload, secret, {
        algorithm: 'HS256',
        expiresIn: '7d'
    });
}

export function verifyToken(token: string): JwtPayload {
    const secret = getJwtSecret();

    try {
        const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as JwtPayload;
        return decoded;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new Error('Token has expired');
        }
        if (error instanceof jwt.JsonWebTokenError) {
            throw new Error('Invalid token');
        }
        throw new Error('Token verification failed');
    }
}

export function extractTokenFromHeaders(headers: { authorization?: string | null; cookie?: string | null }): string | null {
    const authHeader = headers.authorization;
    if (typeof authHeader === 'string') {
        const token = authHeader.replace(BEARER_PREFIX, '').trim();
        if (token.length > 0 && token !== authHeader) {
            return token;
        }
    }

    const cookieHeader = headers.cookie;
    if (typeof cookieHeader === 'string') {
        const cookies = cookieHeader.split(';');
        for (const cookie of cookies) {
            const [rawName, ...rawValue] = cookie.trim().split('=');
            if (rawName === AUTH_COOKIE_NAME) {
                const value = rawValue.join('=').trim();
                if (value.length > 0) {
                    return value;
                }
            }
        }
    }

    return null;
}

export function verifyTokenFromHeaders(headers: { authorization?: string | null; cookie?: string | null }): JwtPayload | null {
    const token = extractTokenFromHeaders(headers);
    if (!token) {
        return null;
    }

    try {
        return verifyToken(token);
    } catch {
        return null;
    }
}