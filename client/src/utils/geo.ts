import type { Checkin } from '../api';

export interface LatLon {
    lat: number;
    lon: number;
}

const EARTH_RADIUS_KM = 6371.0088;
const MAX_MERCATOR_LAT = 85.0511287798;
const TILE_SIZE = 256;
const EQUATOR_METERS = 40075016.686;

function toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

export function distanceKm(a: LatLon, b: LatLon): number {
    const dLat = toRadians(b.lat - a.lat);
    const dLon = toRadians(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2
        + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Web Mercator world pixel coordinates (y grows southward) at an integer zoom level */
export function toWorldPixel(point: LatLon, zoom: number): { x: number; y: number } {
    const scale = TILE_SIZE * 2 ** zoom;
    const lat = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, point.lat));
    const sin = Math.sin(toRadians(lat));
    return {
        x: ((point.lon + 180) / 360) * scale,
        y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale
    };
}

export function metersPerPixel(lat: number, zoom: number): number {
    return (EQUATOR_METERS * Math.cos(toRadians(lat))) / 2 ** (zoom + 8);
}

/**
 * Convex hull (monotone chain) computed in Web Mercator space, returned counter-clockwise as lat/lon.
 * Fewer than 3 distinct points, or collinear points, return the 1-2 extreme points.
 */
export function convexHull(points: LatLon[]): LatLon[] {
    const projected = points.map((p) => {
        const world = toWorldPixel(p, 20);
        return { x: world.x, y: -world.y, point: p };
    });
    projected.sort((a, b) => a.x - b.x || a.y - b.y);

    const unique = projected.filter((p, i) => i === 0 || p.x !== projected[i - 1].x || p.y !== projected[i - 1].y);
    if (unique.length < 3)
        return unique.map(p => p.point);

    type Projected = typeof unique[number];
    const cross = (o: Projected, a: Projected, b: Projected): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

    const lower: Projected[] = [];
    for (const p of unique) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
            lower.pop();
        lower.push(p);
    }
    const upper: Projected[] = [];
    for (let i = unique.length - 1; i >= 0; i--) {
        const p = unique[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
            upper.pop();
        upper.push(p);
    }
    lower.pop();
    upper.pop();
    return [...lower, ...upper].map(p => p.point);
}

/** True for address-level positions (QRZ address or a geocoded address) */
export function isPrecise(checkin: Pick<Checkin, 'location_precision'>): boolean {
    return checkin.location_precision === 'address';
}