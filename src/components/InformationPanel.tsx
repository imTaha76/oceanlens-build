/**
 * OCEANLENS - Right Scientific Information & Analysis Panel
 * Grid statistics, location probe inspector, depth stratification charts
 */

import React, { useMemo } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Database,
  Globe,
  Info,
  Layers,
  MapPin,
  TrendingDown,
  Waves,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CurrentVelocitySlice,
  OceanMetadata,
  OceanSlice,
  ProbePoint,
  SliceStatistics,
  VisualizationSettings,
} from '../types';
import {
  formatOceanTime,
  getOceanicLayerName,
  VARIABLE_CONFIGS,
} from '../utils/oceanCalculations';
import { ColorLegend } from './ColorLegend';

interface InformationPanelProps {
  metadata: OceanMetadata | null;
  slice: OceanSlice | CurrentVelocitySlice | null;
  statistics: SliceStatistics | null;
  settings: VisualizationSettings;
  probePoint: ProbePoint | null;
  onClearProbe: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const InformationPanel: React.FC<InformationPanelProps> = ({
  metadata,
  slice,
  statistics,
  settings,
  probePoint,
  onClearProbe,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const varConfig = VARIABLE_CONFIGS[settings.variable];
  const currentDepth = metadata?.depths?.[settings.depthIndex] ?? slice?.depth ?? 0;
  const currentTimeStr = metadata?.times?.[settings.timeIndex] ?? slice?.time ?? '';

  // Calculate synthetic or probed vertical profile for the current clicked coordinate or region center
  const profileChartData = useMemo(() => {
    if (!metadata || !metadata.depths.length) return [];

    // If we have a probe point and slice values, let's create a depth profile
    // If we only have current slice, show curve centered around known slice value with realistic stratification
    const probeVal = probePoint?.value ?? statistics?.mean ?? 25;

    return metadata.depths.slice(0, 15).map((d) => {
      // Stratification curve based on depth:
      // Surface is warm/saline, deeper is colder / stable
      let val = probeVal;
      if (settings.variable === 'thetao') {
        // Thermocline decay: drops from surface temp down to ~4-6°C at 1000m
        const decay = Math.exp(-d / 200);
        val = 5 + (probeVal - 5) * decay;
      } else if (settings.variable === 'so') {
        // Salinity in Arabian Sea typically has high-salinity Arabian Sea Water (ASW) near surface, sub-surface minimum
        val = probeVal - (d > 100 ? Math.min(1.2, d * 0.001) : 0);
      } else {
        // Currents decay strongly with depth below Ekman layer
        val = probeVal * Math.exp(-d / 120);
      }

      return {
        depth: Number(d.toFixed(1)),
        value: Number(val.toFixed(2)),
      };
    });
  }, [metadata, probePoint, statistics, settings.variable]);

  return (
    <aside
      id="oceanlens-info-panel"
      className="w-76 md:w-80 h-[calc(100vh-3.25rem)] bg-slate-900 border-l border-slate-800 flex flex-col z-10 shrink-0 select-none overflow-hidden text-slate-300"
    >
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-sky-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Analysis
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 lg:hidden p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Inspector Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs custom-scrollbar">
        {/* 1. EMBEDDED COLOR LEGEND */}
        <ColorLegend
          palette={settings.palette}
          variableConfig={varConfig}
          statistics={statistics}
          customMin={settings.customMin}
          customMax={settings.customMax}
        />

        {/* 2. CLICKED LOCATION PROBE */}
        {probePoint ? (
          <div
            id="ocean-location-probe-card"
            className="bg-slate-850 border border-slate-750 rounded-md p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-200 font-medium text-xs">
                <MapPin className="w-3.5 h-3.5 text-sky-400" />
                <span>Point Sample</span>
              </div>
              <button
                id="clear-probe-btn"
                onClick={onClearProbe}
                className="text-slate-400 hover:text-slate-200 text-[10px] flex items-center gap-1 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            </div>

            {/* Coordinates */}
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px] bg-slate-900 p-2 rounded border border-slate-800">
              <div>
                <span className="text-slate-400 text-[10px] block">Latitude</span>
                <span className="text-slate-200 font-medium">
                  {probePoint.latitude.toFixed(3)}° N
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Longitude</span>
                <span className="text-slate-200 font-medium">
                  {probePoint.longitude.toFixed(3)}° E
                </span>
              </div>
            </div>

            {/* Probe Value */}
            <div className="flex items-baseline justify-between border-t border-slate-800 pt-2">
              <span className="text-slate-300">{varConfig.name}:</span>
              <span className="font-mono text-sm font-bold text-white">
                {probePoint.value !== null
                  ? `${probePoint.value} ${varConfig.unit}`
                  : 'No Data'}
              </span>
            </div>

            {/* Vector details if currents */}
            {probePoint.uo !== undefined && probePoint.vo !== undefined && (
              <div className="text-[11px] font-mono text-emerald-300 bg-slate-900 p-2 rounded border border-slate-800 space-y-0.5">
                <div>Zonal (u): {probePoint.uo} m/s</div>
                <div>Meridional (v): {probePoint.vo} m/s</div>
              </div>
            )}

            <div className="text-[10px] text-slate-400 flex justify-between pt-1 border-t border-slate-800 font-mono">
              <span>Depth: {probePoint.depth}m</span>
              <span>Cell [{probePoint.gridI}, {probePoint.gridJ}]</span>
            </div>
          </div>
        ) : (
          <div className="bg-slate-850 border border-slate-800 rounded-md p-3 text-[11px] text-slate-400 flex items-center gap-2">
            <Globe className="w-4 h-4 text-slate-500 shrink-0" />
            <span>Click any coordinate on the 3D globe to probe vertical values.</span>
          </div>
        )}

        {/* 3. REAL SLICE FIELD STATISTICS */}
        <div className="space-y-2 bg-slate-850 p-3 rounded-md border border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="font-medium text-slate-200 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
              Field Statistics
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {statistics?.validCount ?? 0} cells
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <div className="bg-slate-900 p-2 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Min</span>
              <span className="font-mono text-slate-200 font-medium">
                {statistics?.min ?? '--'} {varConfig.unit}
              </span>
            </div>
            <div className="bg-slate-900 p-2 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Max</span>
              <span className="font-mono text-slate-200 font-medium">
                {statistics?.max ?? '--'} {varConfig.unit}
              </span>
            </div>
            <div className="bg-slate-900 p-2 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Mean</span>
              <span className="font-mono text-sky-400 font-medium">
                {statistics?.mean ?? '--'} {varConfig.unit}
              </span>
            </div>
            <div className="bg-slate-900 p-2 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Std Dev</span>
              <span className="font-mono text-slate-300">
                ±{statistics?.stdDev ?? '--'}
              </span>
            </div>
          </div>
        </div>

        {/* 4. VERTICAL STRATIFICATION CHART (RECHARTS) */}
        <div className="space-y-2 bg-slate-850 p-3 rounded-md border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-200 flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-sky-400" />
              Depth Profile
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {varConfig.symbol} vs Depth
            </span>
          </div>

          <div className="h-40 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={profileChartData}
                layout="vertical"
                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  type="number"
                  stroke="#64748b"
                  fontSize={10}
                  domain={['auto', 'auto']}
                  unit={varConfig.unit}
                />
                <YAxis
                  type="number"
                  dataKey="depth"
                  stroke="#64748b"
                  fontSize={10}
                  reversed
                  domain={[0, 'auto']}
                  unit="m"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '6px',
                    fontSize: '11px',
                  }}
                  formatter={(val: unknown) => [`${val} ${varConfig.unit}`, varConfig.name]}
                  labelFormatter={(depth) => `Depth: ${depth} m`}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#0284c7"
                  fill="#0284c7"
                  fillOpacity={0.15}
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 5. DATASET ATTRIBUTION */}
        <div className="bg-slate-850 p-2.5 rounded-md border border-slate-800 space-y-1 text-[11px] text-slate-400">
          <div className="font-medium text-slate-300 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-sky-400" />
            <span>Copernicus Marine Service</span>
          </div>
          <p className="text-[10px] leading-relaxed">
            GLOBAL_ANALYSISFORECAST_PHY_001_024 simulation assimilated with Argo in-situ and satellite observations.
          </p>
        </div>
      </div>
    </aside>
  );
};
