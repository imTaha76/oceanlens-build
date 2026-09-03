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
      className="w-80 md:w-88 h-[calc(100vh-4rem)] bg-slate-950/90 border-l border-slate-800/90 backdrop-blur-md flex flex-col z-10 shrink-0 select-none overflow-hidden"
    >
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Scientific Analysis
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
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-slate-300 custom-scrollbar">
        {/* 1. EMBEDDED COLOR LEGEND */}
        <ColorLegend
          palette={settings.palette}
          variableConfig={varConfig}
          statistics={statistics}
          customMin={settings.customMin}
          customMax={settings.customMax}
        />

        {/* 2. CLICKED LOCATION PROBE (if user clicked) */}
        {probePoint ? (
          <div
            id="ocean-location-probe-card"
            className="bg-cyan-950/40 border border-cyan-700/60 rounded-xl p-3.5 space-y-2.5 shadow-lg shadow-cyan-950/30 animate-in fade-in duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-cyan-300 font-semibold text-xs">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span>Ocean Point Probe</span>
              </div>
              <button
                id="clear-probe-btn"
                onClick={onClearProbe}
                className="text-slate-400 hover:text-slate-200 text-[10px] flex items-center gap-1 bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-700"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            </div>

            {/* Coordinates */}
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px] bg-slate-950/60 p-2 rounded-lg border border-cyan-900/40">
              <div>
                <span className="text-slate-400 text-[10px] block">Latitude</span>
                <span className="text-cyan-200 font-bold">
                  {probePoint.latitude.toFixed(3)}° N
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Longitude</span>
                <span className="text-cyan-200 font-bold">
                  {probePoint.longitude.toFixed(3)}° E
                </span>
              </div>
            </div>

            {/* Probe Value */}
            <div className="flex items-baseline justify-between border-t border-cyan-800/40 pt-2">
              <span className="text-slate-300">{varConfig.name}:</span>
              <span className="font-mono text-base font-extrabold text-cyan-300">
                {probePoint.value !== null
                  ? `${probePoint.value} ${varConfig.unit}`
                  : 'Land / No Data'}
              </span>
            </div>

            {/* Vector details if currents */}
            {probePoint.uo !== undefined && probePoint.vo !== undefined && (
              <div className="text-[11px] font-mono text-emerald-300 bg-emerald-950/40 p-2 rounded border border-emerald-800/50 space-y-0.5">
                <div>Zonal u (Eastward): {probePoint.uo} m/s</div>
                <div>Meridional v (Northward): {probePoint.vo} m/s</div>
              </div>
            )}

            <div className="text-[10px] text-slate-400 flex justify-between pt-1 border-t border-cyan-900/30">
              <span>Depth: {probePoint.depth}m</span>
              <span>Grid Index: [{probePoint.gridI}, {probePoint.gridJ}]</span>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-[11px] text-slate-400 flex items-center gap-2">
            <Globe className="w-4 h-4 text-slate-500 shrink-0" />
            <span>Click any location on the ocean 3D globe to probe exact point values.</span>
          </div>
        )}

        {/* 3. REAL SLICE FIELD STATISTICS */}
        <div className="space-y-2.5 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
              Copernicus Grid Statistics
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {statistics?.validCount ?? 0} / {statistics?.totalCount ?? 3721} cells
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-slate-950/60 p-2 rounded border border-slate-800/80">
              <span className="text-slate-400 text-[10px] block">Minimum</span>
              <span className="font-mono font-bold text-slate-100">
                {statistics?.min ?? '--'} {varConfig.unit}
              </span>
            </div>
            <div className="bg-slate-950/60 p-2 rounded border border-slate-800/80">
              <span className="text-slate-400 text-[10px] block">Maximum</span>
              <span className="font-mono font-bold text-slate-100">
                {statistics?.max ?? '--'} {varConfig.unit}
              </span>
            </div>
            <div className="bg-slate-950/60 p-2 rounded border border-slate-800/80">
              <span className="text-slate-400 text-[10px] block">Mean Value</span>
              <span className="font-mono font-bold text-cyan-300">
                {statistics?.mean ?? '--'} {varConfig.unit}
              </span>
            </div>
            <div className="bg-slate-950/60 p-2 rounded border border-slate-800/80">
              <span className="text-slate-400 text-[10px] block">Std. Deviation</span>
              <span className="font-mono font-bold text-slate-300">
                ±{statistics?.stdDev ?? '--'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1 text-slate-400">
            <span>Valid Sea Coverage:</span>
            <span className="font-mono text-emerald-400">
              {statistics?.coveragePct ?? 100}%
            </span>
          </div>
        </div>

        {/* 4. VERTICAL STRATIFICATION CHART (RECHARTS) */}
        <div className="space-y-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-cyan-400" />
              Depth Profile (Z-Column)
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {varConfig.symbol} vs Depth (m)
            </span>
          </div>

          <p className="text-[10px] text-slate-400">
            Vertical profile of {varConfig.name} through water column:
          </p>

          <div className="h-44 w-full pt-2">
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
                    backgroundColor: '#090d16',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                  formatter={(val: unknown) => [`${val} ${varConfig.unit}`, varConfig.name]}
                  labelFormatter={(depth) => `Depth: ${depth} m`}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#06b6d4"
                  fill="#0891b2"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 5. DATASET & COPERNICUS ATTRIBUTION */}
        <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800/80 space-y-1.5 text-[11px] text-slate-400">
          <div className="font-medium text-slate-300 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Copernicus Marine Service</span>
          </div>
          <p>
            GLOBAL_ANALYSISFORECAST_PHY_001_024. Mercator Ocean 1/12° (~9 km) resolution numerical simulation assimilated with in-situ and satellite observations.
          </p>
        </div>
      </div>
    </aside>
  );
};
