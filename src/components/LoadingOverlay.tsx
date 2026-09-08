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
  onSwitchToEmbedded?: () => void;
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
  onSwitchToEmbedded,
}) => {
  // If backend is unavailable, show friendly resolver options
  if (isBackendUnavailable) {
    return (
      <div
        id="backend-unavailable-overlay"
        className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-6 pointer-events-auto"
      >
        <div className="max-w-lg w-full bg-slate-900 border border-slate-750 rounded-lg p-5 shadow-xl space-y-3.5 text-center">
          <div className="w-10 h-10 mx-auto rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <Database className="w-5 h-5" />
          </div>

          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wide">
              Copernicus Ocean Data Service
            </h2>
            <p className="text-xs text-amber-300 font-mono">
              {errorMessage || 'FastAPI backend at 127.0.0.1:8000 is not currently responding.'}
            </p>
          </div>

          <div className="text-xs text-slate-300 bg-slate-850 p-3.5 rounded text-left space-y-2 border border-slate-800">
            <div className="font-medium text-slate-200 flex items-center gap-1.5">
              <Waves className="w-3.5 h-3.5 text-slate-400" />
              Integrated Model:
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Explore the Copernicus physical oceanography model for the Arabian Sea (61×61 grid, 26 depth levels, Potential Temperature, Salinity, and Surface Currents):
            </p>
            {onSwitchToEmbedded && (
              <button
                id="explore-embedded-btn"
                onClick={onSwitchToEmbedded}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-750 text-white rounded text-xs font-medium flex items-center justify-center gap-2 border border-slate-700 transition-colors cursor-pointer"
              >
                <Waves className="w-3.5 h-3.5" />
                Explore Copernicus Arabian Sea Model
              </button>
            )}
            <div className="pt-2 border-t border-slate-800">
              <span className="text-[11px] text-slate-400 block font-medium mb-1">
                Or launch your local FastAPI server in terminal:
              </span>
              <div className="bg-slate-950 p-1.5 rounded font-mono text-[11px] text-emerald-400 select-all border border-slate-800">
                cd backend && uvicorn main:app --reload --port 8000
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              id="retry-fetch-btn"
              onClick={onRetry}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Connection
            </button>
            <button
              id="open-config-btn"
              onClick={onOpenConfig}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If loading a slice, show floating scientific loader
  if (isLoading) {
    const config = VARIABLE_CONFIGS[variable];
    return (
      <div
        id="slice-loading-indicator"
        className="absolute top-16 right-4 z-30 pointer-events-none"
      >
        <div className="bg-slate-900 border border-slate-750 rounded px-3 py-2 shadow-lg flex items-center gap-2.5 text-xs">
          <div className="w-4 h-4 border-2 border-slate-600 border-t-slate-200 rounded-full animate-spin" />
          <div>
            <div className="font-medium text-slate-200 text-[11px]">
              Loading Slice
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              {config?.code} | z={depth}m | {timeStr ? timeStr.slice(0, 10) : 'T0'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
