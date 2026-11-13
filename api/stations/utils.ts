import type { StationDetail } from '@netminder/dal';

import type { StationDetailSchema } from './schema';

export function decodeCallsignParam(raw: string): string | null {
    let decoded: string;

    try {
        decoded = decodeURIComponent(raw);
    } catch {
        return null;
    }

    const trimmed = decoded.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function normalizeCallsignValue(raw: string): string {
    return raw.trim().toUpperCase();
}

export function mapStationDetail(detail: StationDetail): StationDetailSchema {
    return {
        callsign: detail.callsign,
        preferred_name: detail.preferred_name,
        location: detail.location,
        notes: detail.notes,
        qrz_data: detail.qrz_data,
        qrz_last_fetched_at: detail.qrz_last_fetched_at,
        display_name: detail.display_name,
        location_display: detail.location_display
    };
}