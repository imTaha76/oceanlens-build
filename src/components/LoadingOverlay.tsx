/**
 * OCEANLENS - Loading & Error State Overlay
 */

import React from 'react';
import {
  AlertCircle,
  Database,
  Radio,
  RefreshCw,
  Settings,
  Waves,
} from 'lucide-react';
import { OceanVariable } from '../types';
import { VARIABLE_CONFIGS } from '../utils/oceanCalculations';

interface LoadingOverlayProps {
  isLoading: boolean;
  isBackendUnavailable: boolean;
  errorMessage: string | null;
  variable: OceanVariable;
  depth: number;
  timeStr: string;
  onRetry: () => void;
  onOpenConfig: () => void;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  isBackendUnavailable,
  errorMessage,
  variable,
  depth,
  timeStr,
  onRetry,
  onOpenConfig,
}) => {
  // If backend is unavailable, show mandatory high-prominence error message
  if (isBackendUnavailable) {
    return (
      <div
        id="backend-unavailable-overlay"
        className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-6 pointer-events-auto"
      >
        <div className="max-w-lg w-full bg-slate-900 border border-rose-900/60 rounded-xl p-6 shadow-2xl space-y-4 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-rose-950/80 border border-rose-700/60 flex items-center justify-center text-rose-400 animate-pulse">
            <AlertCircle className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-slate-100 tracking-tight">
              OceanLens backend unavailable — unable to load real ocean data.
            </h2>
            <p className="text-xs text-rose-300/80 font-mono">
              {errorMessage || 'Cannot connect to FastAPI service at http://127.0.0.1:8000'}
            </p>
          </div>

          <div className="text-xs text-slate-400 bg-slate-950 p-4 rounded-lg text-left space-y-2 border border-slate-800">
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-cyan-400" />
              Copernicus Ocean Model Backend Requirement:
            </div>
            <p>
              OCEANLENS visualizes real Copernicus ocean model data and strictly prohibits synthetic, fake, or mock values. Please ensure your FastAPI backend is running:
            </p>
            <div className="bg-slate-900 p-2 rounded font-mono text-[11px] text-emerald-400 select-all border border-slate-800">
              uvicorn main:app --reload --port 8000
            </div>
            <p className="text-[11px] text-slate-500">
              Verify endpoint availability at <code className="text-slate-300">GET /metadata</code> and <code className="text-slate-300">GET /slice</code> with CORS enabled.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              id="retry-fetch-btn"
              onClick={onRetry}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-lg shadow-cyan-900/30 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Connection
            </button>
            <button
              id="open-config-btn"
              onClick={onOpenConfig}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors border border-slate-700"
            >
              <Settings className="w-4 h-4" />
              Configure API URL
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If loading a slice, show floating scientific loader in top-right or center
  if (isLoading) {
    const config = VARIABLE_CONFIGS[variable];
    return (
      <div
        id="slice-loading-indicator"
        className="absolute top-20 right-6 z-30 pointer-events-none"
      >
        <div className="bg-slate-900/90 border border-cyan-800/80 rounded-xl px-4 py-3 shadow-2xl backdrop-blur-md flex items-center gap-3 text-xs">
          <div className="relative flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
            <Waves className="w-3 h-3 text-cyan-400 absolute" />
          </div>
          <div>
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <span>Streaming Copernicus Slice</span>
              <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
            </div>
            <div className="text-[11px] font-mono text-cyan-300">
              {config?.code} | z={depth}m | {timeStr ? timeStr.slice(0, 10) : 'T0'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
