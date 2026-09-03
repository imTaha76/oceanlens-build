/**
 * OCEANLENS - Bottom Interactive Timeline
 * Scrubbing bar, playback controls, real timestamp steps from Copernicus metadata
 */

import React from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  FastForward,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { OceanMetadata } from '../types';
import { formatOceanTime } from '../utils/oceanCalculations';

interface TimelineProps {
  metadata: OceanMetadata | null;
  timeIndex: number;
  onSetTimeIndex: (idx: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  animSpeed: number;
  onChangeSpeed: (speed: number) => void;
  onNext: () => void;
  onPrev: () => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  metadata,
  timeIndex,
  onSetTimeIndex,
  isPlaying,
  onTogglePlay,
  animSpeed,
  onChangeSpeed,
  onNext,
  onPrev,
}) => {
  const times = metadata?.times || [];
  const currentTime = times[timeIndex] || '';

  return (
    <div
      id="oceanlens-timeline-bar"
      className="h-16 bg-slate-950/85 border-t border-slate-800/90 backdrop-blur-md px-4 flex items-center justify-between z-20 shrink-0 select-none"
    >
      {/* Playback Controls */}
      <div className="flex items-center gap-2">
        <button
          id="timeline-prev-btn"
          onClick={onPrev}
          className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
          title="Previous Time Step"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          id="timeline-play-btn"
          onClick={onTogglePlay}
          className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold shadow-md transition-all ${
            isPlaying
              ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-amber-950/50'
              : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950/50'
          }`}
          title={isPlaying ? 'Pause' : 'Play Animation'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{isPlaying ? 'Pause' : 'Play'}</span>
        </button>

        <button
          id="timeline-next-btn"
          onClick={onNext}
          className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
          title="Next Time Step"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Speed Selector */}
        <div className="hidden sm:flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 ml-1">
          {[0.5, 1, 2].map((spd) => (
            <button
              key={spd}
              onClick={() => onChangeSpeed(spd)}
              className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
                animSpeed === spd
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Scrub Bar & Steps */}
      <div className="flex-1 max-w-2xl mx-4 flex flex-col justify-center space-y-1">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span>Time Index: {timeIndex + 1} / {times.length || 7}</span>
          </span>
          <span className="text-cyan-300 font-medium">
            {formatOceanTime(currentTime)}
          </span>
        </div>

        {/* Interactive Scrub Range */}
        <div className="relative flex items-center">
          <input
            id="timeline-scrubber"
            type="range"
            min={0}
            max={Math.max(0, times.length - 1)}
            step={1}
            value={timeIndex}
            onChange={(e) => onSetTimeIndex(Number(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none"
          />
        </div>

        {/* Step dots */}
        {times.length > 0 && (
          <div className="flex justify-between px-1">
            {times.map((_, idx) => (
              <button
                key={idx}
                onClick={() => onSetTimeIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === timeIndex
                    ? 'bg-cyan-400 ring-2 ring-cyan-400/50 scale-125'
                    : 'bg-slate-700 hover:bg-slate-500'
                }`}
                title={`Step ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Timestamp Tag */}
      <div className="hidden md:flex items-center gap-2 font-mono text-xs text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
        <Calendar className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-slate-200">
          {currentTime ? currentTime.slice(0, 10) : '2024-01-01'}
        </span>
      </div>
    </div>
  );
};
