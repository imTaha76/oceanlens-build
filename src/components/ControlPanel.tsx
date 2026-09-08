/**
 * OCEANLENS - Left Control Panel
 * Parameter tuning, dynamic depth/time sliders, scientific colormaps, 3D layer settings
 */

import React from 'react';
import {
  Activity,
  Compass,
  Eye,
  FastForward,
  Flame,
  Grid,
  Layers,
  MapPin,
  Maximize2,
  Navigation,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Thermometer,
  Waves,
  Wind,
} from 'lucide-react';
import {
  BasemapMode,
  ColorPaletteId,
  OceanMetadata,
  OceanVariable,
  VisualizationSettings,
} from '../types';
import { COLOR_PALETTES } from '../utils/colorMapping';
import {
  formatOceanTime,
  getOceanicLayerName,
  VARIABLE_CONFIGS,
} from '../utils/oceanCalculations';

interface ControlPanelProps {
  metadata: OceanMetadata | null;
  settings: VisualizationSettings;
  onUpdateSettings: (partial: Partial<VisualizationSettings>) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  animSpeed: number;
  onChangeAnimSpeed: (speed: number) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  metadata,
  settings,
  onUpdateSettings,
  isPlaying,
  onTogglePlay,
  animSpeed,
  onChangeAnimSpeed,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const depths = metadata?.depths || [0.5, 5, 10, 20, 30, 50, 75, 100, 150, 200, 300, 500, 1000];
  const times = metadata?.times || [];
  const currentDepth = depths[settings.depthIndex] ?? 0;
  const currentTimeStr = times[settings.timeIndex] ?? '';

  const activeVarConfig = VARIABLE_CONFIGS[settings.variable];

  // Depth presets (closest index)
  const setDepthPreset = (targetMeters: number) => {
    if (!depths.length) return;
    let closestIdx = 0;
    let minDiff = Math.abs(depths[0] - targetMeters);
    for (let i = 1; i < depths.length; i++) {
      const diff = Math.abs(depths[i] - targetMeters);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    onUpdateSettings({ depthIndex: closestIdx });
  };

  return (
    <aside
      id="oceanlens-control-panel"
      className="w-76 md:w-80 h-[calc(100vh-3.25rem)] bg-slate-900 border-r border-slate-800 flex flex-col z-10 shrink-0 select-none overflow-hidden text-slate-300"
    >
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-sky-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Parameters
          </h2>
        </div>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
          Copernicus
        </span>
      </div>

      {/* Scrollable controls list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs custom-scrollbar">
        {/* 1. VARIABLE SELECTOR */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-200 text-xs">
              Physical Variable
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {activeVarConfig.unit}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-1">
            {/* Temperature (thetao) */}
            <button
              id="var-select-thetao"
              onClick={() =>
                onUpdateSettings({
                  variable: 'thetao',
                  palette: 'thermal',
                  customMin: null,
                  customMax: null,
                })
              }
              className={`flex items-center justify-between px-3 py-2 rounded-md border text-left transition-colors ${
                settings.variable === 'thetao'
                  ? 'bg-slate-800 border-slate-600 text-white font-medium'
                  : 'border-transparent hover:bg-slate-800/60 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Thermometer
                  className={`w-3.5 h-3.5 ${
                    settings.variable === 'thetao' ? 'text-rose-400' : 'text-slate-400'
                  }`}
                />
                <span className="text-xs">Sea Temperature</span>
              </div>
              <span className="font-mono text-[10px] text-slate-400">°C</span>
            </button>

            {/* Salinity (so) */}
            <button
              id="var-select-so"
              onClick={() =>
                onUpdateSettings({
                  variable: 'so',
                  palette: 'haline',
                  customMin: null,
                  customMax: null,
                })
              }
              className={`flex items-center justify-between px-3 py-2 rounded-md border text-left transition-colors ${
                settings.variable === 'so'
                  ? 'bg-slate-800 border-slate-600 text-white font-medium'
                  : 'border-transparent hover:bg-slate-800/60 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Waves
                  className={`w-3.5 h-3.5 ${
                    settings.variable === 'so' ? 'text-sky-400' : 'text-slate-400'
                  }`}
                />
                <span className="text-xs">Salinity</span>
              </div>
              <span className="font-mono text-[10px] text-slate-400">PSU</span>
            </button>

            {/* Current Velocity (combined uo & vo) */}
            <button
              id="var-select-currents"
              onClick={() =>
                onUpdateSettings({
                  variable: 'currents',
                  palette: 'viridis',
                  customMin: null,
                  customMax: null,
                })
              }
              className={`flex items-center justify-between px-3 py-2 rounded-md border text-left transition-colors ${
                settings.variable === 'currents'
                  ? 'bg-slate-800 border-slate-600 text-white font-medium'
                  : 'border-transparent hover:bg-slate-800/60 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Wind
                  className={`w-3.5 h-3.5 ${
                    settings.variable === 'currents' ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                />
                <span className="text-xs">Current Velocity</span>
              </div>
              <span className="font-mono text-[10px] text-slate-400">m/s</span>
            </button>
          </div>
        </div>

        {/* 2. DYNAMIC DEPTH SLIDER FROM /METADATA */}
        <div className="space-y-2 pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-200">
              Depth
            </span>
            <span className="font-mono text-sky-400 font-medium">
              {currentDepth.toFixed(1)} m
            </span>
          </div>

          <div className="text-[11px] text-slate-400">
            {getOceanicLayerName(currentDepth)}
          </div>

          <input
            id="depth-slider"
            type="range"
            min={0}
            max={Math.max(0, depths.length - 1)}
            step={1}
            value={settings.depthIndex}
            onChange={(e) => onUpdateSettings({ depthIndex: Number(e.target.value) })}
            className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded appearance-none"
          />

          {/* Depth Preset Chips */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[
              { label: 'Surface (0.5m)', m: 0.5 },
              { label: '50m', m: 50 },
              { label: '150m', m: 150 },
              { label: '500m', m: 500 },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => setDepthPreset(p.m)}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-750 border border-slate-750 text-[11px] text-slate-300 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. 3D DEPTH & VERTICAL EXAGGERATION */}
        <div className="space-y-2 pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-200">
              3D Subsurface Depth
            </span>
            <input
              id="subsurface-depth-toggle"
              type="checkbox"
              checked={settings.render3DDepth}
              onChange={(e) => onUpdateSettings({ render3DDepth: e.target.checked })}
              className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
            />
          </div>

          {settings.render3DDepth && (
            <div className="space-y-1.5 bg-slate-850 p-2.5 rounded-md border border-slate-800">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Exaggeration:</span>
                <span className="font-mono text-slate-200">
                  {settings.verticalExaggeration}x
                </span>
              </div>
              <input
                id="vertical-exaggeration-slider"
                type="range"
                min={1}
                max={50}
                step={1}
                value={settings.verticalExaggeration}
                onChange={(e) =>
                  onUpdateSettings({ verticalExaggeration: Number(e.target.value) })
                }
                className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded appearance-none"
              />
            </div>
          )}
        </div>

        {/* 4. COLOR PALETTE SELECTOR */}
        <div className="space-y-2 pt-3 border-t border-slate-800">
          <span className="font-medium text-slate-200 block">
            Color Palette
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(COLOR_PALETTES) as ColorPaletteId[]).map((palId) => (
              <button
                key={palId}
                onClick={() => onUpdateSettings({ palette: palId })}
                className={`p-2 rounded-md border text-left flex items-center justify-between transition-colors ${
                  settings.palette === palId
                    ? 'bg-slate-800 border-slate-600 text-white'
                    : 'border-slate-800 hover:bg-slate-800/60 text-slate-400'
                }`}
              >
                <span className="text-[11px]">
                  {COLOR_PALETTES[palId].name}
                </span>
                <span
                  className="w-8 h-2 rounded-xs border border-slate-700 overflow-hidden"
                  style={{
                    background: `linear-gradient(to right, ${COLOR_PALETTES[palId].stops
                      .map((s) => `rgb(${s.r},${s.g},${s.b})`)
                      .join(',')})`,
                  }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* 5. LAYER OPACITY & DISPLAY OPTIONS */}
        <div className="space-y-3 pt-3 border-t border-slate-800">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Layer Opacity</span>
              <span className="font-mono text-slate-300">
                {Math.round(settings.opacity * 100)}%
              </span>
            </div>
            <input
              id="opacity-slider"
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={settings.opacity}
              onChange={(e) => onUpdateSettings({ opacity: Number(e.target.value) })}
              className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded appearance-none"
            />
          </div>

          {/* Current Vectors Option */}
          {settings.variable === 'currents' && (
            <div className="flex items-center justify-between bg-slate-850 p-2 rounded-md border border-slate-800">
              <span className="text-[11px] text-slate-300">
                Velocity Vectors (uo/vo)
              </span>
              <input
                id="show-vectors-toggle"
                type="checkbox"
                checked={settings.showVectors}
                onChange={(e) => onUpdateSettings({ showVectors: e.target.checked })}
                className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
              />
            </div>
          )}

          {/* Globe Grid Lines */}
          <div className="flex items-center justify-between bg-slate-850 p-2 rounded-md border border-slate-800">
            <span className="text-[11px] text-slate-300">
              Globe Latitude/Longitude Grid
            </span>
            <input
              id="show-gridlines-toggle"
              type="checkbox"
              checked={settings.showGridLines}
              onChange={(e) => onUpdateSettings({ showGridLines: e.target.checked })}
              className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
            />
          </div>

          {/* Basemap Selection */}
          <div className="space-y-1.5">
            <span className="text-slate-300 text-xs">Basemap</span>
            <div className="grid grid-cols-3 gap-1">
              {(['satellite', 'ocean_dark', 'osm'] as BasemapMode[]).map((bm) => (
                <button
                  key={bm}
                  onClick={() => onUpdateSettings({ basemap: bm })}
                  className={`py-1 px-2 rounded-md text-[11px] font-medium border text-center transition-colors capitalize ${
                    settings.basemap === bm
                      ? 'bg-slate-800 border-slate-600 text-white'
                      : 'border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  {bm.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
