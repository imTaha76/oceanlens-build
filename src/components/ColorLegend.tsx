/**
 * OCEANLENS - Scientific Color Legend Component
 */

import React from 'react';
import { ColorPaletteId, SliceStatistics, VariableConfig } from '../types';
import { getCssGradient } from '../utils/colorMapping';

interface ColorLegendProps {
  palette: ColorPaletteId;
  variableConfig: VariableConfig;
  statistics: SliceStatistics | null;
  customMin: number | null;
  customMax: number | null;
}

export const ColorLegend: React.FC<ColorLegendProps> = ({
  palette,
  variableConfig,
  statistics,
  customMin,
  customMax,
}) => {
  const minVal = customMin ?? statistics?.min ?? variableConfig.defaultMin;
  const maxVal = customMax ?? statistics?.max ?? variableConfig.defaultMax;
  const meanVal = statistics?.mean ?? (minVal + maxVal) / 2;

  const gradientCss = getCssGradient(palette, 'to right');

  return (
    <div
      id="ocean-color-legend"
      className="bg-slate-900/90 border border-slate-700/70 rounded-lg p-3 backdrop-blur-md shadow-lg"
    >
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-semibold text-slate-300 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          {variableConfig.name}
        </span>
        <span className="font-mono font-medium text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
          [{variableConfig.unit}]
        </span>
      </div>

      {/* Gradient Bar */}
      <div
        className="w-full h-3.5 rounded-sm border border-slate-700/80 shadow-inner relative"
        style={{ background: gradientCss }}
      >
        {/* Mean Marker */}
        {statistics && maxVal > minVal && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)]"
            style={{
              left: `${Math.max(0, Math.min(100, ((meanVal - minVal) / (maxVal - minVal)) * 100))}%`,
            }}
            title={`Mean: ${meanVal} ${variableConfig.unit}`}
          />
        )}
      </div>

      {/* Axis Ticks & Labels */}
      <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 mt-1">
        <span>{minVal.toFixed(2)}</span>
        <span className="text-slate-500 text-[10px]">
          μ {meanVal.toFixed(2)}
        </span>
        <span>{maxVal.toFixed(2)}</span>
      </div>
    </div>
  );
};
