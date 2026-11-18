import {
    distanceKm,
    geocodeAddress,
    stripStreetType
} from '@netminder/core';

import { getGeocodingEnabled } from '../settings';
import { parseQrzData } from '../utils/qrzDisplay';

import {
    findStationById,
    geocodeAddressFor,
    listStationsNeedingGeocode,
    saveGeocodeResult
} from './geocode';

const MIN_REQUEST_INTERVAL_MS = 1100;
const ERROR_BACKOFF_MS = 60000;
const MAX_QRZ_DISTANCE_KM = 50;

const pending: number[] = [];
const queued = new Set<number>();
let running = false;
let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForRequestSlot(): Promise<void> {
    const wait = lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now();
    if (wait > 0) {
        await sleep(wait);
    }
}

function qrzCoordinates(qrzData: string | null): { lat: number; lon: number } | null {
    const raw = parseQrzData(qrzData)?.raw;
    if (raw?.lat === undefined || raw.lon === undefined || String(raw.lat).trim() === '' || String(raw.lon).trim() === '') {
        return null;
    }

    const lat = Number(raw.lat);
    const lon = Number(raw.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        return null;
    }

    return {
        lat,
        lon
    };
}

/** Returns true when the item is finished, false when it should be retried later. */
async function processStation(stationId: number): Promise<boolean> {
    if (!getGeocodingEnabled()) {
        return true;
    }

    const station = findStationById(stationId);
    if (!station || station.geocoded_at !== null) {
        return true;
    }

    const address = geocodeAddressFor(station.qrz_data);
    if (!address) {
        return true;
    }

    await waitForRequestSlot();

    if (!getGeocodingEnabled()) {
        return true;
    }

    lastRequestAt = Date.now();
    let result = await geocodeAddress(address.parts);
    let usedFallback = false;

    if (result.status === 'no_match') {
        const stripped = stripStreetType(address.parts.street);
        if (stripped) {
            await waitForRequestSlot();

            if (!getGeocodingEnabled()) {
                return true;
            }

            lastRequestAt = Date.now();
            result = await geocodeAddress({
                ...address.parts,
                street: stripped.street
            }, { roadPrefix: stripped.roadName });
            usedFallback = true;
        }
    }

    if (result.status === 'error') {
        return false;
    }

    const current = findStationById(stationId);
    if (!current || current.geocoded_at !== null || geocodeAddressFor(current.qrz_data)?.key !== address.key) {
        return true;
    }

    if (result.status === 'no_match') {
        saveGeocodeResult(stationId, null, null);
        console.log(`Geocoder: no match for ${current.callsign}`);
        return true;
    }

    const qrz = qrzCoordinates(current.qrz_data);
    if (qrz && distanceKm(qrz.lat, qrz.lon, result.lat, result.lon) > MAX_QRZ_DISTANCE_KM) {
        saveGeocodeResult(stationId, null, null);
        console.log(`Geocoder: rejected distant match for ${current.callsign}`);
        return true;
    }

    saveGeocodeResult(stationId, result.lat, result.lon);
    if (usedFallback) {
        console.log(`Geocoder: matched ${current.callsign} without road type`);
    } else {
        console.log(`Geocoder: geocoded ${current.callsign}`);
    }
    return true;
}

async function runQueue(): Promise<void> {
    if (running) {
        return;
    }

    running = true;
    try {
        while (pending.length > 0) {
            const stationId = pending[0];

            let done: boolean;
            try {
                done = await processStation(stationId);
            } catch (error) {
                console.error('Geocoder worker error:', error);
                done = true;
            }

            if (done) {
                pending.shift();
                queued.delete(stationId);
            } else {
                await sleep(ERROR_BACKOFF_MS);
            }
        }
    } finally {
        running = false;
    }
}

/**
 * Schedules a station for geocoding and returns immediately. Work is deferred to a timer so it
 * never runs inside the caller's (possibly open) transaction, and the worker re-reads the station.
 */
export function enqueueStationGeocode(stationId: number): void {
    if (queued.has(stationId)) {
        return;
    }

    queued.add(stationId);
    pending.push(stationId);
    setTimeout(() => { void runQueue(); }, 0);
}

export function startGeocodingBackfill(): void {
    if (!getGeocodingEnabled()) {
        return;
    }

    for (const station of listStationsNeedingGeocode()) {
        enqueueStationGeocode(station.id);
    }
}