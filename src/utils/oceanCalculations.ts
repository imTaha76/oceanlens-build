/**
 * Scientific Ocean Calculations Utility
 * Direct computations from real Copernicus ocean grid data
 */

import {
  CurrentVelocitySlice,
  OceanSlice,
  OceanVariable,
  ProbePoint,
  SliceStatistics,
  VariableConfig,
} from '../types';

export const VARIABLE_CONFIGS: Record<OceanVariable, VariableConfig> = {
  thetao: {
    id: 'thetao',
    name: 'Sea Water Potential Temperature',
    code: 'thetao',
    unit: '°C',
    symbol: 'T',
    description: 'Copernicus Sea Water Potential Temperature in Arabian Sea',
    defaultMin: 15,
    defaultMax: 31,
    palette: 'thermal',
  },
  so: {
    id: 'so',
    name: 'Sea Water Salinity',
    code: 'so',
    unit: 'PSU',
    symbol: 'S',
    description: 'Copernicus Sea Water Practical Salinity',
    defaultMin: 34.0,
    defaultMax: 37.5,
    palette: 'haline',
  },
  uo: {
    id: 'uo',
    name: 'Eastward Current Velocity',
    code: 'uo',
    unit: 'm/s',
    symbol: 'u',
    description: 'Zonal eastward component of ocean velocity',
    defaultMin: -1.0,
    defaultMax: 1.0,
    palette: 'plasma',
  },
  vo: {
    id: 'vo',
    name: 'Northward Current Velocity',
    code: 'vo',
    unit: 'm/s',
    symbol: 'v',
    description: 'Meridional northward component of ocean velocity',
    defaultMin: -1.0,
    defaultMax: 1.0,
    palette: 'plasma',
  },
  currents: {
    id: 'currents',
    name: 'Ocean Current Velocity Field',
    code: 'V_mag',
    unit: 'm/s',
    symbol: '|V|',
    description: 'Combined horizontal current speed: √(uo² + vo²)',
    defaultMin: 0.0,
    defaultMax: 1.5,
    palette: 'viridis',
  },
};

/**
 * Calculates real statistics from a 2D ocean data array
 */
export function calculateSliceStatistics(
  values: (number | null)[][]
): SliceStatistics {
  const validVals: number[] = [];
  let totalCount = 0;

  for (let r = 0; r < values.length; r++) {
    const row = values[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      totalCount++;
      const val = row[c];
      if (val !== null && val !== undefined && !isNaN(val)) {
        validVals.push(val);
      }
    }
  }

  if (validVals.length === 0) {
    return {
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      stdDev: 0,
      validCount: 0,
      totalCount,
      coveragePct: 0,
    };
  }

  let min = validVals[0];
  let max = validVals[0];
  let sum = 0;

  for (let i = 0; i < validVals.length; i++) {
    const v = validVals[i];
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }

  const mean = sum / validVals.length;

  // Standard Deviation
  let varianceSum = 0;
  for (let i = 0; i < validVals.length; i++) {
    varianceSum += Math.pow(validVals[i] - mean, 2);
  }
  const stdDev = Math.sqrt(varianceSum / validVals.length);

  // Median (approximate using sample if too large, or sort directly)
  const sorted = [...validVals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;

  return {
    min: Number(min.toFixed(3)),
    max: Number(max.toFixed(3)),
    mean: Number(mean.toFixed(3)),
    median: Number(median.toFixed(3)),
    stdDev: Number(stdDev.toFixed(3)),
    validCount: validVals.length,
    totalCount,
    coveragePct: Number(((validVals.length / totalCount) * 100).toFixed(1)),
  };
}

/**
 * Combines uo (eastward) and vo (northward) ocean slices into a CurrentVelocitySlice
 * Computes speed = sqrt(uo^2 + vo^2) and flow direction angle
 */
export function combineCurrentSlices(
  uoSlice: OceanSlice,
  voSlice: OceanSlice
): CurrentVelocitySlice {
  const rows = uoSlice.values.length;
  const cols = uoSlice.values[0]?.length || 0;

  const magnitudes: (number | null)[][] = [];
  const directions: (number | null)[][] = [];

  for (let r = 0; r < rows; r++) {
    const magRow: (number | null)[] = [];
    const dirRow: (number | null)[] = [];
    for (let c = 0; c < cols; c++) {
      const u = uoSlice.values[r]?.[c];
      const v = voSlice.values[r]?.[c];

      if (
        u !== null &&
        u !== undefined &&
        !isNaN(u) &&
        v !== null &&
        v !== undefined &&
        !isNaN(v)
      ) {
        const speed = Math.sqrt(u * u + v * v);
        const dir = Math.atan2(v, u); // radians
        magRow.push(Number(speed.toFixed(4)));
        dirRow.push(Number(dir.toFixed(4)));
      } else {
        magRow.push(null);
        dirRow.push(null);
      }
    }
    magnitudes.push(magRow);
    directions.push(dirRow);
  }

  return {
    variable: 'currents',
    depth: uoSlice.depth,
    time: uoSlice.time,
    latitude: uoSlice.latitude,
    longitude: uoSlice.longitude,
    values: magnitudes,
    uoValues: uoSlice.values,
    voValues: voSlice.values,
    magnitudes,
    directions,
  };
}

/**
 * Finds the nearest grid point for clicked geographic coordinates (lat, lon)
 */
export function probeOceanLocation(
  lat: number,
  lon: number,
  slice: OceanSlice | CurrentVelocitySlice,
  variable: OceanVariable
): ProbePoint | null {
  const { latitude, longitude, values, depth, time } = slice;

  if (!latitude.length || !longitude.length || !values.length) return null;

  // Find nearest latitude index
  let bestLatIdx = 0;
  let minLatDiff = Math.abs(latitude[0] - lat);
  for (let i = 1; i < latitude.length; i++) {
    const diff = Math.abs(latitude[i] - lat);
    if (diff < minLatDiff) {
      minLatDiff = diff;
      bestLatIdx = i;
    }
  }

  // Find nearest longitude index
  let bestLonIdx = 0;
  let minLonDiff = Math.abs(longitude[0] - lon);
  for (let j = 1; j < longitude.length; j++) {
    const diff = Math.abs(longitude[j] - lon);
    if (diff < minLonDiff) {
      minLonDiff = diff;
      bestLonIdx = j;
    }
  }

  // Check bounds
  const nearestLat = latitude[bestLatIdx];
  const nearestLon = longitude[bestLonIdx];

  // If clicked point is far outside dataset bounds (> 1.5 degrees), return null
  if (minLatDiff > 1.5 || minLonDiff > 1.5) {
    return null;
  }

  const value = values[bestLatIdx]?.[bestLonIdx] ?? null;
  const config = VARIABLE_CONFIGS[variable];

  let uoVal: number | null = null;
  let voVal: number | null = null;
  if ('uoValues' in slice) {
    uoVal = slice.uoValues[bestLatIdx]?.[bestLonIdx] ?? null;
    voVal = slice.voValues[bestLatIdx]?.[bestLonIdx] ?? null;
  }

  return {
    latitude: Number(nearestLat.toFixed(3)),
    longitude: Number(nearestLon.toFixed(3)),
    depth: Number(depth.toFixed(1)),
    value: value !== null ? Number(value.toFixed(3)) : null,
    variable,
    unit: config?.unit || '',
    time,
    gridI: bestLatIdx,
    gridJ: bestLonIdx,
    uo: uoVal !== null ? Number(uoVal.toFixed(3)) : undefined,
    vo: voVal !== null ? Number(voVal.toFixed(3)) : undefined,
  };
}

/**
 * Format timestamp to scientific ISO/human format
 */
export function formatOceanTime(timeStr: string): string {
  try {
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return timeStr;
    return d.toUTCString().replace('GMT', 'UTC');
  } catch {
    return timeStr;
  }
}

/**
 * Format depth into human-readable oceanic layer label
 */
export function getOceanicLayerName(depthMeters: number): string {
  if (depthMeters <= 20) return 'Epipelagic (Surface Layer)';
  if (depthMeters <= 100) return 'Mixed Layer Depth (MLD)';
  if (depthMeters <= 200) return 'Thermocline Zone';
  if (depthMeters <= 1000) return 'Mesopelagic (Twilight Zone)';
  return 'Bathypelagic (Deep Ocean)';
}
