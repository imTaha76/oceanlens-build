/**
 * OCEANLENS - 3D Ocean Intelligence Platform
 * Smart India Hackathon (SIH) 2026
 *
 * Web-based interactive 3D Ocean Data Visualization System
 * Visualizing real Copernicus ocean model data in the Arabian Sea
 */

import React, { useState } from 'react';
import { VolumeViewer } from './components/VolumeViewer';
import { BackendConfigModal } from './components/BackendConfigModal';
import { ControlPanel } from './components/ControlPanel';
import { CrossSectionModal } from './components/CrossSectionModal';
import { Header } from './components/Header';
import { InformationPanel } from './components/InformationPanel';
import { LoadingOverlay } from './components/LoadingOverlay';
import { OceanGlobe } from './components/OceanGlobe';
import { Timeline } from './components/Timeline';
import { useOceanData } from './hooks/useOceanData';
import { ProbePoint, VisualizationSettings } from './types';

export default function App() {
  const ocean = useOceanData();

  const [settings, setSettings] = useState<VisualizationSettings>({
    variable: 'thetao',
    depthIndex: 0,
    timeIndex: 0,
    palette: 'thermal',
    opacity: 0.85,
    verticalExaggeration: 15,
    customMin: null,
    customMax: null,
    showVectors: true,
    showGridLines: true,
    showCoastlines: true,
    basemap: 'satellite',
    render3DDepth: true,
    interpolation: 'bilinear',
    crossSectionMode: false,
    crossSectionType: 'latitudinal',
    crossSectionCoordinate: 12.5,
  });

  const [leftPanelOpen, setLeftPanelOpen] = useState<boolean>(true);
  const [rightPanelOpen, setRightPanelOpen] = useState<boolean>(true);
  const [backendConfigOpen, setBackendConfigOpen] = useState<boolean>(false);
  const [probePoint, setProbePoint] = useState<ProbePoint | null>(null);
  const [resetCameraCount, setResetCameraCount] = useState<number>(0);
  const [volumeViewerOpen, setVolumeViewerOpen] = useState<boolean>(false);

  const handleUpdateSettings = (
    partial: Partial<VisualizationSettings>
  ) => {
    setSettings((prev) => {
      const updated = { ...prev, ...partial };

      if (
        partial.variable !== undefined &&
        partial.variable !== prev.variable
      ) {
        ocean.setVariable(partial.variable);
      }

      if (
        partial.depthIndex !== undefined &&
        partial.depthIndex !== prev.depthIndex
      ) {
        ocean.setDepthIndex(partial.depthIndex);
      }

      if (
        partial.timeIndex !== undefined &&
        partial.timeIndex !== prev.timeIndex
      ) {
        ocean.setTimeIndex(partial.timeIndex);
      }

      return updated;
    });
  };

  const handleTimelineChange = (idx: number) => {
    handleUpdateSettings({ timeIndex: idx });
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* 1. TOP NAVIGATION HEADER */}
      <Header
        metadata={ocean.metadata}
        isConnected={ocean.isConnected}
        isConnecting={ocean.isConnecting}
        pingMs={ocean.pingMs}
        apiUrl={ocean.apiUrl}
        onOpenBackendConfig={() => setBackendConfigOpen(true)}
        onResetCamera={() => setResetCameraCount((c) => c + 1)}
        leftPanelOpen={leftPanelOpen}
        setLeftPanelOpen={setLeftPanelOpen}
        rightPanelOpen={rightPanelOpen}
        setRightPanelOpen={setRightPanelOpen}
        crossSectionMode={settings.crossSectionMode}
        setCrossSectionMode={(val) =>
          handleUpdateSettings({ crossSectionMode: val })
        }
      />

      {/* 2. MAIN 3D WORKSPACE LAYOUT */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* Left Observation Control Panel */}
        <ControlPanel
          metadata={ocean.metadata}
          settings={{
            ...settings,
            depthIndex: ocean.depthIndex,
            timeIndex: ocean.timeIndex,
            variable: ocean.variable,
          }}
          onUpdateSettings={handleUpdateSettings}
          isPlaying={ocean.isPlaying}
          onTogglePlay={ocean.togglePlay}
          animSpeed={ocean.animSpeed}
          onChangeAnimSpeed={ocean.setAnimSpeed}
          isOpen={leftPanelOpen}
          onClose={() => setLeftPanelOpen(false)}
        />

        {/* Center workspace: Globe OR 3D Subsurface */}
        <main className="relative flex-1 flex flex-col h-full overflow-hidden">
          {volumeViewerOpen ? (
            <>
              <VolumeViewer
                volume={ocean.currentVolume}
                variable={ocean.variable}
                opacity={settings.opacity}
                verticalExaggeration={settings.verticalExaggeration}
                isLoading={ocean.isLoadingVolume}
                error={ocean.volumeError}
                probePoint={probePoint}
                timeIndex={ocean.timeIndex}
              />

              {/* Return to globe */}
              <button
                onClick={() => setVolumeViewerOpen(false)}
                className="absolute top-3 right-3 z-50 px-4 py-2 bg-slate-950/95 border border-slate-600 text-slate-300 text-xs font-mono hover:border-cyan-400 hover:text-cyan-300 transition-colors"
              >
                ← GLOBE
              </button>
            </>
          ) : (
            <>
              <OceanGlobe
                metadata={ocean.metadata}
                slice={ocean.currentSlice}
                settings={{
                  ...settings,
                  depthIndex: ocean.depthIndex,
                  timeIndex: ocean.timeIndex,
                  variable: ocean.variable,
                }}
                probePoint={probePoint}
                onProbeLocation={setProbePoint}
                crossSectionCoordinate={settings.crossSectionCoordinate}
                resetCameraTrigger={resetCameraCount}
                isPlaying={ocean.isPlaying}
              />

              {/* Open 3D subsurface in the SAME center workspace */}
              <button
                onClick={() => setVolumeViewerOpen(true)}
                className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-2 bg-slate-950/90 border border-cyan-400/40 text-cyan-200 text-xs font-mono tracking-wider hover:bg-cyan-950/80 transition-colors"
              >
                3D SUBSURFACE
              </button>
            </>
          )}

          {/* Loading & Connection Error Overlays */}
          {!volumeViewerOpen && (
            <LoadingOverlay
              isLoading={ocean.isLoadingSlice}
              isBackendUnavailable={
                !ocean.isConnected && !ocean.isConnecting
              }
              errorMessage={ocean.connectionError}
              variable={ocean.variable}
              depth={ocean.currentDepth}
              timeStr={ocean.currentTimeStr}
              onRetry={ocean.retryConnection}
              onOpenConfig={() => setBackendConfigOpen(true)}
            />
          )}

          {/* Vertical Ocean Cross-Section Drawer/Modal */}
          {!volumeViewerOpen && (
            <CrossSectionModal
              isOpen={settings.crossSectionMode}
              onClose={() =>
                handleUpdateSettings({ crossSectionMode: false })
              }
              metadata={ocean.metadata}
              currentSlice={ocean.currentSlice}
              settings={settings}
              onUpdateCoordinate={(coord) =>
                handleUpdateSettings({
                  crossSectionCoordinate: coord,
                })
              }
            />
          )}
        </main>

        {/* Right Scientific Information Panel */}
        <InformationPanel
          metadata={ocean.metadata}
          slice={ocean.currentSlice}
          statistics={ocean.statistics}
          settings={{
            ...settings,
            depthIndex: ocean.depthIndex,
            timeIndex: ocean.timeIndex,
            variable: ocean.variable,
          }}
          probePoint={probePoint}
          onClearProbe={() => setProbePoint(null)}
          isOpen={rightPanelOpen}
          onClose={() => setRightPanelOpen(false)}
        />
      </div>

      {/* 3. BOTTOM INTERACTIVE TIMELINE */}
      <Timeline
        metadata={ocean.metadata}
        timeIndex={ocean.timeIndex}
        onSetTimeIndex={handleTimelineChange}
        isPlaying={ocean.isPlaying}
        onTogglePlay={ocean.togglePlay}
        animSpeed={ocean.animSpeed}
        onChangeSpeed={ocean.setAnimSpeed}
        onNext={ocean.nextTimeStep}
        onPrev={ocean.prevTimeStep}
      />

      {/* 4. BACKEND CONFIGURATION MODAL */}
      <BackendConfigModal
        isOpen={backendConfigOpen}
        onClose={() => setBackendConfigOpen(false)}
        apiUrl={ocean.apiUrl}
        isConnected={ocean.isConnected}
        isConnecting={ocean.isConnecting}
        pingMs={ocean.pingMs}
        connectionError={ocean.connectionError}
        onSaveUrl={ocean.changeApiUrl}
        onRetry={ocean.retryConnection}
      />
    </div>
  );
}
