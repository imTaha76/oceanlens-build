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
  name?: string;
  region?: string;
  bbox?: [number, number, number, number];
  grid_resolution?: string;
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

export interface DebugPipelineInfo {
  currentVariable: OceanVariable;
  currentDepth: number;
  currentTimeIndex: number;
  currentTimeStr: string;
  apiRequestUrl: string;
  minValue: number | null;
  maxValue: number | null;
  meanValue: number | null;
  unit: string;
  lastRefreshTime: string;
  dataSourceMode: 'backend' | 'embedded' | 'uploaded';
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  latencyMs: number | null;
}

/**
 * Geographic Model Grid Cell for interactive picking & 3D volume analysis
 */
export interface SelectedGridCell {
  minLongitude: number;
  maxLongitude: number;
  minLatitude: number;
  maxLatitude: number;
  centerLongitude: number;
  centerLatitude: number;
  longitudeIndex: number;
  latitudeIndex: number;
}

export interface DepthPoint {
  depth: number;
  thetao: number;
  so: number;
  uo: number;
  vo: number;
  magnitude: number;
}

export interface ObservationProfile {
  id: string;
  type: 'argo' | 'glider';
  name: string;
  platform: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  time: string;
  depths: number[];
  temperatures: (number | null)[];
  salinities: (number | null)[];
}

export interface SubVolumeGrid {
  lons: number[];
  lats: number[];
  depths: number[];
  x: number[];
  y: number[];
  z: number[];
  values: number[];
  minVal: number;
  maxVal: number;
  variable: OceanVariable;
  unit: string;
}

export interface CellVolumetricDataset {
  cell: SelectedGridCell;
  time: string;
  timeIndex: number;
  column: DepthPoint[];
  subVolume: SubVolumeGrid;
  argoObservations: ObservationProfile[];
  gliderObservations: ObservationProfile[];
}
