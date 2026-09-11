import React, { useEffect, useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import {
  OceanVariable,
  OceanVolume,
  ProbePoint,
} from '../types';
import './VolumeViewer.css';

interface VolumeViewerProps {
  volume: OceanVolume | null;
  variable: OceanVariable;
  opacity?: number;
  verticalExaggeration?: number;
  isLoading?: boolean;
  error?: string | null;

  // Location selected on the Cesium globe
  probePoint?: ProbePoint | null;

  // Current model time index, used to load both U/V components.
  timeIndex?: number;
}

const VARIABLE_LABELS: Record<OceanVariable, string> = {
  thetao: 'Temperature',
  so: 'Salinity',
  uo: 'Eastward Current',
  vo: 'Northward Current',
  currents: 'Current Speed',
};

interface ArgoObservation {
  latitude: number;
  longitude: number;
  pressure: number;
  temperature: number;
  salinity: number;
  time: string;
  platform: number;
  cycle: number;
}

const VARIABLE_UNITS: Record<OceanVariable, string> = {
  thetao: '°C',
  so: 'PSU',
  uo: 'm/s',
  vo: 'm/s',
  currents: 'm/s',
};

export function VolumeViewer({
  volume,
  variable,
  opacity = 0.5,
  verticalExaggeration = 1,
  isLoading = false,
  error = null,
  probePoint = null,
  timeIndex = 0,
}: VolumeViewerProps) {
  /*
   * Current visualization mode.
   *
   * null = complete 3D volume
   * x    = longitude slice
   * y    = latitude slice
   * z    = depth slice
   */
  const [sliceAxis, setSliceAxis] = useState<
    'x' | 'y' | 'z' | null
  >(null);

  const [sliceIndex, setSliceIndex] = useState(0);
  const [argoObservations, setArgoObservations] = useState<ArgoObservation[]>([]);
  const [selectedArgoKey, setSelectedArgoKey] = useState<string | null>(null);
  const [argoLoading, setArgoLoading] = useState(false);
  const [showArgo, setShowArgo] = useState(true);
  const [showVectors] = useState(true);
  const [currentComponents, setCurrentComponents] = useState<{
    u: OceanVolume | null;
    v: OceanVolume | null;
  }>({ u: null, v: null });
  const [vectorsLoading, setVectorsLoading] = useState(false);

  // The 3D scalar volume must follow the same timeline index as the
  // 2D globe slice. Keep a small in-memory cache so revisiting a time
  // step does not request the same full volume again.
  const [timelineVolume, setTimelineVolume] = useState<OceanVolume | null>(null);
  const [timelineVolumeLoading, setTimelineVolumeLoading] = useState(false);
  const volumeCacheRef = React.useRef<Map<string, OceanVolume>>(new Map());
  const [showTransect, setShowTransect] = useState(false);
  const [transectA, setTransectA] = useState({ latitude: 12.0, longitude: 65.5 });
  const [transectB, setTransectB] = useState({ latitude: 14.5, longitude: 69.5 });

  useEffect(() => {
    if (variable === 'currents') {
      setTimelineVolume(null);
      setTimelineVolumeLoading(false);
      return;
    }

    const cacheKey = `${variable}_${timeIndex}`;
    const cached = volumeCacheRef.current.get(cacheKey);
    if (cached) {
      setTimelineVolume(cached);
      setTimelineVolumeLoading(false);
      return;
    }

    let cancelled = false;
    setTimelineVolumeLoading(true);

    fetch(
      `http://127.0.0.1:8000/volume?variable=${encodeURIComponent(variable)}&time_index=${timeIndex}`
    )
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load ${variable} volume`);
        return response.json();
      })
      .then((data: OceanVolume) => {
        if (cancelled) return;
        if (!Array.isArray(data.depth) || !Array.isArray(data.latitude) || !Array.isArray(data.longitude) || !Array.isArray(data.values)) {
          throw new Error('Invalid 3D volume response');
        }
        volumeCacheRef.current.set(cacheKey, data);
        setTimelineVolume(data);
      })
      .catch(() => {
        if (!cancelled) setTimelineVolume(null);
      })
      .finally(() => {
        if (!cancelled) setTimelineVolumeLoading(false);
      });

    return () => { cancelled = true; };
  }, [variable, timeIndex]);

  useEffect(() => {
    // Only request U/V when Current Velocity Field is selected.
    // Temperature and salinity should not incur these extra full-volume requests.
    if (variable !== 'currents') {
      setCurrentComponents({ u: null, v: null });
      setVectorsLoading(false);
      return;
    }

    let cancelled = false;
    setCurrentComponents({ u: null, v: null });
    setVectorsLoading(true);

    const loadComponent = async (component: 'uo' | 'vo') => {
      const response = await fetch(
        `http://127.0.0.1:8000/volume?variable=${component}&time_index=${timeIndex}`
      );
      if (!response.ok) throw new Error(`Failed to load ${component}`);
      const data = await response.json();
      return data as OceanVolume;
    };

    Promise.all([loadComponent('uo'), loadComponent('vo')])
      .then(([u, v]) => {
        if (!cancelled) setCurrentComponents({ u, v });
      })
      .catch(() => {
        if (!cancelled) setCurrentComponents({ u: null, v: null });
      })
      .finally(() => {
        if (!cancelled) setVectorsLoading(false);
      });

    return () => { cancelled = true; };
  }, [variable, timeIndex]);

  useEffect(() => {
    let cancelled = false;
    setArgoLoading(true);
    fetch('http://127.0.0.1:8000/argo')
      .then((res) => { if (!res.ok) throw new Error('Argo request failed'); return res.json(); })
      .then((data) => { if (!cancelled) setArgoObservations(Array.isArray(data?.observations) ? data.observations : []); })
      .catch(() => { if (!cancelled) setArgoObservations([]); })
      .finally(() => { if (!cancelled) setArgoLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // For the Current Velocity Field, build a scalar speed volume
  // from the actual eastward (uo) and northward (vo) components.
  const displayVolume = useMemo<OceanVolume | null>(() => {
    if (variable !== 'currents') {
      // Prefer the timeline-synchronized volume. Fall back to the prop
      // only while the requested time step is loading.
      return timelineVolume ?? volume;
    }
    if (!currentComponents.u || !currentComponents.v) return null;

    const uVol = currentComponents.u;
    const vVol = currentComponents.v;
    const values = uVol.values.map((depthLayer, d) =>
      depthLayer.map((latRow, lat) =>
        latRow.map((uValue, lon) => {
          const vValue = vVol.values[d]?.[lat]?.[lon];
          if (!Number.isFinite(uValue) || !Number.isFinite(vValue)) return null;
          return Math.hypot(uValue as number, vValue as number);
        })
      )
    );

    return {
      variable: 'currents',
      time: uVol.time,
      depth: uVol.depth,
      latitude: uVol.latitude,
      longitude: uVol.longitude,
      values,
    };
  }, [volume, variable, timelineVolume, currentComponents]);

  /*
   * Convert:
   *
   * values[depth][latitude][longitude]
   *
   * into Plotly's flat x/y/z/value arrays.
   */
  const plotData = useMemo(() => {
    if (!displayVolume) {
      return null;
    }

    const x: number[] = [];
    const y: number[] = [];
    const z: number[] = [];
    const values: number[] = [];

    for (let d = 0; d < displayVolume.depth.length; d++) {
      for (let lat = 0; lat < displayVolume.latitude.length; lat++) {
        for (
          let lon = 0;
          lon < displayVolume.longitude.length;
          lon++
        ) {
          const value =
            displayVolume.values[d]?.[lat]?.[lon];

          if (
            value === null ||
            value === undefined ||
            !Number.isFinite(value)
          ) {
            continue;
          }

          x.push(displayVolume.longitude[lon]);
          y.push(displayVolume.latitude[lat]);

          /*
           * Keep the actual scientific depth.
           * Do NOT multiply this by vertical exaggeration.
           */
          z.push(-displayVolume.depth[d]);

          values.push(value);
        }
      }
    }

    return {
      x,
      y,
      z,
      values,
    };
  }, [displayVolume]);

  /*
   * Extract the vertical model profile at the nearest
   * Copernicus grid cell to the selected globe location.
   */
  const profileData = useMemo(() => {
    if (!displayVolume || !probePoint) {
      return null;
    }

    if (
      !displayVolume.latitude.length ||
      !displayVolume.longitude.length
    ) {
      return null;
    }

    const nearestIndex = (
      values: number[],
      target: number
    ): number => {
      let bestIndex = 0;
      let bestDistance = Infinity;

      for (let i = 0; i < values.length; i++) {
        const distance = Math.abs(
          values[i] - target
        );

        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = i;
        }
      }

      return bestIndex;
    };

    const latIndex = nearestIndex(
      displayVolume.latitude,
      probePoint.latitude
    );

    const lonIndex = nearestIndex(
      displayVolume.longitude,
      probePoint.longitude
    );

    const depth: number[] = [];
    const values: number[] = [];

    for (
      let d = 0;
      d < displayVolume.depth.length;
      d++
    ) {
      const value =
        displayVolume.values[d]?.[latIndex]?.[lonIndex];

      if (
        value !== null &&
        value !== undefined &&
        Number.isFinite(value)
      ) {
        depth.push(displayVolume.depth[d]);
        values.push(value);
      }
    }

    return {
      depth,
      values,
      lat: displayVolume.latitude[latIndex],
      lon: displayVolume.longitude[lonIndex],
    };
  }, [displayVolume, probePoint]);

  const selectedProfilePoint = useMemo(() => {
    if (!profileData || sliceAxis !== 'z' || !displayVolume) {
      return null;
    }

    const depth = displayVolume.depth[sliceIndex];
    if (depth === undefined) return null;

    let bestIndex = -1;
    let bestDistance = Infinity;

    for (let i = 0; i < profileData.depth.length; i++) {
      const distance = Math.abs(profileData.depth[i] - depth);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }

    if (bestIndex < 0) return null;

    return {
      depth: profileData.depth[bestIndex],
      value: profileData.values[bestIndex],
    };
  }, [profileData, sliceAxis, sliceIndex, displayVolume]);

  const argoProfiles = useMemo(() => {
    const groups = new Map<string, ArgoObservation[]>();
    for (const o of argoObservations) {
      if (![o.latitude,o.longitude,o.pressure,o.temperature,o.salinity].every(Number.isFinite)) continue;
      const key = `${o.platform}-${o.cycle}`;
      groups.set(key, [...(groups.get(key) ?? []), o]);
    }
    return Array.from(groups, ([key, observations]) => ({
      key,
      observations: observations.sort((a,b) => a.pressure - b.pressure),
    }));
  }, [argoObservations]);

  const selectedArgoProfile = useMemo(
    () => argoProfiles.find((p) => p.key === selectedArgoKey) ?? null,
    [argoProfiles, selectedArgoKey]
  );

  const argoPlotData = useMemo(() => {
    if (!showArgo || (variable !== 'thetao' && variable !== 'so')) return null;
    const maxModelDepth = Math.max(...(displayVolume?.depth ?? [2000]));
    const valid = argoObservations.filter((o) =>
      [o.latitude,o.longitude,o.pressure,o.temperature,o.salinity].every(Number.isFinite) &&
      o.pressure >= 0 && o.pressure <= maxModelDepth
    );
    return {
      x: valid.map((o) => o.longitude),
      y: valid.map((o) => o.latitude),
      z: valid.map((o) => -o.pressure),
      values: valid.map((o) => variable === 'so' ? o.salinity : o.temperature),
      customdata: valid.map((o) => [`${o.platform}-${o.cycle}`, o.platform, o.cycle]),
    };
  }, [argoObservations, showArgo, variable, displayVolume]);

  const selectedArgoComparison = useMemo(() => {
    if (!selectedArgoProfile || !displayVolume || (variable !== 'thetao' && variable !== 'so')) return null;

    const obs = selectedArgoProfile.observations.filter((o) =>
      o.pressure >= 0 && o.pressure <= Math.max(...displayVolume.depth)
    );
    if (!obs.length) return null;

    const nearest = (arr: number[], target: number) => {
      let idx = 0, best = Infinity;
      arr.forEach((v,i) => { const d = Math.abs(v-target); if (d < best) { best=d; idx=i; } });
      return idx;
    };

    const latIndex = nearest(displayVolume.latitude, obs[0].latitude);
    const lonIndex = nearest(displayVolume.longitude, obs[0].longitude);
    const depths: number[] = [], modelValues: number[] = [];
    for (let d=0; d<displayVolume.depth.length; d++) {
      const v = displayVolume.values[d]?.[latIndex]?.[lonIndex];
      if (v !== null && v !== undefined && Number.isFinite(v)) {
        depths.push(displayVolume.depth[d]); modelValues.push(v);
      }
    }

    const field = variable === 'so' ? 'salinity' : 'temperature';
    const interpolate = (p: number): number | null => {
      if (obs.length === 1) return obs[0][field];
      if (p < obs[0].pressure || p > obs[obs.length-1].pressure) return null;
      for (let i=1;i<obs.length;i++) {
        const lo=obs[i-1], hi=obs[i];
        if (p <= hi.pressure) {
          const span=hi.pressure-lo.pressure;
          return span === 0 ? hi[field] : lo[field] + ((p-lo.pressure)/span)*(hi[field]-lo[field]);
        }
      }
      return null;
    };

    const observedValues = depths.map(interpolate);
    const pairs = modelValues.map((m,i) => ({ model:m, observed:observedValues[i], depth:depths[i] }))
      .filter((p): p is {model:number; observed:number; depth:number} => p.observed !== null);
    const errors = pairs.map(p => p.model-p.observed);
    const mae = errors.length ? errors.reduce((s,e)=>s+Math.abs(e),0)/errors.length : null;
    const rmse = errors.length ? Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/errors.length) : null;

    const latA = obs[0].latitude;
    const lonA = obs[0].longitude;
    const latB = displayVolume.latitude[latIndex];
    const lonB = displayVolume.longitude[lonIndex];
    const rad = Math.PI / 180;
    const dLat = (latB - latA) * rad;
    const dLon = (lonB - lonA) * rad;
    const hav = Math.sin(dLat / 2) ** 2 +
      Math.cos(latA * rad) * Math.cos(latB * rad) * Math.sin(dLon / 2) ** 2;
    const spatialDistanceKm = 6371 * 2 * Math.asin(Math.sqrt(hav));

    return {
      platform: obs[0].platform, cycle: obs[0].cycle,
      latitude: obs[0].latitude, longitude: obs[0].longitude, time: obs[0].time,
      modelTime: displayVolume.time, modelLat: latB, modelLon: lonB,
      depths, modelValues, observedValues, mae, rmse, pairCount:pairs.length,
      pairs, spatialDistanceKm
    };
  }, [selectedArgoProfile, displayVolume, variable]);

  const vectorData = useMemo(() => {
    const uVolume = currentComponents.u;
    const vVolume = currentComponents.v;
    if (variable !== 'currents' || !showVectors || !uVolume || !vVolume) return null;

    const x: number[] = [];
    const y: number[] = [];
    const z: number[] = [];
    const u: number[] = [];
    const v: number[] = [];
    const w: number[] = [];
    const speed: number[] = [];

    // Subsample the model grid so the 3D vector field remains interactive.
    const depthStep = Math.max(1, Math.floor(uVolume.depth.length / 8));
    const latStep = Math.max(1, Math.floor(uVolume.latitude.length / 12));
    const lonStep = Math.max(1, Math.floor(uVolume.longitude.length / 12));

    for (let d = 0; d < uVolume.depth.length; d += depthStep) {
      for (let lat = 0; lat < uVolume.latitude.length; lat += latStep) {
        for (let lon = 0; lon < uVolume.longitude.length; lon += lonStep) {
          const uu = uVolume.values[d]?.[lat]?.[lon];
          const vv = vVolume.values[d]?.[lat]?.[lon];
          if (!Number.isFinite(uu) || !Number.isFinite(vv)) continue;

          const magnitude = Math.hypot(uu as number, vv as number);
          if (magnitude < 0.001) continue;

          x.push(uVolume.longitude[lon]);
          y.push(uVolume.latitude[lat]);
          z.push(-uVolume.depth[d]);
          // Plotly cone directions share the globe's coordinate units (degrees).
          // Normalize the physical velocity and scale it into a visible arrow.
          u.push(((uu as number) / magnitude) * 0.16);
          v.push(((vv as number) / magnitude) * 0.16);
          w.push(0);
          speed.push(magnitude);
        }
      }
    }

    return { x, y, z, u, v, w, speed };
  }, [currentComponents, variable, showVectors, sliceAxis, sliceIndex, displayVolume]);

  const transectData = useMemo(() => {
    if (!displayVolume || !showTransect) return null;

    const clampIndex = (values: number[], target: number) => {
      let best = 0, bestDistance = Infinity;
      for (let i = 0; i < values.length; i++) {
        const distance = Math.abs(values[i] - target);
        if (distance < bestDistance) { bestDistance = distance; best = i; }
      }
      return best;
    };

    const samples = 50;
    const x: number[] = [];
    const y: number[] = [];
    const z: number[] = [];
    const values: number[] = [];

    for (let sIndex = 0; sIndex < samples; sIndex++) {
      const t = sIndex / (samples - 1);
      const lat = transectA.latitude + t * (transectB.latitude - transectA.latitude);
      const lon = transectA.longitude + t * (transectB.longitude - transectA.longitude);
      const latIndex = clampIndex(displayVolume.latitude, lat);
      const lonIndex = clampIndex(displayVolume.longitude, lon);

      const dx = (lon - transectA.longitude) * 111.32 * Math.cos((lat * Math.PI) / 180);
      const dy = (lat - transectA.latitude) * 111.32;
      const distanceKm = Math.sqrt(dx * dx + dy * dy);

      for (let d = 0; d < displayVolume.depth.length; d++) {
        const value = displayVolume.values[d]?.[latIndex]?.[lonIndex];
        if (value === null || value === undefined || !Number.isFinite(value)) continue;
        x.push(distanceKm);
        y.push(-displayVolume.depth[d]);
        z.push(displayVolume.depth[d]);
        values.push(value);
      }
    }

    return { x, y, z, values, totalDistance: Math.sqrt(
      Math.pow((transectB.longitude - transectA.longitude) * 111.32 * Math.cos(((transectA.latitude + transectB.latitude) / 2) * Math.PI / 180), 2) +
      Math.pow((transectB.latitude - transectA.latitude) * 111.32, 2)
    ) };
  }, [displayVolume, showTransect, transectA, transectB]);

  const label = VARIABLE_LABELS[variable];
  const unit = VARIABLE_UNITS[variable];

  /*
   * Middle coordinates are used initially.
   *
   * Later we can expose these as sliders so the user
   * can move the slice interactively.
   */
  const middleLongitude = useMemo(() => {
    if (!displayVolume || !displayVolume.longitude.length) {
      return 0;
    }

    return displayVolume.longitude[
      Math.floor(displayVolume.longitude.length / 2)
    ];
  }, [displayVolume]);

  const middleLatitude = useMemo(() => {
    if (!displayVolume || !displayVolume.latitude.length) {
      return 0;
    }

    return displayVolume.latitude[
      Math.floor(displayVolume.latitude.length / 2)
    ];
  }, [displayVolume]);

  const middleDepth = useMemo(() => {
    if (!displayVolume || !displayVolume.depth.length) {
      return 0;
    }

    return displayVolume.depth[
      Math.floor(displayVolume.depth.length / 2)
    ];
  }, [displayVolume]);

  const slicePosition = useMemo(() => {
    if (!displayVolume || sliceAxis === null) {
      return null;
    }

    if (sliceAxis === 'x') {
      return {
        value:
          displayVolume.longitude[sliceIndex] ??
          middleLongitude,
        label: 'LONGITUDE',
        unit: '°E',
        maxIndex: Math.max(
          0,
          displayVolume.longitude.length - 1
        ),
      };
    }

    if (sliceAxis === 'y') {
      return {
        value:
          displayVolume.latitude[sliceIndex] ??
          middleLatitude,
        label: 'LATITUDE',
        unit: '°N',
        maxIndex: Math.max(
          0,
          displayVolume.latitude.length - 1
        ),
      };
    }

    return {
      value:
        displayVolume.depth[sliceIndex] ??
        middleDepth,
      label: 'DEPTH',
      unit: 'm',
      maxIndex: Math.max(
        0,
        displayVolume.depth.length - 1
      ),
    };
  }, [
    displayVolume,
    sliceAxis,
    sliceIndex,
    middleLongitude,
    middleLatitude,
    middleDepth,
  ]);

  /*
   * Loading state
   */
  if (isLoading || (!displayVolume && timelineVolumeLoading)) {
    return (
      <div className="volume-viewer">
        <div className="volume-status">
          <div className="volume-spinner" />

          <span>
            Loading 3D ocean volume…
          </span>
        </div>
      </div>
    );
  }

  /*
   * Error state
   */
  if (error) {
    return (
      <div className="volume-viewer">
        <div className="volume-status volume-error">
          <strong>
            Unable to load 3D volume
          </strong>

          <span>{error}</span>
        </div>
      </div>
    );
  }

  /*
   * Empty state
   */
  if (
    !displayVolume ||
    !plotData ||
    plotData.values.length === 0
  ) {
    return (
      <div className="volume-viewer">
        <div className="volume-status">
          <span>
            No 3D volume selected.
          </span>
        </div>
      </div>
    );
  }

  const minValue = Math.min(
    ...plotData.values
  );

  const maxValue = Math.max(
    ...plotData.values
  );

  return (
    <div className="volume-viewer">

      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="volume-header">

        <div>
          <div className="volume-title">
            3D SUBSURFACE VOLUME
          </div>

          <div className="volume-subtitle">
            {label} · {unit}
            <span style={{ marginLeft: 10, color: '#64748b' }}>
              MODEL TIME {timeIndex + 1}
            </span>
          </div>
        </div>

        <div className="volume-meta">
          <span>
            {displayVolume.latitude.length} ×{' '}
            {displayVolume.longitude.length}
          </span>

          <span>
            {displayVolume.depth.length} depth levels
          </span>
        </div>

      </div>

      {/* =====================================================
          MAIN CONTENT
      ====================================================== */}

      <div className="volume-content">

        {/* ===================================================
            3D PLOT
        ==================================================== */}

        <div className="volume-plot">

          {/* -----------------------------------------------
              MODE CONTROLS
          ------------------------------------------------ */}

          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              zIndex: 10,

              display: 'flex',
              gap: 6,

              padding: 6,

              background:
                'rgba(2, 6, 23, 0.88)',

              border:
                '1px solid rgba(148,163,184,0.2)',

              borderRadius: 4,
            }}
          >

            {/* VOLUME */}

            <button
              onClick={() => {
                setSliceAxis(null);
                setSliceIndex(0);
              }}
              style={{
                padding: '5px 9px',
                fontSize: 10,
                color: '#cbd5e1',

                background:
                  sliceAxis === null
                    ? '#164e63'
                    : '#0f172a',

                border:
                  '1px solid rgba(148,163,184,0.2)',

                cursor: 'pointer',
              }}
            >
              VOLUME
            </button>

            {/* X SLICE */}

            <button
              onClick={() => {
                setSliceAxis('x');
                setSliceIndex(
                  Math.floor(
                    displayVolume.longitude.length / 2
                  )
                );
              }}
              style={{
                padding: '5px 9px',
                fontSize: 10,
                color: '#cbd5e1',

                background:
                  sliceAxis === 'x'
                    ? '#164e63'
                    : '#0f172a',

                border:
                  '1px solid rgba(148,163,184,0.2)',

                cursor: 'pointer',
              }}
            >
              X · LONGITUDE
            </button>

            {/* Y SLICE */}

            <button
              onClick={() => {
                setSliceAxis('y');
                setSliceIndex(
                  Math.floor(
                    displayVolume.latitude.length / 2
                  )
                );
              }}
              style={{
                padding: '5px 9px',
                fontSize: 10,
                color: '#cbd5e1',

                background:
                  sliceAxis === 'y'
                    ? '#164e63'
                    : '#0f172a',

                border:
                  '1px solid rgba(148,163,184,0.2)',

                cursor: 'pointer',
              }}
            >
              Y · LATITUDE
            </button>

            {/* Z SLICE */}

            <button
              onClick={() => {
                setSliceAxis('z');
                setSliceIndex(
                  Math.floor(
                    displayVolume.depth.length / 2
                  )
                );
              }}
              style={{
                padding: '5px 9px',
                fontSize: 10,
                color: '#cbd5e1',

                background:
                  sliceAxis === 'z'
                    ? '#164e63'
                    : '#0f172a',

                border:
                  '1px solid rgba(148,163,184,0.2)',

                cursor: 'pointer',
              }}
            >
              Z · DEPTH
            </button>

          </div>

          <button
            onClick={() => setShowTransect(v => !v)}
            style={{
              position:'absolute', top:12, right:12, zIndex:10,
              padding:'6px 10px', fontSize:10, color:'#cbd5e1',
              background: showTransect ? '#164e63' : '#0f172a',
              border:'1px solid rgba(148,163,184,0.2)', borderRadius:4, cursor:'pointer'
            }}
          >
            {showTransect ? 'TRANSECT ON' : 'TRANSECT'}
          </button>

          {/* -----------------------------------------------
              SLICE POSITION
          ------------------------------------------------ */}

          {slicePosition && (
            <div
              style={{
                position: 'absolute',
                top: 62,
                left: 12,
                zIndex: 10,
                width: 300,
                padding: '8px 12px',
                background:
                  'rgba(2, 6, 23, 0.88)',
                border:
                  '1px solid rgba(148,163,184,0.2)',
                borderRadius: 4,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 5,
                  fontSize: 10,
                  color: '#94a3b8',
                  letterSpacing: '0.08em',
                }}
              >
                <span>{slicePosition.label}</span>
                <span>
                  {slicePosition.value.toFixed(2)}
                  {slicePosition.unit}
                </span>
              </div>

              <input
                type="range"
                min={0}
                max={slicePosition.maxIndex}
                step={1}
                value={Math.min(
                  sliceIndex,
                  slicePosition.maxIndex
                )}
                onChange={(event) =>
                  setSliceIndex(
                    Number(event.target.value)
                  )
                }
                style={{
                  width: '100%',
                }}
              />
            </div>
          )}

          <button
            onClick={() => setShowArgo((v) => !v)}
            style={{ position: 'absolute', top: slicePosition ? 120 : 62, left: 12, zIndex: 10, padding: '5px 9px', fontSize: 10, color: '#cbd5e1', background: showArgo ? '#164e63' : '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 4, cursor: 'pointer' }}
          >
            {showArgo ? 'ARGO ON' : 'ARGO OFF'}{argoLoading ? ' · LOADING' : ` · ${argoObservations.length}`}
          </button>



          {/* -----------------------------------------------
              PLOTLY VOLUME
          ------------------------------------------------ */}

          <Plot
            data={[
              {
                type: 'volume',

                x: plotData.x,
                y: plotData.y,
                z: plotData.z,

                value: plotData.values,

                /*
                 * Repository-style opacity.
                 */
                opacity,

                /*
                 * Data range.
                 */
                isomin: minValue,
                isomax: maxValue,

                cmin: minValue,
                cmax: maxValue,

                /*
                 * Repository temperature palette.
                 */
                colorscale: 'Jet',

                /*
                 * Repository-style slice behavior.
                 *
                 * Only the selected axis is displayed.
                 */
                slices: {
                  x: {
                    show: sliceAxis === 'x',
                    locations:
                      sliceAxis === 'x' && slicePosition
                        ? [slicePosition.value]
                        : [],
                  },

                  y: {
                    show: sliceAxis === 'y',
                    locations:
                      sliceAxis === 'y' && slicePosition
                        ? [slicePosition.value]
                        : [],
                  },

                  z: {
                    show: sliceAxis === 'z',
                    locations:
                      sliceAxis === 'z' && slicePosition
                        ? [-slicePosition.value]
                        : [],
                  },
                },

                /*
                 * Full volume mode:
                 *
                 * surfaces/caps visible.
                 *
                 * Slice mode:
                 *
                 * surfaces/caps hidden.
                 */
                surface: {
                  show: sliceAxis === null,
                  count: 2,
                },

                caps: {
                  x: {
                    show: sliceAxis === null,
                  },

                  y: {
                    show: sliceAxis === null,
                  },

                  z: {
                    show: sliceAxis === null,
                  },
                },

                colorbar: {
                  title:
                    `${label} (${unit})`,

                  thickness: 14,
                  len: 0.7,
                },
              },

              ...(vectorData && vectorData.x.length > 0
                ? [{
                    /*
                     * Simple line arrows instead of Plotly cones.
                     * Each vector is drawn as:
                     *     shaft ─────▶
                     *             ╲ /
                     *              V
                     *
                     * Plotly scatter3d has no native arrowhead for lines,
                     * so we build a small two-segment arrowhead manually.
                     */
                    type: 'scatter3d' as const,
                    mode: 'lines' as const,
                    x: vectorData.x.flatMap((x, i) => {
                      const y = vectorData.y[i];
                      const z = vectorData.z[i];
                      const dx = vectorData.u[i];
                      const dy = vectorData.v[i];
                      const length = Math.hypot(dx, dy);
                      if (!length) return [x, x, null as unknown as number, x, null as unknown as number];

                      const ex = x + dx;
                      const ey = y + dy;

                      const headLength = Math.min(0.045, length * 0.32);
                      const angle = Math.atan2(dy, dx);
                      const a1 = angle + Math.PI * 0.82;
                      const a2 = angle - Math.PI * 0.82;

                      return [
                        x, ex, null as unknown as number,
                        ex, ex + headLength * Math.cos(a1), null as unknown as number,
                        ex, ex + headLength * Math.cos(a2), null as unknown as number,
                      ];
                    }),
                    y: vectorData.y.flatMap((y, i) => {
                      const x = vectorData.x[i];
                      const z = vectorData.z[i];
                      const dx = vectorData.u[i];
                      const dy = vectorData.v[i];
                      const length = Math.hypot(dx, dy);
                      if (!length) return [y, y, null as unknown as number, y, null as unknown as number];

                      const ex = x + dx;
                      const ey = y + dy;
                      const headLength = Math.min(0.045, length * 0.32);
                      const angle = Math.atan2(dy, dx);
                      const a1 = angle + Math.PI * 0.82;
                      const a2 = angle - Math.PI * 0.82;

                      return [
                        y, ey, null as unknown as number,
                        ey, ey + headLength * Math.sin(a1), null as unknown as number,
                        ey, ey + headLength * Math.sin(a2), null as unknown as number,
                      ];
                    }),
                    z: vectorData.z.flatMap((z, i) => {
                      const dx = vectorData.u[i];
                      const dy = vectorData.v[i];
                      const length = Math.hypot(dx, dy);
                      if (!length) return [z, z, null as unknown as number, z, null as unknown as number];

                      return [
                        z, z, null as unknown as number,
                        z, z, null as unknown as number,
                        z, z, null as unknown as number,
                      ];
                    }),
                    line: {
                      width: 3,
                    },
                    name: 'Current Vectors',
                    hovertemplate: 'Speed: %{customdata:.3f} m/s<extra>Current</extra>',
                    customdata: vectorData.speed.flatMap((speed) => [
                      speed, speed, null,
                      speed, speed, null,
                      speed, speed, null,
                    ]),
                    showlegend: false,
                  }]
                : []),

              ...(argoPlotData && argoPlotData.x.length > 0
                ? [{
                    type: 'scatter3d' as const,
                    x: argoPlotData.x,
                    y: argoPlotData.y,
                    z: argoPlotData.z,
                    customdata: argoPlotData.customdata,
                    mode: 'markers' as const,
                    marker: {
                      size: 3.5,
                      opacity: 0.9,
                      color: argoPlotData.values,
                      colorscale: 'Jet' as const,
                      cmin: minValue,
                      cmax: maxValue,
                      colorbar: { title: variable === 'so' ? 'Argo (PSU)' : 'Argo (°C)' },
                    },
                    name: 'Argo Observations',
                  }]
                : []),

              /* ---------------------------------------------
                 SELECTED PROBE LOCATION
              ---------------------------------------------- */

              ...(probePoint
                ? [
                    {
                      type:
                        'scatter3d' as const,

                      x: [
                        probePoint.longitude,
                      ],

                      y: [
                        probePoint.latitude,
                      ],

                      /*
                       * Keep probe depth in the same
                       * coordinate system as the displayVolume.
                       */
                      z: [
                        -probePoint.depth,
                      ],

                      mode:
                        'markers+text' as const,

                      marker: {
                        size: 7,
                        color: '#22d3ee',

                        line: {
                          width: 2,
                          color: '#ffffff',
                        },
                      },

                      text: ['SELECTED'],

                      textposition:
                        'top center' as const,

                      name:
                        'Selected Location',
                    },
                  ]
                : []),
            ]}

            onClick={(event: any) => {
              const argoPoint = event?.points?.find(
                (p: any) =>
                  p?.data?.name === 'Argo Observations' &&
                  Array.isArray(p?.customdata)
              );

              if (argoPoint?.customdata?.[0]) {
                setSelectedArgoKey(String(argoPoint.customdata[0]));
              }
            }}

            layout={{
              uirevision: 'oceanlens-volume-camera',
              autosize: true,

              // Preserve the user's 3D camera/orbit between React renders.
              // Without this Plotly reapplies the initial camera after mouse-up.
            

              margin: {
                l: 45,
                r: 30,
                t: 20,
                b: 45,
              },

              paper_bgcolor:
                'rgba(0,0,0,0)',

              plot_bgcolor:
                'rgba(0,0,0,0)',

              scene: {

                // Keep the 3D interaction in orbit/rotate mode.
                dragmode: 'orbit',

                /*
                 * Based on the repository's
                 * volumetric scene proportions.
                 */
                aspectratio: {
                  x: 1.7,
                  y: 1.7,
                  z: 0.6,
                },

                xaxis: {
                  title:
                    'Longitude (°E)',

                  gridcolor:
                    'rgba(148,163,184,0.15)',

                  zerolinecolor:
                    'rgba(148,163,184,0.2)',
                },

                yaxis: {
                  title:
                    'Latitude (°N)',

                  gridcolor:
                    'rgba(148,163,184,0.15)',

                  zerolinecolor:
                    'rgba(148,163,184,0.2)',
                },

                zaxis: {
                  title:
                    'Depth (m)',

                  gridcolor:
                    'rgba(148,163,184,0.15)',

                  zerolinecolor:
                    'rgba(148,163,184,0.2)',

                  /*
                   * Actual scientific depths.
                   */
                  tickvals:
                    displayVolume.depth.map(
                      (depth) => -depth
                    ),

                  ticktext:
                    displayVolume.depth.map(
                      (depth) =>
                        `${depth.toFixed(0)} m`
                    ),
                },

                bgcolor:
                  'rgba(0,0,0,0)',

                /*
                 * Repository-style camera.
                 */
                camera: {
                  eye: {
                    x: -1.25,
                    y: -1.75,
                    z: 1.25,
                  },
                },
              },

              font: {
                family:
                  'Inter, Arial, sans-serif',

                size: 11,

                color: '#cbd5e1',
              },
            }}

            config={{
              responsive: true,
              displaylogo: false,
              scrollZoom: false,
              doubleClick: false,

              modeBarButtonsToRemove: [
                'lasso2d',
                'select2d',
                'autoScale2d',
              ],
            }}

            style={{
              width: '100%',
              height: '100%',
            }}

            useResizeHandler
          />

        </div>

        {showTransect && transectData && (
          <div style={{
            position:'absolute', left:20, right:20, top:70, bottom:20, zIndex:30,
            background:'rgba(2,6,23,0.97)', border:'1px solid rgba(148,163,184,0.25)',
            borderRadius:5, padding:12, display:'flex', flexDirection:'column'
          }}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
              <div>
                <div className="profile-title">VERTICAL TRANSECT</div>
                <div style={{fontSize:9,color:'#64748b'}}>
                  {transectData.totalDistance.toFixed(1)} km · {label} · {displayVolume.time}
                </div>
              </div>
              <button onClick={()=>setShowTransect(false)} style={{
                padding:'4px 8px',fontSize:9,color:'#cbd5e1',background:'#0f172a',
                border:'1px solid rgba(148,163,184,0.2)',cursor:'pointer'
              }}>CLOSE</button>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
              {[
                ['A', transectA, setTransectA],
                ['B', transectB, setTransectB]
              ].map(([name, point, setter]: any) => (
                <div key={name} style={{display:'grid',gridTemplateColumns:'auto 1fr 1fr',gap:5,alignItems:'center'}}>
                  <span style={{fontSize:9,color:'#94a3b8'}}>{name}</span>
                  <input type="number" step="0.01" min={displayVolume.latitude[0]} max={displayVolume.latitude[displayVolume.latitude.length-1]}
                    value={point.latitude} onChange={e=>setter((p:any)=>({...p,latitude:Number(e.target.value)}))}
                    style={{background:'#0f172a',color:'#cbd5e1',border:'1px solid rgba(148,163,184,.2)',padding:4,fontSize:9}} placeholder="Latitude"/>
                  <input type="number" step="0.01" min={displayVolume.longitude[0]} max={displayVolume.longitude[displayVolume.longitude.length-1]}
                    value={point.longitude} onChange={e=>setter((p:any)=>({...p,longitude:Number(e.target.value)}))}
                    style={{background:'#0f172a',color:'#cbd5e1',border:'1px solid rgba(148,163,184,.2)',padding:4,fontSize:9}} placeholder="Longitude"/>
                </div>
              ))}
            </div>

            <div style={{flex:1,minHeight:0}}>
              <Plot
                data={[{
                  type:'scatter' as const, mode:'markers' as const,
                  x:transectData.x, y:transectData.y,
                  marker:{size:5,color:transectData.values,colorscale:'Jet',cmin:Math.min(...plotData.values),cmax:Math.max(...plotData.values),
                    colorbar:{title:`${label} (${unit})`,thickness:14,len:.8}},
                  name:label, hovertemplate:'Distance: %{x:.1f} km<br>Depth: %{y:.0f} m<br>'+label+': %{marker.color:.2f} '+unit+'<extra></extra>'
                }]}
                layout={{
                  autosize:true, margin:{l:55,r:20,t:10,b:45},
                  paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',
                  xaxis:{title:'Distance along transect (km)',gridcolor:'rgba(148,163,184,.12)'},
                  yaxis:{title:'Depth (m)',gridcolor:'rgba(148,163,184,.12)',autorange:'reversed'},
                  font:{family:'Inter,Arial,sans-serif',size:10,color:'#94a3b8'}
                }}
                config={{responsive:true,displaylogo:false}}
                style={{width:'100%',height:'100%'}} useResizeHandler
              />
            </div>
            <div style={{fontSize:8,color:'#64748b',marginTop:5}}>
              A: {transectA.latitude.toFixed(2)}°N, {transectA.longitude.toFixed(2)}°E
              &nbsp;&nbsp; B: {transectB.latitude.toFixed(2)}°N, {transectB.longitude.toFixed(2)}°E
              &nbsp; · Nearest model grid cell used at each transect sample.
            </div>
          </div>
        )}

        {/* ===================================================
            VERTICAL PROFILE
        ==================================================== */}

        {selectedArgoComparison && (
          <div
            style={{
              position:'absolute',
              top:58,
              right:18,
              bottom:18,
              left:18,
              zIndex:100,
              background:'rgba(2,6,23,0.985)',
              border:'1px solid rgba(34,211,238,0.35)',
              borderRadius:10,
              padding:14,
              display:'flex',
              flexDirection:'column',
              minHeight:0,
              boxShadow:'0 18px 60px rgba(0,0,0,.45)'
            }}
          >
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                  <div style={{fontSize:10,fontWeight:800,letterSpacing:'.14em',color:'#22d3ee'}}>
                    OBSERVATION VALIDATION
                  </div>
                  <select
                    value={selectedArgoKey ?? ''}
                    onChange={(e)=>setSelectedArgoKey(e.target.value || null)}
                    style={{
                      background:'#0f172a',
                      color:'#cbd5e1',
                      border:'1px solid rgba(34,211,238,.3)',
                      borderRadius:4,
                      padding:'3px 6px',
                      fontSize:9
                    }}
                  >
                    {argoProfiles.map((p)=>(
                      <option key={p.key} value={p.key}>
                        Float {p.observations[0].platform} · Cycle {p.observations[0].cycle}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{fontSize:17,fontWeight:800,color:'#f8fafc',marginTop:2}}>
                  Copernicus Model vs Argo Observation
                </div>
                <div style={{fontSize:9,color:'#94a3b8',marginTop:4}}>
                  Float {selectedArgoComparison.platform} · Cycle {selectedArgoComparison.cycle}
                  {' · '}
                  {selectedArgoComparison.latitude.toFixed(4)}°N, {selectedArgoComparison.longitude.toFixed(4)}°E
                </div>
              </div>
              <button
                onClick={()=>setSelectedArgoKey(null)}
                style={{
                  padding:'6px 10px',
                  fontSize:9,
                  fontWeight:700,
                  color:'#cbd5e1',
                  background:'#0f172a',
                  border:'1px solid rgba(148,163,184,.25)',
                  borderRadius:5,
                  cursor:'pointer'
                }}
              >
                CLOSE
              </button>
            </div>

            <div style={{
              display:'grid',
              gridTemplateColumns:'repeat(4,minmax(0,1fr))',
              gap:7,
              margin:'12px 0'
            }}>
              {[
                ['MAE', selectedArgoComparison.mae === null ? '—' : `${selectedArgoComparison.mae.toFixed(3)} ${unit}`],
                ['RMSE', selectedArgoComparison.rmse === null ? '—' : `${selectedArgoComparison.rmse.toFixed(3)} ${unit}`],
                ['DEPTH PAIRS', `${selectedArgoComparison.pairCount}`],
                ['GRID OFFSET', `${selectedArgoComparison.spatialDistanceKm.toFixed(1)} km`],
              ].map(([title,value])=>(
                <div key={title} style={{
                  background:'rgba(15,23,42,.9)',
                  border:'1px solid rgba(148,163,184,.15)',
                  borderRadius:6,
                  padding:'7px 9px'
                }}>
                  <div style={{fontSize:8,color:'#64748b',letterSpacing:'.08em'}}>{title}</div>
                  <div style={{fontSize:12,fontWeight:800,color:'#f8fafc',marginTop:2}}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{
              display:'grid',
              gridTemplateColumns:'1.15fr 1fr',
              gap:10,
              flex:1,
              minHeight:0
            }}>
              <div style={{
                minHeight:0,
                border:'1px solid rgba(148,163,184,.14)',
                borderRadius:7,
                background:'rgba(15,23,42,.45)',
                display:'flex',
                flexDirection:'column'
              }}>
                <div style={{padding:'8px 10px 0',fontSize:9,fontWeight:700,color:'#cbd5e1'}}>
                  DEPTH PROFILE
                  <span style={{color:'#64748b',fontWeight:400}}> · same model depth levels</span>
                </div>
                <div style={{flex:1,minHeight:0}}>
                  <Plot
                    data={[
                      {
                        type:'scatter' as const,
                        mode:'lines+markers' as const,
                        x:selectedArgoComparison.modelValues,
                        y:selectedArgoComparison.depths.map(d=>-d),
                        line:{width:3},
                        marker:{size:5},
                        name:'Copernicus Model',
                        customdata:selectedArgoComparison.depths,
                        hovertemplate:`Model: %{x:.3f} ${unit}<br>Depth: %{customdata:.1f} m<extra></extra>`
                      },
                      {
                        type:'scatter' as const,
                        mode:'lines+markers' as const,
                        x:selectedArgoComparison.observedValues,
                        y:selectedArgoComparison.depths.map(d=>-d),
                        line:{width:3,dash:'dash' as const},
                        marker:{size:6},
                        name:'Argo Observation',
                        customdata:selectedArgoComparison.depths,
                        connectgaps:false,
                        hovertemplate:`Observed: %{x:.3f} ${unit}<br>Depth: %{customdata:.1f} m<extra></extra>`
                      }
                    ]}
                    layout={{
                      autosize:true,
                      margin:{l:55,r:12,t:10,b:45},
                      paper_bgcolor:'rgba(0,0,0,0)',
                      plot_bgcolor:'rgba(0,0,0,0)',
                      xaxis:{title:`${label} (${unit})`,gridcolor:'rgba(148,163,184,.12)'},
                      yaxis:{title:'Depth (m)',autorange:'reversed',gridcolor:'rgba(148,163,184,.12)'},
                      legend:{orientation:'h',y:1.04,x:0,font:{size:9}},
                      font:{family:'Inter,Arial,sans-serif',size:9,color:'#94a3b8'}
                    }}
                    config={{responsive:true,displaylogo:false}}
                    style={{width:'100%',height:'100%'}}
                    useResizeHandler
                  />
                </div>
              </div>

              <div style={{
                minHeight:0,
                border:'1px solid rgba(148,163,184,.14)',
                borderRadius:7,
                background:'rgba(15,23,42,.45)',
                display:'flex',
                flexDirection:'column'
              }}>
                <div style={{padding:'8px 10px 0',fontSize:9,fontWeight:700,color:'#cbd5e1'}}>
                  MODEL vs OBSERVATION
                  <span style={{color:'#64748b',fontWeight:400}}> · paired depth values</span>
                </div>
                <div style={{flex:1,minHeight:0}}>
                  <Plot
                    data={[
                      {
                        type:'scatter' as const,
                        mode:'markers' as const,
                        x:selectedArgoComparison.pairs.map((p:any)=>p.observed),
                        y:selectedArgoComparison.pairs.map((p:any)=>p.model),
                        marker:{size:8},
                        name:'Paired depths',
                        text:selectedArgoComparison.pairs.map((p:any)=>`${p.depth.toFixed(1)} m`),
                        hovertemplate:`Observed: %{x:.3f} ${unit}<br>Model: %{y:.3f} ${unit}<br>Depth: %{text}<extra></extra>`
                      },
                      {
                        type:'scatter' as const,
                        mode:'lines' as const,
                        x:(()=>{
                          const a=selectedArgoComparison.pairs.flatMap((p:any)=>[p.observed,p.model]);
                          if(!a.length)return [];
                          const lo=Math.min(...a),hi=Math.max(...a);
                          return [lo,hi];
                        })(),
                        y:(()=>{
                          const a=selectedArgoComparison.pairs.flatMap((p:any)=>[p.observed,p.model]);
                          if(!a.length)return [];
                          const lo=Math.min(...a),hi=Math.max(...a);
                          return [lo,hi];
                        })(),
                        line:{dash:'dot' as const,width:2},
                        name:'Perfect agreement',
                        hoverinfo:'skip'
                      }
                    ]}
                    layout={{
                      autosize:true,
                      margin:{l:58,r:12,t:10,b:45},
                      paper_bgcolor:'rgba(0,0,0,0)',
                      plot_bgcolor:'rgba(0,0,0,0)',
                      xaxis:{title:`Observed (${unit})`,gridcolor:'rgba(148,163,184,.12)'},
                      yaxis:{title:`Model (${unit})`,gridcolor:'rgba(148,163,184,.12)'},
                      legend:{orientation:'h',y:1.04,x:0,font:{size:9}},
                      font:{family:'Inter,Arial,sans-serif',size:9,color:'#94a3b8'}
                    }}
                    config={{responsive:true,displaylogo:false}}
                    style={{width:'100%',height:'100%'}}
                    useResizeHandler
                  />
                </div>
              </div>
            </div>

            <div style={{
              marginTop:9,
              paddingTop:8,
              borderTop:'1px solid rgba(148,163,184,.1)',
              fontSize:8.5,
              color:'#64748b',
              lineHeight:1.5
            }}>
              Observation: {selectedArgoComparison.time}
              {' · '}
              Model: {selectedArgoComparison.modelTime}
              {' · '}
              Nearest Copernicus grid: {selectedArgoComparison.modelLat.toFixed(3)}°N, {selectedArgoComparison.modelLon.toFixed(3)}°E
              {' · '}
              Argo observations are interpolated to the model depth levels for the paired comparison.
            </div>
          </div>
        )}

        {profileData && !selectedArgoComparison && (
          <div className="volume-profile">

            <div className="profile-title">
              VERTICAL PROFILE
            </div>

            <div className="profile-location">
              {profileData.lat.toFixed(3)}
              °N&nbsp;&nbsp;

              {profileData.lon.toFixed(3)}
              °E
            </div>

            <Plot
              data={[
                {
                  type:
                    'scatter' as const,

                  mode:
                    'lines+markers' as const,

                  x: profileData.values,

                  y:
                    profileData.depth.map(
                      (d) => -d
                    ),

                  line: {
                    width: 2,
                  },

                  marker: {
                    size: 4,
                  },

                  name: label,
                },

                ...(selectedProfilePoint
                  ? [
                      {
                        type: 'scatter' as const,
                        mode: 'markers+text' as const,
                        x: [selectedProfilePoint.value],
                        y: [-selectedProfilePoint.depth],
                        marker: {
                          size: 9,
                          symbol: 'diamond' as const,
                          line: {
                            width: 2,
                            color: '#ffffff',
                          },
                        },
                        text: ['SLICE'],
                        textposition: 'middle right' as const,
                        name: 'Active Depth Slice',
                      },
                    ]
                  : []),
              ]}

              layout={{
                autosize: true,

                margin: {
                  l: 45,
                  r: 15,
                  t: 10,
                  b: 45,
                },

                paper_bgcolor:
                  'rgba(0,0,0,0)',

                plot_bgcolor:
                  'rgba(0,0,0,0)',

                xaxis: {
                  title:
                    `${label} (${unit})`,

                  gridcolor:
                    'rgba(148,163,184,0.12)',
                },

                shapes: selectedProfilePoint
                  ? [
                      {
                        type: 'line' as const,
                        xref: 'paper' as const,
                        x0: 0,
                        x1: 1,
                        yref: 'y' as const,
                        y0: -selectedProfilePoint.depth,
                        y1: -selectedProfilePoint.depth,
                        line: {
                          width: 1,
                          dash: 'dash' as const,
                        },
                      },
                    ]
                  : [],

                yaxis: {
                  title:
                    'Depth (m)',

                  autorange: 'reversed',

                  gridcolor:
                    'rgba(148,163,184,0.12)',

                  ticktext:
                    profileData.depth.map(
                      (d) =>
                        `${d.toFixed(0)}`
                    ),

                  tickvals:
                    profileData.depth.map(
                      (d) => -d
                    ),
                },

                font: {
                  family:
                    'Inter, Arial, sans-serif',

                  size: 10,

                  color: '#94a3b8',
                },
              }}

              config={{
                responsive: true,
                displaylogo: false,
              }}

              style={{
                width: '100%',
                height: '100%',
              }}

              useResizeHandler
            />

          </div>
        )}

      </div>

    </div>
  );
}

export default VolumeViewer;