/**
 * OCEANLENS - Top Navigation & Platform Header
 */

import React from 'react';
import {
  Compass,
  Grid,
  Layers,
  PanelLeft,
  PanelRight,
  Server,
  Waves,
} from 'lucide-react';
import { DataSourceMode } from '../hooks/useOceanData';
import { OceanMetadata } from '../types';

interface HeaderProps {
  metadata: OceanMetadata | null;
  isConnected: boolean;
  isConnecting: boolean;
  pingMs: number | null;
  apiUrl: string;
  dataSourceMode: DataSourceMode;
  onOpenBackendConfig: () => void;
  onResetCamera: () => void;
  leftPanelOpen: boolean;
  setLeftPanelOpen: (open: boolean) => void;
  rightPanelOpen: boolean;
  setRightPanelOpen: (open: boolean) => void;
  crossSectionMode: boolean;
  setCrossSectionMode: (mode: boolean) => void;
  showGridLines?: boolean;
  onToggleGridLines?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  metadata,
  isConnected,
  isConnecting,
  pingMs,
  apiUrl,
  dataSourceMode,
  onOpenBackendConfig,
  onResetCamera,
  leftPanelOpen,
  setLeftPanelOpen,
  rightPanelOpen,
  setRightPanelOpen,
  crossSectionMode,
  setCrossSectionMode,
  showGridLines = true,
  onToggleGridLines,
}) => {
  return (
    <header
      id="oceanlens-header"
      className="h-13 border-b border-slate-800 bg-slate-900/95 px-4 flex items-center justify-between z-20 shrink-0 select-none text-slate-200"
    >
      {/* Brand Identity & Title */}
      <div className="flex items-center gap-3">
        <button
          id="toggle-left-panel-btn"
          onClick={() => setLeftPanelOpen(!leftPanelOpen)}
          className={`p-1.5 rounded-md border transition-colors ${
            leftPanelOpen
              ? 'bg-slate-800 border-slate-600 text-slate-100'
              : 'bg-slate-850 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Toggle Controls Sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400">
            <Waves className="w-4 h-4" />
          </div>

          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-white">
                OceanLens
              </span>
              <span className="text-[11px] text-slate-400 font-normal hidden sm:inline">
                Arabian Sea Physical Oceanography
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dataset Summary Meta (Subtle & clean) */}
      <div className="hidden lg:flex items-center gap-3 text-xs text-slate-400 font-mono">
        <span className="text-slate-300">10°–15°N, 65°–70°E</span>
        <span className="text-slate-600">•</span>
        <span>61×61 Grid (1/12°)</span>
        <span className="text-slate-600">•</span>
        <span>{metadata ? `${metadata.depths.length} Depths` : '26 Depths'}</span>
      </div>

      {/* Header Action Controls */}
      <div className="flex items-center gap-2">
        {/* Recenter Camera */}
        <button
          id="recenter-camera-btn"
          onClick={onResetCamera}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-750 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs transition-colors"
          title="Recenter 3D Globe to Arabian Sea"
        >
          <Compass className="w-3.5 h-3.5 text-sky-400" />
          <span>Center Region</span>
        </button>

        {/* Transect Mode Toggle */}
        <button
          id="toggle-cross-section-btn"
          onClick={() => setCrossSectionMode(!crossSectionMode)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors border ${
            crossSectionMode
              ? 'bg-amber-950/60 border-amber-600 text-amber-200'
              : 'border-slate-750 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white'
          }`}
          title="Toggle Vertical Ocean Transect"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Transect</span>
        </button>

        {/* Grid Lines Toggle */}
        {onToggleGridLines && (
          <button
            id="toggle-grid-lines-btn"
            onClick={onToggleGridLines}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors border ${
              showGridLines
                ? 'bg-slate-800 border-slate-600 text-slate-100'
                : 'border-slate-750 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Earth & Model Grid"
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Grid</span>
          </button>
        )}

        {/* Data Engine Connection Status */}
        <button
          id="backend-status-indicator-btn"
          onClick={onOpenBackendConfig}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-slate-750 bg-slate-800 hover:bg-slate-750 text-xs font-mono text-slate-300 transition-colors"
          title="Data source settings"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              dataSourceMode === 'embedded'
                ? 'bg-sky-400'
                : isConnected
                ? 'bg-emerald-400'
                : isConnecting
                ? 'bg-amber-400'
                : 'bg-rose-400'
            }`}
          />
          <span className="text-[11px]">
            {dataSourceMode === 'embedded'
              ? 'Copernicus Reanalysis'
              : isConnected
              ? `Server (${pingMs ?? 0}ms)`
              : isConnecting
              ? 'Connecting...'
              : 'Offline'}
          </span>
        </button>

        {/* Toggle Right Panel */}
        <button
          id="toggle-right-panel-btn"
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          className={`p-1.5 rounded-md border transition-colors ${
            rightPanelOpen
              ? 'bg-slate-800 border-slate-600 text-slate-100'
              : 'bg-slate-850 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Toggle Analysis Panel"
        >
          <PanelRight className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
