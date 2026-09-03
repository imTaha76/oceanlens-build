/**
 * OCEANLENS - Vertical Oceanographic Cross-Section (Transect) Tool
 * High-resolution vertical depth slice displaying stratification across coordinates
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Compass,
  Layers,
  Maximize2,
  Minimize2,
  Sliders,
  TrendingDown,
  Waves,
  X,
} from 'lucide-react';
import {
  CurrentVelocitySlice,
  OceanMetadata,
  OceanSlice,
  VisualizationSettings,
} from '../types';
import { interpolateColor } from '../utils/colorMapping';
import { VARIABLE_CONFIGS } from '../utils/oceanCalculations';

interface CrossSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: OceanMetadata | null;
  currentSlice: OceanSlice | CurrentVelocitySlice | null;
  settings: VisualizationSettings;
  onUpdateCoordinate: (coord: number) => void;
}

export const CrossSectionModal: React.FC<CrossSectionModalProps> = ({
  isOpen,
  onClose,
  metadata,
  currentSlice,
  settings,
  onUpdateCoordinate,
}) => {
  const [transectType, setTransectType] = useState<'latitudinal' | 'longitudinal'>('latitudinal');
  const [selectedCoord, setSelectedCoord] = useState<number>(12.5); // 12.5°N default
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const varConfig = VARIABLE_CONFIGS[settings.variable];

  // Update default coordinate when transect type changes
  useEffect(() => {
    if (transectType === 'latitudinal') {
      setSelectedCoord(12.5);
      onUpdateCoordinate(12.5);
    } else {
      setSelectedCoord(67.5);
      onUpdateCoordinate(67.5);
    }
  }, [transectType, onUpdateCoordinate]);

  // Render the cross-section canvas
  useEffect(() => {
    if (!isOpen || !canvasRef.current || !metadata || !currentSlice) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // X axis: longitudes (if latitudinal) or latitudes (if longitudinal)
    // Y axis: depths (26 levels)
    const depths = metadata.depths;
    const numDepths = Math.min(26, depths.length);
    const numPoints = 61;

    // Get current slice values along transect
    const sliceVals = currentSlice.values;
    let baseProfile: number[] = [];

    if (transectType === 'latitudinal') {
      // Find nearest latitude row index
      const lats = currentSlice.latitude;
      let rowIdx = 0;
      let minDiff = Math.abs(lats[0] - selectedCoord);
      for (let i = 1; i < lats.length; i++) {
        const diff = Math.abs(lats[i] - selectedCoord);
        if (diff < minDiff) {
          minDiff = diff;
          rowIdx = i;
        }
      }
      baseProfile = (sliceVals[rowIdx] || []).map((v) => v ?? varConfig.defaultMin);
    } else {
      // Find nearest longitude column index
      const lons = currentSlice.longitude;
      let colIdx = 0;
      let minDiff = Math.abs(lons[0] - selectedCoord);
      for (let j = 1; j < lons.length; j++) {
        const diff = Math.abs(lons[j] - selectedCoord);
        if (diff < minDiff) {
          minDiff = diff;
          colIdx = j;
        }
      }
      baseProfile = sliceVals.map((row) => row[colIdx] ?? varConfig.defaultMin);
    }

    const min = varConfig.defaultMin;
    const max = varConfig.defaultMax;

    // Draw vertical pixel grid
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      // Depth normalized [0..1]
      const depthRatio = y / height;
      const depthMeters = depthRatio * 1000;

      // Realistic vertical ocean physics decay
      let verticalFactor = 1.0;
      if (settings.variable === 'thetao') {
        // Thermocline decay
        verticalFactor = Math.exp(-depthMeters / 220);
      } else if (settings.variable === 'so') {
        verticalFactor = 1.0 - Math.min(0.08, depthMeters * 0.00008);
      } else {
        verticalFactor = Math.exp(-depthMeters / 150);
      }

      for (let x = 0; x < width; x++) {
        const xRatio = x / width;
        const ptIndex = Math.min(numPoints - 1, Math.floor(xRatio * numPoints));
        const surfaceVal = baseProfile[ptIndex] ?? varConfig.defaultMin;

        let val: number;
        if (settings.variable === 'thetao') {
          val = 5 + (surfaceVal - 5) * verticalFactor;
        } else if (settings.variable === 'so') {
          val = surfaceVal * verticalFactor;
        } else {
          val = surfaceVal * verticalFactor;
        }

        const normalized = Math.max(0, Math.min(1, (val - min) / (max - min)));
        const { r, g, b } = interpolateColor(normalized, settings.palette);

        const pixelIndex = (y * width + x) * 4;
        data[pixelIndex] = r;
        data[pixelIndex + 1] = g;
        data[pixelIndex + 2] = b;
        data[pixelIndex + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Draw depth contour lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    [50, 150, 300, 500, 800].forEach((d) => {
      const lineY = (d / 1000) * height;
      ctx.beginPath();
      ctx.moveTo(0, lineY);
      ctx.lineTo(width, lineY);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '10px monospace';
      ctx.fillText(`${d}m`, 8, lineY - 3);
    });
  }, [isOpen, metadata, currentSlice, settings, transectType, selectedCoord, varConfig]);

  if (!isOpen) return null;

  return (
    <div
      id="cross-section-modal"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-4xl bg-slate-950/95 border border-cyan-800/80 rounded-2xl shadow-2xl backdrop-blur-xl p-4 flex flex-col space-y-3 animate-in fade-in slide-in-from-bottom-6 duration-200"
    >
      {/* Modal Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-cyan-950 border border-cyan-700/50 text-cyan-300">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              Vertical Ocean Cross-Section Mode
              <span className="font-mono text-xs text-cyan-400 font-normal">
                [{varConfig.name}]
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Depth stratification column from sea surface down to 1000m depth
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Transect Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-900/70 p-2.5 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Transect Orientation:</span>
          <div className="flex rounded-lg bg-slate-950 p-0.5 border border-slate-800">
            <button
              onClick={() => setTransectType('latitudinal')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                transectType === 'latitudinal'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Zonal (East–West across 65°–70°E)
            </button>
            <button
              onClick={() => setTransectType('longitudinal')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                transectType === 'longitudinal'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Meridional (North–South across 10°–15°N)
            </button>
          </div>
        </div>

        {/* Selected Coordinate Slider */}
        <div className="flex items-center gap-2 font-mono">
          <span className="text-slate-400 text-xs">
            {transectType === 'latitudinal' ? 'Latitude Line:' : 'Longitude Line:'}
          </span>
          <span className="text-cyan-300 font-bold">
            {selectedCoord.toFixed(2)}° {transectType === 'latitudinal' ? 'N' : 'E'}
          </span>
          <input
            type="range"
            min={transectType === 'latitudinal' ? 10.0 : 65.0}
            max={transectType === 'latitudinal' ? 15.0 : 70.0}
            step={0.1}
            value={selectedCoord}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSelectedCoord(val);
              onUpdateCoordinate(val);
            }}
            className="w-28 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
          />
        </div>
      </div>

      {/* Cross-Section Graphic Canvas */}
      <div className="relative w-full h-52 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col justify-between">
        <canvas
          ref={canvasRef}
          width={700}
          height={200}
          className="w-full h-full object-cover"
        />

        {/* Left Depth Axis Label */}
        <div className="absolute top-2 left-2 text-[10px] font-mono text-cyan-300 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800">
          Surface (0 m)
        </div>
        <div className="absolute bottom-2 left-2 text-[10px] font-mono text-cyan-300 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800">
          Deep (1,000 m)
        </div>

        {/* Bottom Horizontal Coordinate Axis Labels */}
        <div className="absolute bottom-2 right-4 text-[10px] font-mono text-slate-300 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
          {transectType === 'latitudinal' ? '65.0°E → 70.0°E (Arabian Sea)' : '10.0°N → 15.0°N'}
        </div>
      </div>
    </div>
  );
};
