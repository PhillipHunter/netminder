import { createHash } from 'node:crypto';

import { SettingsServiceError } from './settings';

export interface QRZCredentials {
    username: string;
    password: string;
}

interface QRZSessionCache {
    key: string;
    expiresAt: number;
}

interface QRZCallsignData {
    callsign: string;
    name?: string;
    fname?: string;
    mi?: string;
    addr1?: string;
    addr2?: string;
    state?: string;
    zip?: string;
    country?: string;
    lat?: string;
    lon?: string;
    grid?: string;
    county?: string;
    fips?: string;
    land?: string;
    efdate?: string;
    expdate?: string;
    p_call?: string;
    class?: string;
    codes?: string;
    qslmgr?: string;
    email?: string;
    url?: string;
    u_views?: string;
    bio?: string;
    biodate?: string;
    image?: string;
    imageinfo?: string;
    serial?: string;
    moddate?: string;
    MSA?: string;
    AreaCode?: string;
    TimeZone?: string;
    GMTOffset?: string;
    DST?: string;
    eqsl?: string;
    mqsl?: string;
    cqzone?: string;
    ituzone?: string;
    born?: string;
    user?: string;
    lotw?: string;
    iota?: string;
    geoloc?: string;
    attn?: string;
    nickname?: string;
    name_fmt?: string;
}

export interface QRZLookupResult {
    callsign: string;
    name: string | null;
    address: string | null;
    grid: string | null;
    class: string | null;
    raw: QRZCallsignData;
}

type CredentialProvider = (userId: number | null) => QRZCredentials | null;

const QRZ_XML_URL = 'https://xmldata.qrz.com/xml/current/';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

let credentialProvider: CredentialProvider = () => null;
const sessionCache = new Map<string, QRZSessionCache>();

export function setQRZCredentialProvider(provider: CredentialProvider): void {
    credentialProvider = provider;
    clearQRZSessionCache();
}

function getCredentials(userId: number | null): QRZCredentials | null {
    return credentialProvider(userId);
}

function createCredentialsFingerprint(username: string, password: string): string {
    return createHash('sha256')
        .update(`${username}:${password}`)
        .digest('hex');
}

function parseXML(xmlString: string): Record<string, string> {
    const result: Record<string, string> = {};
    const tagRegex = /<(\w+)>([^<]*)<\/\1>/g;
    let match;

    while ((match = tagRegex.exec(xmlString)) !== null) {
        const [, tagName, value] = match;
        result[tagName] = value;
    }

    return result;
}

function extractCallsignData(xml: string): QRZCallsignData | null {
    const parsed = parseXML(xml);

    if (parsed.Error) {
        console.error(`QRZ API error: ${parsed.Error}`);
        return null;
    }

    if (!parsed.call) {
        return null;
    }

    return {
        callsign: parsed.call,
        name: parsed.name,
        fname: parsed.fname,
        mi: parsed.mi,
        addr1: parsed.addr1,
        addr2: parsed.addr2,
        state: parsed.state,
        zip: parsed.zip,
        country: parsed.country,
        lat: parsed.lat,
        lon: parsed.lon,
        grid: parsed.grid,
        county: parsed.county,
        fips: parsed.fips,
        land: parsed.land,
        efdate: parsed.efdate,
        expdate: parsed.expdate,
        p_call: parsed.p_call,
        class: parsed.class,
        codes: parsed.codes,
        qslmgr: parsed.qslmgr,
        email: parsed.email,
        url: parsed.url,
        u_views: parsed.u_views,
        bio: parsed.bio,
        biodate: parsed.biodate,
        image: parsed.image,
        imageinfo: parsed.imageinfo,
        serial: parsed.serial,
        moddate: parsed.moddate,
        MSA: parsed.MSA,
        AreaCode: parsed.AreaCode,
        TimeZone: parsed.TimeZone,
        GMTOffset: parsed.GMTOffset,
        DST: parsed.DST,
        eqsl: parsed.eqsl,
        mqsl: parsed.mqsl,
        cqzone: parsed.cqzone,
        ituzone: parsed.ituzone,
        born: parsed.born,
        user: parsed.user,
        lotw: parsed.lotw,
        iota: parsed.iota,
        geoloc: parsed.geoloc,
        attn: parsed.attn,
        nickname: parsed.nickname,
        name_fmt: parsed.name_fmt
    };
}

function buildAddress(data: QRZCallsignData): string | null {
    const parts: string[] = [];

    if (data.addr1)
        parts.push(data.addr1);
    if (data.addr2)
        parts.push(data.addr2);

    const cityStateZip: string[] = [];
    if (data.state)
        cityStateZip.push(data.state);
    if (data.zip)
        cityStateZip.push(data.zip);
    if (cityStateZip.length > 0)
        parts.push(cityStateZip.join(' '));

    if (data.country)
        parts.push(data.country);

    return parts.length > 0 ? parts.join(', ') : null;
}

function normalizeCallsignData(data: QRZCallsignData): QRZLookupResult {
    return {
        callsign: data.callsign,
        name: data.name ?? data.fname ?? null,
        address: buildAddress(data),
        grid: data.grid ?? null,
        class: data.class ?? null,
        raw: data
    };
}

async function fetchWithRetry(url: string, retries = 0): Promise<string | null> {
    try {
        const response = await fetch(url);

        if (!response.ok) {
            if ((response.status === 503 || response.status >= 500) && retries < MAX_RETRIES) {
                const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retries);
                console.log(`QRZ request failed (${response.status}), retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return await fetchWithRetry(url, retries + 1);
            }

            console.error(`QRZ request failed: ${response.status} ${response.statusText}`);
            return null;
        }

        return await response.text();
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (retries < MAX_RETRIES) {
            const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retries);
            console.log(`QRZ request error, retrying in ${delay}ms...`, err);
            await new Promise(resolve => setTimeout(resolve, delay));
            return await fetchWithRetry(url, retries + 1);
        }

        console.error('QRZ request error after retries:', err);
        return null;
    }
}

async function authenticateWithCredentials(username: string, password: string): Promise<{ key: string | null; message?: string }> {
    try {
        const url = `${QRZ_XML_URL}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
        const response = await fetch(url);

        if (!response.ok) {
            const message = `${response.status} ${response.statusText}`;
            console.error(`QRZ authentication failed: ${message}`);
            return { key: null, message: `QRZ authentication failed: ${message}` };
        }

        const xml = await response.text();
        const parsed = parseXML(xml);

        if (parsed.Error) {
            console.error(`QRZ authentication error: ${parsed.Error}`);
            return { key: null, message: parsed.Error };
        }

        const key = parsed.Key || null;
        if (!key) {
            console.error('Failed to extract session key from QRZ response');
            return { key: null, message: 'Unable to retrieve session key from QRZ response.' };
        }

        return { key };
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error('QRZ authentication error:', err);
        return { key: null, message: 'Unexpected error authenticating with QRZ.' };
    }
}

async function getSessionKey(userId: number | null): Promise<{ key: string; fingerprint: string } | null> {
    let credentials: QRZCredentials | null = null;

    try {
        credentials = getCredentials(userId);
    } catch (error: unknown) {
        if (error instanceof SettingsServiceError) {
            console.error('QRZ credentials unavailable:', error.message);
            return null;
        }

        throw error;
    }

    if (!credentials) {
        return null;
    }

    const fingerprint = createCredentialsFingerprint(credentials.username, credentials.password);

    const cached = sessionCache.get(fingerprint);
    if (cached && cached.expiresAt > Date.now()) {
        return { key: cached.key, fingerprint };
    }

    const result = await authenticateWithCredentials(credentials.username, credentials.password);

    if (!result.key) {
        return null;
    }

    sessionCache.set(fingerprint, {
        key: result.key,
        expiresAt: Date.now() + SESSION_TTL_MS
    });

    console.log('QRZ session authenticated successfully');
    return { key: result.key, fingerprint };
}

export async function lookupCallsign(callsign: string, userId: number | null): Promise<QRZLookupResult | null> {
    const normalizedCallsign = callsign.toUpperCase();

    const session = await getSessionKey(userId);
    if (!session) {
        return null;
    }

    const url = `${QRZ_XML_URL}?s=${encodeURIComponent(session.key)}&callsign=${encodeURIComponent(normalizedCallsign)}`;
    const xml = await fetchWithRetry(url);

    if (!xml) {
        return null;
    }

    const parsed = parseXML(xml);
    if ('Error' in parsed && parsed.Error.includes('Session Timeout')) {
        console.log('QRZ session expired, clearing cache and retrying...');
        sessionCache.delete(session.fingerprint);

        const newSession = await getSessionKey(userId);
        if (!newSession) {
            return null;
        }

        const retryUrl = `${QRZ_XML_URL}?s=${encodeURIComponent(newSession.key)}&callsign=${encodeURIComponent(normalizedCallsign)}`;
        const retryXml = await fetchWithRetry(retryUrl);

        if (!retryXml) {
            return null;
        }

        const data = extractCallsignData(retryXml);
        return data ? normalizeCallsignData(data) : null;
    }

    const data = extractCallsignData(xml);
    return data ? normalizeCallsignData(data) : null;
}

export function shouldRefreshQRZ(lastFetchedAt: string | null, ttlDays = 7): boolean {
    if (!lastFetchedAt) {
        return true;
    }

    const lastFetch = new Date(lastFetchedAt).getTime();
    const now = Date.now();
    const ttlMs = ttlDays * 24 * 60 * 60 * 1000;

    return (now - lastFetch) > ttlMs;
}

export function isQRZConfigured(userId: number | null): boolean {
    try {
        return getCredentials(userId) !== null;
    } catch (error: unknown) {
        if (error instanceof SettingsServiceError) {
            return false;
        }

        throw error;
    }
}

export function clearQRZSessionCache(): void {
    sessionCache.clear();
}

export async function verifyQRZCredentials(username: string, password: string): Promise<{ valid: boolean; message?: string }> {
    const result = await authenticateWithCredentials(username, password);
    return {
        valid: Boolean(result.key),
        message: result.message
    };
}