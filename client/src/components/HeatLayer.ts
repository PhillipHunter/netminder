import L from 'leaflet';

import {
    metersPerPixel,
    type LatLon
} from '../utils/geo';

export interface PixelPoint {
    x: number;
    y: number;
}

export const HEAT_RADIUS_METERS = 5000;
const HEAT_MAX_OPACITY = 0.6;
const HEAT_BLOB_ALPHA = 0.35;
const HEAT_FULL_ALPHA = 90;
const HEAT_PANE = 'netminderHeat';

let paletteCache: Uint8ClampedArray | null = null;

function getPalette(): Uint8ClampedArray {
    if (paletteCache)
        return paletteCache;
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return new Uint8ClampedArray(256 * 4);
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, '#0000ff');
    gradient.addColorStop(0.25, '#00ffff');
    gradient.addColorStop(0.5, '#00ff00');
    gradient.addColorStop(0.75, '#ffff00');
    gradient.addColorStop(1, '#ff0000');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1, 256);
    paletteCache = ctx.getImageData(0, 0, 1, 256).data;
    return paletteCache;
}

/**
 * Draws a density heatmap onto ctx: alpha-blended radial blobs on an offscreen canvas,
 * colorized through a blue-to-red palette (simpleheat style).
 */
export function drawHeat(ctx: CanvasRenderingContext2D, points: PixelPoint[], radius: number, width: number, height: number): void {
    const w = Math.ceil(width);
    const h = Math.ceil(height);
    if (points.length === 0 || w <= 0 || h <= 0)
        return;

    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const off = offscreen.getContext('2d', { willReadFrequently: true });
    if (!off)
        return;

    off.globalAlpha = HEAT_BLOB_ALPHA;
    for (const p of points) {
        const gradient = off.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
        gradient.addColorStop(0, 'rgba(0,0,0,1)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        off.fillStyle = gradient;
        off.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
    }

    const image = off.getImageData(0, 0, w, h);
    const data = image.data;
    const palette = getPalette();
    for (let i = 3; i < data.length; i += 4) {
        const alpha = data[i];
        if (alpha === 0)
            continue;
        const index = alpha * 4;
        data[i - 3] = palette[index];
        data[i - 2] = palette[index + 1];
        data[i - 1] = palette[index + 2];
        data[i] = Math.round(Math.min(1, alpha / HEAT_FULL_ALPHA) * 255 * HEAT_MAX_OPACITY);
    }
    off.globalAlpha = 1;
    off.putImageData(image, 0, 0);
    ctx.drawImage(offscreen, 0, 0);
}

/** Leaflet layer that renders drawHeat on its own canvas in a pane below the vector overlays */
export class HeatLayer extends L.Layer {
    private heatPoints: LatLon[];
    private canvas: HTMLCanvasElement | null = null;
    private heatMap: L.Map | null = null;
    private readonly handleRedraw = (): void => {
        this.redraw();
    };

    constructor(points: LatLon[]) {
        super();
        this.heatPoints = points;
    }

    onAdd(map: L.Map): this {
        const pane = map.getPane(HEAT_PANE) ?? map.createPane(HEAT_PANE);
        pane.style.zIndex = '390';
        pane.style.pointerEvents = 'none';

        const canvas = L.DomUtil.create('canvas', 'leaflet-zoom-hide');
        canvas.style.pointerEvents = 'none';
        pane.appendChild(canvas);
        this.canvas = canvas;
        this.heatMap = map;

        map.on('moveend zoomend resize', this.handleRedraw);
        this.redraw();
        return this;
    }

    onRemove(map: L.Map): this {
        map.off('moveend zoomend resize', this.handleRedraw);
        this.canvas?.remove();
        this.canvas = null;
        this.heatMap = null;
        return this;
    }

    private redraw(): void {
        const map = this.heatMap;
        const canvas = this.canvas;
        if (!map || !canvas)
            return;

        const size = map.getSize();
        const topLeft = map.containerPointToLayerPoint([0, 0]);
        L.DomUtil.setPosition(canvas, topLeft);
        canvas.width = size.x;
        canvas.height = size.y;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        ctx.clearRect(0, 0, size.x, size.y);

        const radius = Math.max(4, HEAT_RADIUS_METERS / metersPerPixel(map.getCenter().lat, map.getZoom()));
        const pixels = this.heatPoints.map((p) => {
            const point = map.latLngToContainerPoint([p.lat, p.lon]);
            return { x: point.x, y: point.y };
        });
        drawHeat(ctx, pixels, radius, size.x, size.y);
    }
}