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
      className="w-80 md:w-88 h-[calc(100vh-4rem)] bg-slate-950/90 border-r border-slate-800/90 backdrop-blur-md flex flex-col z-10 shrink-0 select-none overflow-hidden"
    >
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Observation Controls
          </h2>
        </div>
        <span className="text-[10px] font-mono text-cyan-400/80 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
          CMEMS V4
        </span>
      </div>

      {/* Scrollable controls list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-slate-300 custom-scrollbar">
        {/* 1. VARIABLE SELECTOR */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
              <span>Physical Variable</span>
            </label>
            <span className="text-[10px] font-mono text-slate-400">
              {activeVarConfig.unit}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-1.5">
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
              className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
                settings.variable === 'thetao'
                  ? 'bg-rose-950/40 border-rose-600/70 text-rose-200 shadow-sm shadow-rose-950'
                  : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800/80 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Thermometer
                  className={`w-4 h-4 ${
                    settings.variable === 'thetao' ? 'text-rose-400' : 'text-slate-400'
                  }`}
                />
                <div>
                  <div className="font-medium">Sea Temperature (thetao)</div>
                  <div className="text-[10px] text-slate-400">
                    Potential temperature in °C
                  </div>
                </div>
              </div>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-950/60 border border-slate-700/50">
                °C
              </span>
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
              className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
                settings.variable === 'so'
                  ? 'bg-cyan-950/50 border-cyan-600/70 text-cyan-200 shadow-sm shadow-cyan-950'
                  : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800/80 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Waves
                  className={`w-4 h-4 ${
                    settings.variable === 'so' ? 'text-cyan-400' : 'text-slate-400'
                  }`}
                />
                <div>
                  <div className="font-medium">Salinity (so)</div>
                  <div className="text-[10px] text-slate-400">
                    Practical salinity in PSU
                  </div>
                </div>
              </div>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-950/60 border border-slate-700/50">
                PSU
              </span>
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
              className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
                settings.variable === 'currents'
                  ? 'bg-emerald-950/50 border-emerald-600/70 text-emerald-200 shadow-sm shadow-emerald-950'
                  : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800/80 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Wind
                  className={`w-4 h-4 ${
                    settings.variable === 'currents' ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                />
                <div>
                  <div className="font-medium">Current Velocity Field</div>
                  <div className="text-[10px] text-slate-400">
                    Combined uo & vo magnitude √(u²+v²)
                  </div>
                </div>
              </div>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-950/60 border border-slate-700/50">
                m/s
              </span>
            </button>
          </div>
        </div>

        {/* 2. DYNAMIC DEPTH SLIDER FROM /METADATA */}
        <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-slate-200 flex items-center gap-1.5">
              <span>Depth Layer</span>
              <span className="text-[10px] text-cyan-400 font-mono">
                [Level {settings.depthIndex + 1}/{depths.length}]
              </span>
            </label>
            <span className="font-mono font-bold text-cyan-300 bg-cyan-950/70 px-2 py-0.5 rounded border border-cyan-800/50">
              {currentDepth.toFixed(1)} m
            </span>
          </div>

          <div className="text-[11px] text-slate-400 italic">
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
            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
          />

          {/* Depth Preset Chips */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              onClick={() => setDepthPreset(0.5)}
              className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 transition-colors"
            >
              Surface (0.5m)
            </button>
            <button
              onClick={() => setDepthPreset(50)}
              className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 transition-colors"
            >
              Mixed (50m)
            </button>
            <button
              onClick={() => setDepthPreset(150)}
              className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 transition-colors"
            >
              Thermocline (150m)
            </button>
            <button
              onClick={() => setDepthPreset(500)}
              className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 transition-colors"
            >
              Deep (500m)
            </button>
          </div>
        </div>

        {/* 3. 3D DEPTH & VERTICAL EXAGGERATION */}
        <div className="space-y-3 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-slate-200">
              3D Subsurface Depth Mode
            </label>
            <input
              id="subsurface-depth-toggle"
              type="checkbox"
              checked={settings.render3DDepth}
              onChange={(e) => onUpdateSettings({ render3DDepth: e.target.checked })}
              className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
            />
          </div>
          <p className="text-[11px] text-slate-400">
            Positions the ocean slice at its true depth below the sea surface on the 3D globe.
          </p>

          {settings.render3DDepth && (
            <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Vertical Depth Exaggeration:</span>
                <span className="font-mono text-cyan-300">
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
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
              />
            </div>
          )}
        </div>

        {/* 4. TIME ANIMATION CONTROLS */}
        <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-slate-200">
              Time Progression
            </label>
            <span className="font-mono text-[10px] text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
              Step {settings.timeIndex + 1} / {times.length || 7}
            </span>
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            {formatOceanTime(currentTimeStr)}
          </div>

          <input
            id="time-slider"
            type="range"
            min={0}
            max={Math.max(0, times.length - 1)}
            step={1}
            value={settings.timeIndex}
            onChange={(e) => onUpdateSettings({ timeIndex: Number(e.target.value) })}
            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
          />

          {/* Play / Pause & Speed controls */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              id="toggle-play-animation-btn"
              onClick={onTogglePlay}
              className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 font-medium transition-colors ${
                isPlaying
                  ? 'bg-amber-600 hover:bg-amber-500 text-slate-950'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pause' : 'Play Timeline'}</span>
            </button>

            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              {[0.5, 1, 2].map((sp) => (
                <button
                  key={sp}
                  onClick={() => onChangeAnimSpeed(sp)}
                  className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
                    animSpeed === sp
                      ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {sp}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 5. COLOR PALETTE SELECTOR */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <label className="font-semibold text-slate-200">
            Scientific Color Palette
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            {(Object.keys(COLOR_PALETTES) as ColorPaletteId[]).map((palId) => (
              <button
                key={palId}
                onClick={() => onUpdateSettings({ palette: palId })}
                className={`p-2 rounded-lg border text-left flex items-center justify-between transition-colors ${
                  settings.palette === palId
                    ? 'bg-cyan-950/60 border-cyan-600 text-cyan-200'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                <span className="text-[11px] font-medium">
                  {COLOR_PALETTES[palId].name}
                </span>
                <span className="w-12 h-2.5 rounded-sm border border-slate-700/60 overflow-hidden"
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

        {/* 6. LAYER OPACITY & VISUAL TWEAKS */}
        <div className="space-y-3 pt-2 border-t border-slate-800/80">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Layer Opacity:</span>
              <span className="font-mono text-cyan-300">
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
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
            />
          </div>

          {/* Current Vectors Option (Only active if currents selected) */}
          {settings.variable === 'currents' && (
            <div className="flex items-center justify-between bg-slate-900/70 p-2 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2">
                <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] text-slate-200">
                  Current Direction Arrows (uo/vo)
                </span>
              </div>
              <input
                id="show-vectors-toggle"
                type="checkbox"
                checked={settings.showVectors}
                onChange={(e) => onUpdateSettings({ showVectors: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>
          )}

          {/* Basemap Selection */}
          <div className="space-y-1.5">
            <span className="text-slate-300">Base Globe Map:</span>
            <div className="grid grid-cols-3 gap-1">
              {(['satellite', 'ocean_dark', 'osm'] as BasemapMode[]).map((bm) => (
                <button
                  key={bm}
                  onClick={() => onUpdateSettings({ basemap: bm })}
                  className={`py-1.5 px-2 rounded text-[10px] font-medium border text-center transition-colors capitalize ${
                    settings.basemap === bm
                      ? 'bg-cyan-950 border-cyan-600 text-cyan-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
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
