import L from 'leaflet';

import type { Checkin } from '../api';

export interface LocatedCheckin {
    checkin: Checkin;
    lat: number;
    lon: number;
}

export const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const OSM_BACKGROUND = '#f2efe9';
export const DARK_BACKGROUND = '#1f1d18';
export const DARK_TILE_FILTER = 'invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%)';
export const RING_RADIUS_PX = 26;
export const RING_BASE_CAPACITY = 8;
export const MARKER_COLOR = '#4338ca';
export const MARKER_FILL = '#818cf8';
export const LEADER_COLOR = '#475569';
export const DARK_LEADER_COLOR = '#94a3b8';
export const DARK_APPROXIMATE_STROKE = '#a5b4fc';
export const NCS_COLOR = '#f59e0b';
export const HULL_COLOR = '#6366f1';

export interface BaseMap {
    url: string;
    attribution: string;
    filter: string;
    background: string;
}

export function baseMapFor(dark: boolean): BaseMap {
    return {
        url: OSM_URL,
        attribution: OSM_ATTRIBUTION,
        filter: dark ? DARK_TILE_FILTER : 'none',
        background: dark ? DARK_BACKGROUND : OSM_BACKGROUND
    };
}

export function mapColorsFor(dark: boolean): { leader: string; approximateStroke: string } {
    return dark
        ? { leader: DARK_LEADER_COLOR, approximateStroke: DARK_APPROXIMATE_STROKE }
        : { leader: LEADER_COLOR, approximateStroke: MARKER_COLOR };
}

export const PRECISION_NOTES: Record<string, string | null> = {
    address: null,
    zip: 'Approximate: ZIP code center',
    grid: 'Approximate: grid square center',
    state: 'Approximate: state center',
    country: 'Approximate: country center',
    unknown: 'Location precision not reported by QRZ'
};

export const APPROXIMATE_PRECISIONS = ['zip', 'grid', 'state', 'country'];

export const LABEL_OFFSETS: Record<string, L.PointExpression> = {
    left: [-8, 0],
    right: [8, 0],
    top: [0, -8],
    bottom: [0, 8]
};

export const CLUSTER_DISTANCE_PX = 16;

export interface PixelCluster<T> {
    items: T[];
    x: number;
    y: number;
}

/** Greedy clustering by pixel proximity; x/y is the centroid of each cluster */
export function clusterByPixel<T>(items: T[], project: (item: T) => { x: number; y: number }, threshold = CLUSTER_DISTANCE_PX): PixelCluster<T>[] {
    const clusters: (PixelCluster<T> & { sumX: number; sumY: number })[] = [];
    for (const item of items) {
        const point = project(item);
        let target: (typeof clusters)[number] | undefined;
        let best = threshold;
        for (const cluster of clusters) {
            const distance = Math.hypot(cluster.x - point.x, cluster.y - point.y);
            if (distance <= best) {
                best = distance;
                target = cluster;
            }
        }
        if (target) {
            target.items.push(item);
            target.sumX += point.x;
            target.sumY += point.y;
            target.x = target.sumX / target.items.length;
            target.y = target.sumY / target.items.length;
        } else {
            clusters.push({ items: [item], x: point.x, y: point.y, sumX: point.x, sumY: point.y });
        }
    }
    return clusters;
}

export function ringOffset(index: number, count: number): L.Point {
    let ring = 0;
    let start = 0;
    let capacity = RING_BASE_CAPACITY;
    while (index >= start + capacity) {
        start += capacity;
        ring += 1;
        capacity = RING_BASE_CAPACITY * (ring + 1);
    }
    const inRing = Math.min(capacity, count - start);
    const angle = -Math.PI / 2 + (2 * Math.PI * (index - start)) / inRing;
    const radius = RING_RADIUS_PX * (ring + 1);
    return L.point(Math.cos(angle) * radius, Math.sin(angle) * radius);
}

export function labelDirection(offset: L.Point): L.Direction {
    if (Math.abs(offset.x) >= Math.abs(offset.y) / 2)
        return offset.x < 0 ? 'left' : 'right';
    return offset.y < 0 ? 'top' : 'bottom';
}