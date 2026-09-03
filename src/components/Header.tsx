/**
 * OCEANLENS - Top Navigation & Platform Header
 */

import React from 'react';
import {
  Activity,
  Compass,
  Database,
  Layers,
  PanelLeft,
  PanelRight,
  Server,
  Sliders,
  Sparkles,
  Waves,
} from 'lucide-react';
import { OceanMetadata } from '../types';

interface HeaderProps {
  metadata: OceanMetadata | null;
  isConnected: boolean;
  isConnecting: boolean;
  pingMs: number | null;
  apiUrl: string;
  onOpenBackendConfig: () => void;
  onResetCamera: () => void;
  leftPanelOpen: boolean;
  setLeftPanelOpen: (open: boolean) => void;
  rightPanelOpen: boolean;
  setRightPanelOpen: (open: boolean) => void;
  crossSectionMode: boolean;
  setCrossSectionMode: (mode: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  metadata,
  isConnected,
  isConnecting,
  pingMs,
  apiUrl,
  onOpenBackendConfig,
  onResetCamera,
  leftPanelOpen,
  setLeftPanelOpen,
  rightPanelOpen,
  setRightPanelOpen,
  crossSectionMode,
  setCrossSectionMode,
}) => {
  return (
    <header
      id="oceanlens-header"
      className="h-16 border-b border-slate-800/90 bg-slate-950/80 backdrop-blur-md px-4 flex items-center justify-between z-20 shrink-0 select-none"
    >
      {/* Brand Identity & Title */}
      <div className="flex items-center gap-3.5">
        <button
          id="toggle-left-panel-btn"
          onClick={() => setLeftPanelOpen(!leftPanelOpen)}
          className={`p-2 rounded-lg border transition-colors ${
            leftPanelOpen
              ? 'bg-cyan-950/80 border-cyan-700/60 text-cyan-300'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Control Panel"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          {/* Logo Mark */}
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-600 via-sky-700 to-indigo-900 shadow-md shadow-cyan-950/50 border border-cyan-400/30">
            <Waves className="w-5 h-5 text-cyan-100" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping opacity-75" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-400" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-wider text-white font-mono flex items-center gap-1.5">
                OCEANLENS
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 tracking-normal">
                  SIH 2026
                </span>
              </h1>
            </div>
            <p className="text-[11px] font-medium text-slate-400">
              3D Ocean Intelligence Platform • Copernicus Marine Model
            </p>
          </div>
        </div>
      </div>

      {/* Dataset Summary Tags (Hidden on small screens) */}
      <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono">
        <div className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-cyan-400" />
          <span>Arabian Sea [10°–15°N, 65°–70°E]</span>
        </div>
        <div className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-400">
          Grid: <span className="text-slate-200">61×61 (1/12°)</span>
        </div>
        <div className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-400">
          Depths: <span className="text-slate-200">{metadata ? `${metadata.depths.length} Levels` : '26 Levels'}</span>
        </div>
      </div>

      {/* Header Actions & Live Connection Indicator */}
      <div className="flex items-center gap-2">
        {/* Reset Camera to Arabian Sea */}
        <button
          id="recenter-camera-btn"
          onClick={onResetCamera}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-colors"
          title="Recenter Camera on Arabian Sea"
        >
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          Focus Region
        </button>

        {/* Vertical Cross-Section Toggle */}
        <button
          id="toggle-cross-section-btn"
          onClick={() => setCrossSectionMode(!crossSectionMode)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
            crossSectionMode
              ? 'bg-amber-950/80 border-amber-600/80 text-amber-300 shadow-sm shadow-amber-950'
              : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
          }`}
          title="Toggle Vertical Cross-Section Transect Mode"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Cross-Section</span>
        </button>

        {/* Live Backend Connection Indicator */}
        <button
          id="backend-status-indicator-btn"
          onClick={onOpenBackendConfig}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
            isConnected
              ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300 hover:bg-emerald-950/80'
              : isConnecting
              ? 'bg-sky-950/60 border-sky-800/80 text-sky-300'
              : 'bg-rose-950/60 border-rose-800/80 text-rose-300 hover:bg-rose-950/80'
          }`}
          title={`Backend: ${apiUrl} (Click to configure)`}
        >
          <span className="relative flex h-2 w-2">
            {isConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isConnected ? 'bg-emerald-500' : isConnecting ? 'bg-sky-500' : 'bg-rose-500'
              }`}
            />
          </span>

          <span className="font-semibold text-[11px]">
            {isConnected
              ? `LIVE ${pingMs !== null ? `(${pingMs}ms)` : ''}`
              : isConnecting
              ? 'CONNECTING...'
              : 'OFFLINE'}
          </span>

          <Server className="w-3.5 h-3.5 opacity-70" />
        </button>

        {/* Toggle Right Panel */}
        <button
          id="toggle-right-panel-btn"
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          className={`p-2 rounded-lg border transition-colors ${
            rightPanelOpen
              ? 'bg-cyan-950/80 border-cyan-700/60 text-cyan-300'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Analysis Inspector"
        >
          <PanelRight className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
