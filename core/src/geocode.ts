export interface GeocodeAddressParts {
    street: string;
    city?: string;
    state?: string;
    postalcode?: string;
    country?: string;
}

export type GeocodeResult =
    | { status: 'match'; lat: number; lon: number }
    | { status: 'no_match' }
    | { status: 'error' };

interface NominatimPlace {
    lat?: string;
    lon?: string;
    place_rank?: number;
}

const DEFAULT_GEOCODER_URL = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'NetMinder/1.0 (+https://github.com/sirmalloc/netminder)';
const REQUEST_TIMEOUT_MS = 10000;
const MIN_HOUSE_PLACE_RANK = 30;
const EARTH_RADIUS_KM = 6371;

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (degrees: number): number => degrees * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export async function geocodeAddress(parts: GeocodeAddressParts): Promise<GeocodeResult> {
    const configuredUrl = process.env.GEOCODER_URL?.trim();
    let baseUrl = DEFAULT_GEOCODER_URL;
    if (configuredUrl) {
        baseUrl = configuredUrl;
    }
    baseUrl = baseUrl.replace(/\/+$/, '');
    const email = process.env.GEOCODER_EMAIL?.trim();

    const params = new URLSearchParams({
        format: 'jsonv2',
        limit: '1',
        addressdetails: '0'
    });
    const fields: [string, string | undefined][] = [
        ['street', parts.street],
        ['city', parts.city],
        ['state', parts.state],
        ['postalcode', parts.postalcode],
        ['country', parts.country]
    ];
    for (const [key, value] of fields) {
        if (value && value.trim().length > 0) {
            params.set(key, value.trim());
        }
    }
    if (email) {
        params.set('email', email);
    }

    try {
        const response = await fetch(`${baseUrl}/search?${params.toString()}`, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        });

        if (response.status === 429 || response.status >= 500) {
            console.error(`Geocoder request failed: ${response.status}`);
            return { status: 'error' };
        }

        if (!response.ok) {
            console.error(`Geocoder request rejected: ${response.status}`);
            return { status: 'no_match' };
        }

        const places = await response.json() as NominatimPlace[];
        if (!Array.isArray(places) || places.length === 0) {
            return { status: 'no_match' };
        }

        const place = places[0];
        const lat = Number(place.lat);
        const lon = Number(place.lon);
        if (
            !Number.isFinite(lat)
            || !Number.isFinite(lon)
            || Math.abs(lat) > 90
            || Math.abs(lon) > 180
            || typeof place.place_rank !== 'number'
            || place.place_rank < MIN_HOUSE_PLACE_RANK
        ) {
            return { status: 'no_match' };
        }

        return {
            status: 'match',
            lat,
            lon
        };
    } catch (error) {
        console.error('Geocoder request failed:', error instanceof Error ? error.message : error);
        return { status: 'error' };
    }
}