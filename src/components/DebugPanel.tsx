/**
 * OCEANLENS - Real-Time Data Pipeline Debug Panel
 * Fulfills Requirement 7:
 * Displays Current Variable, Current Depth, Current Time Index,
 * API Request URL, Minimum, Maximum, Mean, and Last Data Refresh Time.
 */

import React, { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
  Copy,
  Database,
  ExternalLink,
  Layers,
  Play,
  Pause,
  RefreshCw,
  Sliders,
  Terminal,
  Waves,
  Zap,
} from 'lucide-react';
import { DebugPipelineInfo, OceanVariable } from '../types';

interface DebugPanelProps {
  debugInfo: DebugPipelineInfo;
  onSelectVariable: (v: OceanVariable) => void;
  onSelectDepth: (depthMeters: number) => void;
  onSetTimeIndex: (idx: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onRefresh: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  debugInfo,
  onSelectVariable,
  onSelectDepth,
  onSetTimeIndex,
  isPlaying,
  onTogglePlay,
  onRefresh,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = () => {
    if (debugInfo.apiRequestUrl) {
      navigator.clipboard.writeText(debugInfo.apiRequestUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatVal = (v: number | null, unit: string) => {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return `${v.toFixed(3)} ${unit}`;
  };

  return (
    <aside
      id="oceanlens-debug-panel"
      aria-label="Ocean Data Pipeline Inspector"
      className="absolute bottom-16 left-4 z-30 max-w-sm w-full select-none font-mono text-xs transition-all duration-200"
    >
      <div className="rounded-lg border border-slate-700 bg-slate-900 shadow-lg overflow-hidden text-slate-200">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-850 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-[11px] uppercase tracking-wider text-slate-200">
              Pipeline Inspector
            </span>
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
                debugInfo.isConnected
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  debugInfo.isConnected ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              {debugInfo.isConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              id="debug-refresh-btn"
              onClick={onRefresh}
              title="Refresh Slice Request"
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
            <button
              id="debug-minimize-btn"
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title={isMinimized ? 'Expand Inspector' : 'Minimize Inspector'}
            >
              {isMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Collapsed Bar View */}
        {isMinimized ? (
          <div className="px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-400 bg-slate-900">
            <div className="truncate">
              <span className="text-slate-200 font-medium">{debugInfo.currentVariable}</span>
              <span className="mx-1 text-slate-600">|</span>
              <span>{debugInfo.currentDepth}m</span>
              <span className="mx-1 text-slate-600">|</span>
              <span>T:{debugInfo.currentTimeIndex}</span>
            </div>
            <div className="text-[10px] text-slate-300 shrink-0">
              Avg: {debugInfo.meanValue ? debugInfo.meanValue.toFixed(2) : '—'} {debugInfo.unit}
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-2.5 bg-slate-900">
            {/* Primary Key-Value Grid */}
            <div className="grid grid-cols-2 gap-1.5 text-[11px] bg-slate-850 p-2.5 rounded border border-slate-800">
              <div>
                <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Variable</span>
                <span className="font-semibold text-slate-200">
                  {debugInfo.currentVariable}
                  <span className="text-[10px] font-normal text-slate-400 ml-1">({debugInfo.unit})</span>
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Depth</span>
                <span className="font-semibold text-slate-200">
                  {debugInfo.currentDepth.toFixed(1)} m
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Time Index</span>
                <span className="font-semibold text-slate-200">
                  Step {debugInfo.currentTimeIndex} <span className="text-[9px] text-slate-400">({debugInfo.currentTimeStr.split('T')[0]})</span>
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Data Source</span>
                <span className="font-semibold text-slate-200">
                  {debugInfo.dataSourceMode.toUpperCase()}
                </span>
              </div>
            </div>

            {/* API Request URL */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400 flex items-center gap-1 uppercase tracking-wider">
                  <Code2 className="w-3 h-3 text-slate-400" />
                  Request Endpoint
                </span>
                <button
                  id="debug-copy-url-btn"
                  onClick={handleCopyUrl}
                  className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-2.5 h-2.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div
                title={debugInfo.apiRequestUrl}
                className="p-2 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-300 font-mono break-all leading-tight max-h-14 overflow-y-auto custom-scrollbar select-all"
              >
                {debugInfo.apiRequestUrl || 'http://127.0.0.1:8000/slice?variable=thetao&depth=0.5&time_index=0'}
              </div>
            </div>

            {/* Scientific Statistics: Min / Max / Mean */}
            <div className="grid grid-cols-3 gap-1.5 text-center bg-slate-850 p-2 rounded border border-slate-800">
              <div>
                <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Min</span>
                <span className="font-medium text-slate-200 text-[11px]">
                  {formatVal(debugInfo.minValue, debugInfo.unit)}
                </span>
              </div>
              <div className="border-x border-slate-800 px-1">
                <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Max</span>
                <span className="font-medium text-slate-200 text-[11px]">
                  {formatVal(debugInfo.maxValue, debugInfo.unit)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Mean</span>
                <span className="font-medium text-slate-200 text-[11px]">
                  {formatVal(debugInfo.meanValue, debugInfo.unit)}
                </span>
              </div>
            </div>

            {/* Last Refresh Time */}
            <div className="flex items-center justify-between text-[10px] px-2 py-1 rounded bg-slate-850 border border-slate-800 text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-slate-400" />
                Updated:
              </span>
              <span className="font-mono text-slate-300">
                {debugInfo.lastRefreshTime || 'Synchronized'}
              </span>
            </div>

            {/* Quick Test Bar */}
            <div className="pt-2 border-t border-slate-800 space-y-1.5">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 block">
                Quick Parameter Test
              </span>

              {/* Variable buttons */}
              <div className="grid grid-cols-3 gap-1">
                <button
                  id="debug-test-temp"
                  onClick={() => onSelectVariable('thetao')}
                  className={`px-1.5 py-1 rounded text-[10px] transition-colors ${
                    debugInfo.currentVariable === 'thetao'
                      ? 'bg-slate-800 text-white font-medium border border-slate-600'
                      : 'bg-slate-850 border border-slate-800 hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  Temp
                </button>
                <button
                  id="debug-test-salinity"
                  onClick={() => onSelectVariable('so')}
                  className={`px-1.5 py-1 rounded text-[10px] transition-colors ${
                    debugInfo.currentVariable === 'so'
                      ? 'bg-slate-800 text-white font-medium border border-slate-600'
                      : 'bg-slate-850 border border-slate-800 hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  Salinity
                </button>
                <button
                  id="debug-test-currents"
                  onClick={() => onSelectVariable('currents')}
                  className={`px-1.5 py-1 rounded text-[10px] transition-colors ${
                    debugInfo.currentVariable === 'currents'
                      ? 'bg-slate-800 text-white font-medium border border-slate-600'
                      : 'bg-slate-850 border border-slate-800 hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  Currents
                </button>
              </div>

              {/* Depth quick presets */}
              <div className="grid grid-cols-4 gap-1">
                {[0.5, 20, 50, 100].map((d) => (
                  <button
                    key={d}
                    id={`debug-depth-${d}m`}
                    onClick={() => onSelectDepth(d)}
                    className={`py-0.5 rounded text-[10px] transition-colors ${
                      Math.abs(debugInfo.currentDepth - d) < 2
                        ? 'bg-slate-800 text-white font-medium border border-slate-600'
                        : 'bg-slate-850 border border-slate-800 hover:bg-slate-800 text-slate-400'
                    }`}
                  >
                    {d}m
                  </button>
                ))}
              </div>

              {/* Time Stepper & Play */}
              <div className="flex items-center justify-between gap-1 pt-0.5">
                <button
                  id="debug-time-prev"
                  onClick={() => onSetTimeIndex(Math.max(0, debugInfo.currentTimeIndex - 1))}
                  className="flex-1 py-0.5 rounded bg-slate-850 border border-slate-800 hover:bg-slate-800 text-slate-300 text-[10px]"
                >
                  ◀ Day {Math.max(1, debugInfo.currentTimeIndex)}
                </button>
                <button
                  id="debug-toggle-play"
                  onClick={onTogglePlay}
                  className="px-2.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 flex items-center gap-1 transition-colors"
                >
                  {isPlaying ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>
                <button
                  id="debug-time-next"
                  onClick={() => onSetTimeIndex(Math.min(6, debugInfo.currentTimeIndex + 1))}
                  className="flex-1 py-0.5 rounded bg-slate-850 border border-slate-800 hover:bg-slate-800 text-slate-300 text-[10px]"
                >
                  Day {Math.min(7, debugInfo.currentTimeIndex + 2)} ▶
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
