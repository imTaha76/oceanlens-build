/**
 * OCEANLENS - Hook for Real Oceanographic Data Management
 * Integrates metadata, slice caching, time animation, and current calculations
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkBackendHealth,
  getApiBaseUrl,
  getMetadata,
  getOceanSlice,
  setApiBaseUrl,
} from '../services/oceanApi';
import {
  CurrentVelocitySlice,
  OceanMetadata,
  OceanSlice,
  OceanVariable,
  SliceStatistics,
} from '../types';
import {
  calculateSliceStatistics,
  combineCurrentSlices,
} from '../utils/oceanCalculations';

export interface UseOceanDataReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  apiUrl: string;
  pingMs: number | null;
  changeApiUrl: (url: string) => Promise<void>;
  retryConnection: () => Promise<void>;

  // Metadata
  metadata: OceanMetadata | null;
  currentDepth: number;
  currentTimeStr: string;

  // Selected state
  variable: OceanVariable;
  setVariable: (v: OceanVariable) => void;
  depthIndex: number;
  setDepthIndex: (idx: number) => void;
  timeIndex: number;
  setTimeIndex: (idx: number) => void;

  // Active slice & statistics
  currentSlice: OceanSlice | CurrentVelocitySlice | null;
  statistics: SliceStatistics | null;
  isLoadingSlice: boolean;
  sliceError: string | null;

  // Animation controls
  isPlaying: boolean;
  togglePlay: () => void;
  animSpeed: number;
  setAnimSpeed: (speed: number) => void;
  nextTimeStep: () => void;
  prevTimeStep: () => void;
}

export function useOceanData(): UseOceanDataReturn {
  const [apiUrl, setApiUrlState] = useState<string>(getApiBaseUrl());
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [pingMs, setPingMs] = useState<number | null>(null);

  const [metadata, setMetadata] = useState<OceanMetadata | null>(null);
  const [variable, setVariable] = useState<OceanVariable>('thetao');
  const [depthIndex, setDepthIndex] = useState<number>(0);
  const [timeIndex, setTimeIndex] = useState<number>(0);

  const [currentSlice, setCurrentSlice] = useState<OceanSlice | CurrentVelocitySlice | null>(null);
  const [statistics, setStatistics] = useState<SliceStatistics | null>(null);
  const [isLoadingSlice, setIsLoadingSlice] = useState<boolean>(false);
  const [sliceError, setSliceError] = useState<string | null>(null);

  // In-memory cache for fetched slices: key = "var_depth_time"
  const sliceCacheRef = useRef<Map<string, OceanSlice | CurrentVelocitySlice>>(new Map());

  // Animation playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [animSpeed, setAnimSpeed] = useState<number>(1); // 1x = 1.5s per frame
  const animIntervalRef = useRef<number | null>(null);

  // Connect to backend and fetch /metadata
  const connectToBackend = useCallback(async (targetUrl?: string) => {
    setIsConnecting(true);
    setConnectionError(null);
    try {
      const ping = await checkBackendHealth(targetUrl);
      setPingMs(ping.latencyMs);

      const meta = await getMetadata();
      setMetadata(meta);
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionError(null);
    } catch (err: unknown) {
      setIsConnected(false);
      setIsConnecting(false);
      const msg = err instanceof Error ? err.message : String(err);
      setConnectionError(msg);
      setCurrentSlice(null);
      setStatistics(null);
    }
  }, []);

  // Initialize connection
  useEffect(() => {
    connectToBackend();
  }, [connectToBackend]);

  // Handle manual URL update
  const changeApiUrl = useCallback(
    async (newUrl: string) => {
      setApiBaseUrl(newUrl);
      setApiUrlState(newUrl);
      sliceCacheRef.current.clear();
      await connectToBackend(newUrl);
    },
    [connectToBackend]
  );

  const retryConnection = useCallback(async () => {
    await connectToBackend();
  }, [connectToBackend]);

  // Load slice data whenever variable, depthIndex, or timeIndex changes
  useEffect(() => {
    if (!metadata || !metadata.depths.length || !metadata.times.length) {
      return;
    }

    const safeDepthIndex = Math.max(0, Math.min(depthIndex, metadata.depths.length - 1));
    const safeTimeIndex = Math.max(0, Math.min(timeIndex, metadata.times.length - 1));
    const targetDepth = metadata.depths[safeDepthIndex];

    const cacheKey = `${variable}_${targetDepth}_${safeTimeIndex}`;
    const cached = sliceCacheRef.current.get(cacheKey);

    if (cached) {
      setCurrentSlice(cached);
      setStatistics(calculateSliceStatistics(cached.values));
      setSliceError(null);
      return;
    }

    let isMounted = true;
    setIsLoadingSlice(true);
    setSliceError(null);

    const fetchSlice = async () => {
      try {
        let resultSlice: OceanSlice | CurrentVelocitySlice;

        if (variable === 'currents') {
          // Concurrently fetch uo (eastward) and vo (northward)
          const [uoSlice, voSlice] = await Promise.all([
            getOceanSlice('uo', targetDepth, safeTimeIndex),
            getOceanSlice('vo', targetDepth, safeTimeIndex),
          ]);
          resultSlice = combineCurrentSlices(uoSlice, voSlice);
        } else {
          resultSlice = await getOceanSlice(variable, targetDepth, safeTimeIndex);
        }

        if (isMounted) {
          sliceCacheRef.current.set(cacheKey, resultSlice);
          setCurrentSlice(resultSlice);
          setStatistics(calculateSliceStatistics(resultSlice.values));
          setIsLoadingSlice(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setIsLoadingSlice(false);
          const msg = err instanceof Error ? err.message : String(err);
          setSliceError(msg);
          setCurrentSlice(null);
          setStatistics(null);
        }
      }
    };

    fetchSlice();

    return () => {
      isMounted = false;
    };
  }, [metadata, variable, depthIndex, timeIndex]);

  // Animation timer
  useEffect(() => {
    if (!isPlaying || !metadata || metadata.times.length <= 1) {
      if (animIntervalRef.current) {
        clearInterval(animIntervalRef.current);
        animIntervalRef.current = null;
      }
      return;
    }

    const intervalMs = Math.max(400, 1500 / animSpeed);

    animIntervalRef.current = window.setInterval(() => {
      setTimeIndex((prev) => {
        const next = prev + 1;
        return next >= metadata.times.length ? 0 : next;
      });
    }, intervalMs);

    return () => {
      if (animIntervalRef.current) {
        clearInterval(animIntervalRef.current);
        animIntervalRef.current = null;
      }
    };
  }, [isPlaying, animSpeed, metadata]);

  const togglePlay = useCallback(() => {
    setIsPlaying((p) => !p);
  }, []);

  const nextTimeStep = useCallback(() => {
    if (!metadata) return;
    setTimeIndex((prev) => (prev + 1) % metadata.times.length);
  }, [metadata]);

  const prevTimeStep = useCallback(() => {
    if (!metadata) return;
    setTimeIndex((prev) => (prev - 1 + metadata.times.length) % metadata.times.length);
  }, [metadata]);

  const currentDepth = metadata?.depths?.[depthIndex] ?? 0;
  const currentTimeStr = metadata?.times?.[timeIndex] ?? '';

  return {
    isConnected,
    isConnecting,
    connectionError,
    apiUrl,
    pingMs,
    changeApiUrl,
    retryConnection,
    metadata,
    currentDepth,
    currentTimeStr,
    variable,
    setVariable,
    depthIndex,
    setDepthIndex,
    timeIndex,
    setTimeIndex,
    currentSlice,
    statistics,
    isLoadingSlice,
    sliceError,
    isPlaying,
    togglePlay,
    animSpeed,
    setAnimSpeed,
    nextTimeStep,
    prevTimeStep,
  };
}
