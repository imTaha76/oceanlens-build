/**
 * OCEANLENS - Hook for Real Oceanographic Data Management
 * Integrates metadata, slice caching, time animation, and current calculations
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  COPERNICUS_ARABIAN_SEA_METADATA,
  generateCopernicusCurrentsSlice,
  generateCopernicusSlice,
} from '../services/copernicusModelEngine';
import {
  checkBackendHealth,
  getApiBaseUrl,
  getLastApiRequestUrl,
  getMetadata,
  getOceanSlice,
  setApiBaseUrl,
} from '../services/oceanApi';
import {
  CurrentVelocitySlice,
  DebugPipelineInfo,
  OceanMetadata,
  OceanSlice,
  OceanVariable,
  SliceStatistics,
} from '../types';
import {
  calculateSliceStatistics,
  combineCurrentSlices,
  VARIABLE_CONFIGS,
} from '../utils/oceanCalculations';

export type DataSourceMode = 'embedded' | 'backend' | 'uploaded';

export interface UseOceanDataReturn {
  // Connection state & mode
  dataSourceMode: DataSourceMode;
  setDataSourceMode: (mode: DataSourceMode) => void;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  apiUrl: string;
  pingMs: number | null;
  changeApiUrl: (url: string) => Promise<void>;
  retryConnection: () => Promise<void>;
  switchToEmbeddedMode: () => void;
  loadUploadedDataset: (meta: OceanMetadata, slice: OceanSlice | CurrentVelocitySlice) => void;

  // Metadata
  metadata: OceanMetadata | null;
  currentDepth: number;
  currentTimeStr: string;

  // Selected state
  variable: OceanVariable;
  setVariable: (v: OceanVariable) => void;
  depthIndex: number;
  setDepthIndex: (idx: number) => void;
  setDepthMeters: (meters: number) => void;
  timeIndex: number;
  setTimeIndex: (idx: number) => void;

  // Active slice & statistics
  currentSlice: OceanSlice | CurrentVelocitySlice | null;
  statistics: SliceStatistics | null;
  isLoadingSlice: boolean;
  sliceError: string | null;

  // Debug Pipeline Info for Requirement 7
  debugInfo: DebugPipelineInfo;
  refreshSlice: () => Promise<void>;

  // Animation controls
  isPlaying: boolean;
  togglePlay: () => void;
  animSpeed: number;
  setAnimSpeed: (speed: number) => void;
  nextTimeStep: () => void;
  prevTimeStep: () => void;
}

export function useOceanData(): UseOceanDataReturn {
  // Default to backend connection to satisfy Requirement: Real FastAPI at http://127.0.0.1:8000
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>('backend');
  const [apiUrl, setApiUrlState] = useState<string>(getApiBaseUrl());
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [pingMs, setPingMs] = useState<number | null>(null);

  const [metadata, setMetadata] = useState<OceanMetadata | null>(COPERNICUS_ARABIAN_SEA_METADATA);
  const [variable, setVariable] = useState<OceanVariable>('thetao');
  const [depthIndex, setDepthIndex] = useState<number>(0);
  const [timeIndex, setTimeIndex] = useState<number>(0);
  const [lastApiUrl, setLastApiUrl] = useState<string>(
    `${getApiBaseUrl()}/slice?variable=thetao&depth=0.5&time_index=0`
  );
  const [lastRefreshTime, setLastRefreshTime] = useState<string>(() =>
    new Date().toLocaleTimeString()
  );
  const [refreshCounter, setRefreshCounter] = useState<number>(0);

  const [currentSlice, setCurrentSlice] = useState<OceanSlice | CurrentVelocitySlice | null>(() =>
    generateCopernicusSlice('thetao', 0.5, 0)
  );
  const [statistics, setStatistics] = useState<SliceStatistics | null>(() =>
    calculateSliceStatistics(generateCopernicusSlice('thetao', 0.5, 0).values)
  );
  const [isLoadingSlice, setIsLoadingSlice] = useState<boolean>(false);
  const [sliceError, setSliceError] = useState<string | null>(null);

  // In-memory cache for fetched slices: key = "mode_var_depth_time"
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
      setDataSourceMode('backend');
    } catch (err: unknown) {
      setIsConnected(false);
      setIsConnecting(false);
      const msg = err instanceof Error ? err.message : String(err);
      setConnectionError(msg);
    }
  }, []);

  // Try to connect to backend on mount
  useEffect(() => {
    connectToBackend();
  }, [connectToBackend]);

  // Switch to Embedded Mode
  const switchToEmbeddedMode = useCallback(() => {
    setDataSourceMode('embedded');
    setMetadata(COPERNICUS_ARABIAN_SEA_METADATA);
    setIsConnected(true);
    setConnectionError(null);
    setPingMs(0);
  }, []);

  // Handle uploaded dataset
  const loadUploadedDataset = useCallback((meta: OceanMetadata, slice: OceanSlice | CurrentVelocitySlice) => {
    setDataSourceMode('uploaded');
    setMetadata(meta);
    setCurrentSlice(slice);
    setStatistics(calculateSliceStatistics(slice.values));
    setIsConnected(true);
  }, []);

  // Handle manual URL update
  const changeApiUrl = useCallback(
    async (newUrl: string) => {
      setApiBaseUrl(newUrl);
      setApiUrlState(newUrl);
      sliceCacheRef.current.clear();
      setDataSourceMode('backend');
      await connectToBackend(newUrl);
    },
    [connectToBackend]
  );

  const retryConnection = useCallback(async () => {
    setDataSourceMode('backend');
    await connectToBackend();
  }, [connectToBackend]);

  const refreshSlice = useCallback(async () => {
    sliceCacheRef.current.clear();
    setRefreshCounter((c) => c + 1);
  }, []);

  // Direct depth selector in meters
  const setDepthMeters = useCallback(
    (targetMeters: number) => {
      if (!metadata || !metadata.depths.length) return;
      let closestIdx = 0;
      let minDiff = Math.abs(metadata.depths[0] - targetMeters);
      for (let i = 1; i < metadata.depths.length; i++) {
        const diff = Math.abs(metadata.depths[i] - targetMeters);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = i;
        }
      }
      setDepthIndex(closestIdx);
    },
    [metadata]
  );

  // Load slice data whenever mode, variable, depthIndex, or timeIndex changes
  useEffect(() => {
    if (!metadata || !metadata.depths.length || !metadata.times.length) {
      return;
    }

    const safeDepthIndex = Math.max(0, Math.min(depthIndex, metadata.depths.length - 1));
    const safeTimeIndex = Math.max(0, Math.min(timeIndex, metadata.times.length - 1));
    const targetDepth = metadata.depths[safeDepthIndex];

    const cacheKey = `${dataSourceMode}_${variable}_${targetDepth}_${safeTimeIndex}`;
    const cached = sliceCacheRef.current.get(cacheKey);

    if (cached) {
      setCurrentSlice(cached);
      setStatistics(calculateSliceStatistics(cached.values));
      setSliceError(null);
      setLastApiUrl(
        `${getApiBaseUrl()}/slice?variable=${variable === 'currents' ? 'uo,vo' : variable}&depth=${targetDepth}&time_index=${safeTimeIndex}`
      );
      setLastRefreshTime(
        new Date().toLocaleTimeString() + '.' + String(new Date().getMilliseconds()).padStart(3, '0')
      );
      return;
    }

    if (dataSourceMode === 'embedded') {
      let resultSlice: OceanSlice | CurrentVelocitySlice;
      if (variable === 'currents') {
        resultSlice = generateCopernicusCurrentsSlice(targetDepth, safeTimeIndex);
      } else {
        resultSlice = generateCopernicusSlice(variable, targetDepth, safeTimeIndex);
      }
      sliceCacheRef.current.set(cacheKey, resultSlice);
      setCurrentSlice(resultSlice);
      setStatistics(calculateSliceStatistics(resultSlice.values));
      setIsLoadingSlice(false);
      setSliceError(null);
      setLastApiUrl(
        `${getApiBaseUrl()}/slice?variable=${variable === 'currents' ? 'uo,vo' : variable}&depth=${targetDepth}&time_index=${safeTimeIndex}`
      );
      setLastRefreshTime(
        new Date().toLocaleTimeString() + '.' + String(new Date().getMilliseconds()).padStart(3, '0')
      );
      return;
    }

    if (dataSourceMode === 'backend') {
      let isMounted = true;
      setIsLoadingSlice(true);
      setSliceError(null);

      const targetUrl = `${getApiBaseUrl()}/slice?variable=${
        variable === 'currents' ? 'uo,vo' : variable
      }&depth=${targetDepth}&time_index=${safeTimeIndex}`;
      setLastApiUrl(targetUrl);

      const fetchSlice = async () => {
        try {
          let resultSlice: OceanSlice | CurrentVelocitySlice;

          if (variable === 'currents') {
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
            setIsConnected(true);
            setConnectionError(null);
            setLastApiUrl(getLastApiRequestUrl());
            setLastRefreshTime(
              new Date().toLocaleTimeString() + '.' + String(new Date().getMilliseconds()).padStart(3, '0')
            );
          }
        } catch (err: unknown) {
          if (isMounted) {
            setIsLoadingSlice(false);
            const msg = err instanceof Error ? err.message : String(err);
            setSliceError(msg);
            setIsConnected(false);
            setConnectionError(msg);

            // Fallback to high-precision synthetic Copernicus model so UI and 3D globe stay functional
            let fallbackSlice: OceanSlice | CurrentVelocitySlice;
            if (variable === 'currents') {
              fallbackSlice = generateCopernicusCurrentsSlice(targetDepth, safeTimeIndex);
            } else {
              fallbackSlice = generateCopernicusSlice(variable, targetDepth, safeTimeIndex);
            }
            setCurrentSlice(fallbackSlice);
            setStatistics(calculateSliceStatistics(fallbackSlice.values));
            setLastRefreshTime(
              new Date().toLocaleTimeString() + '.' + String(new Date().getMilliseconds()).padStart(3, '0')
            );
          }
        }
      };

      fetchSlice();

      return () => {
        isMounted = false;
      };
    }
  }, [dataSourceMode, metadata, variable, depthIndex, timeIndex, refreshCounter]);

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

  const activeVarConfig = VARIABLE_CONFIGS[variable];

  const debugInfo: DebugPipelineInfo = {
    currentVariable: variable,
    currentDepth,
    currentTimeIndex: timeIndex,
    currentTimeStr,
    apiRequestUrl: lastApiUrl,
    minValue: statistics?.min ?? null,
    maxValue: statistics?.max ?? null,
    meanValue: statistics?.mean ?? null,
    unit: activeVarConfig.unit,
    lastRefreshTime,
    dataSourceMode,
    isConnected,
    isConnecting,
    connectionError,
    latencyMs: pingMs,
  };

  return {
    dataSourceMode,
    setDataSourceMode,
    switchToEmbeddedMode,
    loadUploadedDataset,
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
    setDepthMeters,
    timeIndex,
    setTimeIndex,
    currentSlice,
    statistics,
    isLoadingSlice,
    sliceError,
    debugInfo,
    refreshSlice,
    isPlaying,
    togglePlay,
    animSpeed,
    setAnimSpeed,
    nextTimeStep,
    prevTimeStep,
  };
}
