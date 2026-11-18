import type { GeocodeAddressParts } from '@netminder/core';

import type { Station } from '../db';
import { db } from '../db';
import { parseQrzData } from '../utils/qrzDisplay';

export interface StationAddress {
    parts: GeocodeAddressParts;
    key: string;
}

export interface GeocodingStatus {
    geocoded: number;
    no_match: number;
    pending: number;
}

const ADDRESS_LEVEL_GEOLOCS = new Set(['user', 'geocode']);

function clean(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    if (!trimmed) {
        return undefined;
    }
    return trimmed;
}

export function stationAddressFor(qrzData: string | null | undefined): StationAddress | null {
    const raw = parseQrzData(qrzData ?? null)?.raw;
    const street = clean(raw?.addr1);
    if (!street) {
        return null;
    }

    const zip = clean(raw?.zip)?.match(/^\d{5}/)?.[0];
    const parts: GeocodeAddressParts = {
        street,
        city: clean(raw?.addr2),
        state: clean(raw?.state),
        postalcode: zip,
        country: clean(raw?.country)
    };

    const key = [parts.street, parts.city, parts.state, parts.postalcode, parts.country]
        .map(part => (part ?? '').toLowerCase())
        .join('|');

    return {
        parts,
        key
    };
}

export function geocodeAddressFor(qrzData: string | null | undefined): StationAddress | null {
    const address = stationAddressFor(qrzData);
    if (!address) {
        return null;
    }

    const geoloc = parseQrzData(qrzData ?? null)?.raw?.geoloc;
    if (ADDRESS_LEVEL_GEOLOCS.has((geoloc ?? '').trim().toLowerCase())) {
        return null;
    }

    return address;
}

export function findStationById(id: number): Station | null {
    const result = db
        .prepare<Station>('SELECT * FROM stations WHERE id = ?')
        .get(id);

    return (result as Station | undefined) ?? null;
}

export function listStationsNeedingGeocode(): Station[] {
    const rows = db
        .prepare<Station>('SELECT * FROM stations WHERE geocoded_at IS NULL AND qrz_data IS NOT NULL')
        .all();

    return rows.filter(station => geocodeAddressFor(station.qrz_data) !== null);
}

export function saveGeocodeResult(stationId: number, lat: number | null, lon: number | null): void {
    db.prepare('UPDATE stations SET geocoded_lat = ?, geocoded_lon = ?, geocoded_at = ? WHERE id = ?')
        .run(lat, lon, new Date().toISOString(), stationId);
}

export function getGeocodingStatus(): GeocodingStatus {
    const counts = db.prepare<{ geocoded: number | null; no_match: number | null }>(`
        SELECT
            SUM(CASE WHEN geocoded_at IS NOT NULL AND geocoded_lat IS NOT NULL THEN 1 ELSE 0 END) AS geocoded,
            SUM(CASE WHEN geocoded_at IS NOT NULL AND geocoded_lat IS NULL THEN 1 ELSE 0 END) AS no_match
        FROM stations
    `).get();

    return {
        geocoded: counts?.geocoded ?? 0,
        no_match: counts?.no_match ?? 0,
        pending: listStationsNeedingGeocode().length
    };
}