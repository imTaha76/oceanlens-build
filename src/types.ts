/**
 * OCEANLENS - Types & Interfaces
 * Real Copernicus Ocean Model Data Schema
 */

export type OceanVariable = 'thetao' | 'so' | 'uo' | 'vo' | 'currents';

export interface OceanMetadata {
  variables: string[];
  depths: number[];
  times: string[];
  latitude_range: [number, number];
  longitude_range: [number, number];
}

export interface OceanSlice {
  variable: string;
  depth: number;
  time: string;
  latitude: number[];
  longitude: number[];
  values: (number | null)[][];
}
//  Added 
export interface OceanVolume {
  variable: string;
  time: string;

  // Coordinate axes
  depth: number[];
  latitude: number[];
  longitude: number[];

  // 3D values:
  // values[depth][latitude][longitude]
  values: (number | null)[][][];
}

export interface CurrentVelocitySlice extends OceanSlice {
  variable: 'currents';
  uoValues: (number | null)[][];
  voValues: (number | null)[][];
  magnitudes: (number | null)[][];
  directions: (number | null)[][]; // in radians (-PI to PI)
}

export interface VariableConfig {
  id: OceanVariable;
  name: string;
  code: string;
  unit: string;
  symbol: string;
  description: string;
  defaultMin: number;
  defaultMax: number;
  palette: ColorPaletteId;
}

export type ColorPaletteId = 'thermal' | 'haline' | 'viridis' | 'plasma' | 'ocean_deep';

export interface ColorStop {
  stop: number;
  r: number;
  g: number;
  b: number;
}

export interface SliceStatistics {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  validCount: number;
  totalCount: number;
  coveragePct: number;
}

export interface ProbePoint {
  latitude: number;
  longitude: number;
  depth: number;
  value: number | null;
  variable: OceanVariable;
  unit: string;
  time: string;
  gridI?: number;
  gridJ?: number;
  uo?: number | null;
  vo?: number | null;
}

export type BasemapMode = 'satellite' | 'ocean_dark' | 'osm';

export interface VisualizationSettings {
  variable: OceanVariable;
  depthIndex: number;
  timeIndex: number;
  palette: ColorPaletteId;
  opacity: number;
  verticalExaggeration: number;
  customMin: number | null;
  customMax: number | null;
  showVectors: boolean;
  showGridLines: boolean;
  showCoastlines: boolean;
  basemap: BasemapMode;
  render3DDepth: boolean;
  interpolation: 'bilinear' | 'nearest';
  crossSectionMode: boolean;
  crossSectionType: 'latitudinal' | 'longitudinal';
  crossSectionCoordinate: number; // lat or lon value
}
