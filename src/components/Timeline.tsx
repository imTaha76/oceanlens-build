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
      className="h-13 bg-slate-900 border-t border-slate-800 px-4 flex items-center justify-between z-20 shrink-0 select-none text-slate-300"
    >
      {/* Playback Controls */}
      <div className="flex items-center gap-1.5">
        <button
          id="timeline-prev-btn"
          onClick={onPrev}
          className="p-1.5 rounded-md bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          title="Previous Time Step"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          id="timeline-play-btn"
          onClick={onTogglePlay}
          className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium transition-colors border ${
            isPlaying
              ? 'bg-amber-950/60 border-amber-600 text-amber-200'
              : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-white'
          }`}
          title={isPlaying ? 'Pause' : 'Play Timeline'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{isPlaying ? 'Pause' : 'Play'}</span>
        </button>

        <button
          id="timeline-next-btn"
          onClick={onNext}
          className="p-1.5 rounded-md bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          title="Next Time Step"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Speed Selector */}
        <div className="hidden sm:flex items-center bg-slate-850 border border-slate-800 rounded-md p-0.5 ml-1">
          {[0.5, 1, 2].map((spd) => (
            <button
              key={spd}
              onClick={() => onChangeSpeed(spd)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                animSpeed === spd
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Scrub Bar & Steps */}
      <div className="flex-1 max-w-xl mx-4 flex items-center gap-3">
        <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
          Step {timeIndex + 1}/{times.length || 7}
        </span>

        {/* Interactive Scrub Range */}
        <div className="flex-1 relative flex items-center">
          <input
            id="timeline-scrubber"
            type="range"
            min={0}
            max={Math.max(0, times.length - 1)}
            step={1}
            value={timeIndex}
            onChange={(e) => onSetTimeIndex(Number(e.target.value))}
            className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded appearance-none"
          />
        </div>

        <span className="text-xs font-mono text-slate-200 whitespace-nowrap">
          {formatOceanTime(currentTime)}
        </span>
      </div>

      {/* Timestamp Tag */}
      <div className="hidden md:flex items-center gap-2 font-mono text-xs text-slate-400 bg-slate-850 px-2.5 py-1 rounded-md border border-slate-800">
        <Calendar className="w-3.5 h-3.5 text-sky-400" />
        <span className="text-slate-300">
          {currentTime ? currentTime.slice(0, 10) : '2024-01-01'}
        </span>
      </div>
    </div>
  );
};
