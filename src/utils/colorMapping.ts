/**
 * Scientific Color Mapping Utility
 * Accurate color gradients for oceanographic models (Temperature, Salinity, Velocity)
 */

import { ColorPaletteId, ColorStop } from '../types';

export const COLOR_PALETTES: Record<ColorPaletteId, { name: string; stops: ColorStop[] }> = {
  thermal: {
    name: 'Thermal / Turbo (Temperature)',
    stops: [
      { stop: 0.0, r: 26, g: 35, b: 126 },   // deep navy
      { stop: 0.15, r: 33, g: 150, b: 243 }, // ocean blue
      { stop: 0.35, r: 0, g: 230, b: 118 },  // aqua-green
      { stop: 0.55, r: 255, g: 235, b: 59 }, // warm yellow
      { stop: 0.75, r: 255, g: 112, b: 67 }, // coral orange
      { stop: 1.0, r: 213, g: 0, b: 0 },     // deep thermal red
    ],
  },
  haline: {
    name: 'Haline (Salinity)',
    stops: [
      { stop: 0.0, r: 15, g: 23, b: 42 },    // deep abyss slate
      { stop: 0.2, r: 14, g: 116, b: 144 },  // deep cyan
      { stop: 0.45, r: 6, g: 182, b: 212 },  // bright cyan
      { stop: 0.7, r: 16, g: 185, b: 129 },  // emerald
      { stop: 0.88, r: 234, g: 179, b: 8 },  // golden amber
      { stop: 1.0, r: 249, g: 115, b: 22 },  // hyper-saline orange
    ],
  },
  viridis: {
    name: 'Velocity Gradient (Blue → Cyan → Green → Yellow → Red)',
    stops: [
      { stop: 0.0, r: 30, g: 64, b: 175 },   // blue
      { stop: 0.2, r: 6, g: 182, b: 212 },   // cyan
      { stop: 0.45, r: 34, g: 197, b: 94 },  // green
      { stop: 0.7, r: 234, g: 179, b: 8 },   // yellow
      { stop: 0.88, r: 249, g: 115, b: 22 }, // orange
      { stop: 1.0, r: 220, g: 38, b: 38 },   // red
    ],
  },
  plasma: {
    name: 'Plasma (High Contrast)',
    stops: [
      { stop: 0.0, r: 13, g: 8, b: 135 },    // deep blue
      { stop: 0.25, r: 126, g: 3, b: 168 },  // purple
      { stop: 0.5, r: 204, g: 71, b: 120 },  // magenta
      { stop: 0.75, r: 248, g: 149, b: 64 }, // orange
      { stop: 1.0, r: 240, g: 249, b: 33 },  // yellow
    ],
  },
  ocean_deep: {
    name: 'Oceanic Abyss',
    stops: [
      { stop: 0.0, r: 2, g: 6, b: 23 },      // ocean trench
      { stop: 0.25, r: 8, g: 47, b: 73 },    // bathyal
      { stop: 0.5, r: 3, g: 105, b: 161 },   // mesopelagic
      { stop: 0.75, r: 56, g: 189, b: 248 }, // epipelagic
      { stop: 1.0, r: 224, g: 242, b: 254 }, // surface crest
    ],
  },
};

/**
 * Interpolates an RGB color given normalized t in [0, 1]
 */
export function interpolateColor(
  t: number,
  paletteId: ColorPaletteId = 'thermal'
): { r: number; g: number; b: number } {
  const palette = COLOR_PALETTES[paletteId] || COLOR_PALETTES.thermal;
  const stops = palette.stops;

  // Clamp t
  const clampedT = Math.max(0, Math.min(1, isNaN(t) ? 0 : t));

  if (clampedT <= stops[0].stop) {
    return { r: stops[0].r, g: stops[0].g, b: stops[0].b };
  }
  if (clampedT >= stops[stops.length - 1].stop) {
    const last = stops[stops.length - 1];
    return { r: last.r, g: last.g, b: last.b };
  }

  // Find surrounding stops
  for (let i = 0; i < stops.length - 1; i++) {
    const s0 = stops[i];
    const s1 = stops[i + 1];
    if (clampedT >= s0.stop && clampedT <= s1.stop) {
      const factor = (clampedT - s0.stop) / (s1.stop - s0.stop);
      const r = Math.round(s0.r + factor * (s1.r - s0.r));
      const g = Math.round(s0.g + factor * (s1.g - s0.g));
      const b = Math.round(s0.b + factor * (s1.b - s0.b));
      return { r, g, b };
    }
  }

  return { r: stops[0].r, g: stops[0].g, b: stops[0].b };
}

export function getRgbString(
  t: number,
  paletteId: ColorPaletteId,
  alpha = 1.0
): string {
  const { r, g, b } = interpolateColor(t, paletteId);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getHexColor(t: number, paletteId: ColorPaletteId): string {
  const { r, g, b } = interpolateColor(t, paletteId);
  const toHex = (c: number) => c.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Returns a CSS linear-gradient string for color legend bars
 */
export function getCssGradient(paletteId: ColorPaletteId, direction = 'to right'): string {
  const palette = COLOR_PALETTES[paletteId] || COLOR_PALETTES.thermal;
  const stopsStr = palette.stops
    .map((s) => `rgb(${s.r}, ${s.g}, ${s.b}) ${Math.round(s.stop * 100)}%`)
    .join(', ');
  return `linear-gradient(${direction}, ${stopsStr})`;
}
