/**
 * OCEANLENS - Cesium ocean globe
 *
 * Cleaned for the OceanLens project:
 * - real Copernicus slice rendering
 * - 61 x 61 (1/12°) model grid over the downloaded domain
 * - 10° whole-Earth geographic graticule
 * - real current vectors + animated particles
 * - real point depth profile + Model vs Argo validation
 * - draggable point-analysis overlay
 * - scientific color scale
 *
 * The component intentionally contains no project-specific selection,
 * dashboard, or unrelated UI logic from the source project.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import { Compass, ZoomIn, ZoomOut } from 'lucide-react';

import {
  CurrentVelocitySlice,
  OceanMetadata,
  OceanSlice,
  ProbePoint,
  VisualizationSettings,
} from '../types';

import { interpolateColor } from '../utils/colorMapping';
import {
  probeOceanLocation,
  VARIABLE_CONFIGS,
} from '../utils/oceanCalculations';

interface OceanGlobeProps {
  metadata: OceanMetadata | null;
  slice: OceanSlice | CurrentVelocitySlice | null;
  settings: VisualizationSettings;
  probePoint: ProbePoint | null;
  onProbeLocation: (probe: ProbePoint | null) => void;
  crossSectionCoordinate?: number;
  resetCameraTrigger: number;
  isPlaying: boolean;
}

type PointProfile = {
  lat: number;
  lon: number;
  time: string;
  depth: number[];
  temperature: (number | null)[];
  salinity: (number | null)[];
  speed: (number | null)[];
};

type ArgoComparison = {
  platform: number;
  cycle: number;
  lat: number;
  lon: number;
  time: string;
  distanceKm: number;
  argoTemperature: (number | null)[];
  argoSalinity: (number | null)[];
  maeTemperature: number | null;
  rmseTemperature: number | null;
  pairsTemperature: number;
  maeSalinity: number | null;
  rmseSalinity: number | null;
  pairsSalinity: number;
};

export const pointProfileCache = new Map<string, any>();

/* -------------------------------------------------------------------------- */
/* Globe reference grids                                                      */
/* -------------------------------------------------------------------------- */

function createEarthGraticule(viewer: Cesium.Viewer) {
  const lines = new Cesium.PolylineCollection();

  const altitude = 18;
  const gridColor = Cesium.Color.fromCssColorString(
    'rgba(56,189,248,0.28)'
  );
  const majorColor = Cesium.Color.fromCssColorString(
    'rgba(6,182,212,0.55)'
  );

  for (let lat = -80; lat <= 80; lat += 10) {
    const points: number[] = [];
    for (let lon = -180; lon <= 180; lon += 1) {
      points.push(lon, lat, altitude);
    }

    lines.add({
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(points),
      width: lat === 0 ? 2.2 : 1.3,
      material: Cesium.Material.fromType('Color', {
        color: lat === 0 ? majorColor : gridColor,
      }),
    });
  }

  for (let lon = -180; lon < 180; lon += 10) {
    const points: number[] = [];
    for (let lat = -80; lat <= 80; lat += 1) {
      points.push(lon, lat, altitude);
    }

    lines.add({
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(points),
      width: lon === 0 || lon === -180 ? 2.2 : 1.3,
      material: Cesium.Material.fromType('Color', {
        color:
          lon === 0 || lon === -180 ? majorColor : gridColor,
      }),
    });
  }

  viewer.scene.primitives.add(lines);
  return lines;
}

/**
 * Draw the actual model grid coordinates supplied by the slice.
 * A 61-point coordinate axis produces 60 x 60 model cells at 1/12°.
 */
function createModelGrid(
  viewer: Cesium.Viewer,
  latitude: number[],
  longitude: number[]
) {
  const lines = new Cesium.PolylineCollection();
  const altitude = 85;

  const normal = Cesium.Color.fromCssColorString(
    'rgba(56,189,248,0.18)'
  );
  const major = Cesium.Color.fromCssColorString(
    'rgba(56,189,248,0.45)'
  );

  for (let r = 0; r < latitude.length; r++) {
    const points = [
      longitude[0], latitude[r], altitude,
      longitude[longitude.length - 1], latitude[r], altitude,
    ];

    lines.add({
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(points),
      width: r % 12 === 0 ? 1.6 : 0.95,
      material: Cesium.Material.fromType('Color', {
        color: r % 12 === 0 ? major : normal,
      }),
    });
  }

  for (let c = 0; c < longitude.length; c++) {
    const points = [
      longitude[c], latitude[0], altitude,
      longitude[c], latitude[latitude.length - 1], altitude,
    ];

    lines.add({
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(points),
      width: c % 12 === 0 ? 1.6 : 0.95,
      material: Cesium.Material.fromType('Color', {
        color: c % 12 === 0 ? major : normal,
      }),
    });
  }

  viewer.scene.primitives.add(lines);
  return lines;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export const OceanGlobe: React.FC<OceanGlobeProps> = ({
  metadata,
  slice,
  settings,
  probePoint,
  onProbeLocation,
  crossSectionCoordinate,
  resetCameraTrigger,
  isPlaying,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);

  const earthGridRef =
    useRef<Cesium.PolylineCollection | null>(null);
  const modelGridRef =
    useRef<Cesium.PolylineCollection | null>(null);
  const fieldPrimitiveRef =
    useRef<Cesium.Primitive | null>(null);
  const vectorPrimitiveRef =
    useRef<Cesium.Primitive | null>(null);
  const particlePrimitiveRef =
    useRef<Cesium.Primitive | null>(null);
  const particleFrameRef = useRef<number | null>(null);
  const particleDrawRef =
    useRef<(() => void) | null>(null);
  const probeEntityRef =
    useRef<Cesium.Entity | null>(null);
  const boundaryEntityRef =
    useRef<Cesium.Entity | null>(null);
  const transectEntityRef =
    useRef<Cesium.Entity | null>(null);

  const sliceRef = useRef(slice);
  const settingsRef = useRef(settings);
  const onProbeLocationRef = useRef(onProbeLocation);
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => {
    sliceRef.current = slice;
    settingsRef.current = settings;
    onProbeLocationRef.current = onProbeLocation;
    isPlayingRef.current = isPlaying;
  }, [slice, settings, onProbeLocation, isPlaying]);

  const [mouseCoords, setMouseCoords] =
    useState<{ lat: number; lon: number } | null>(null);

  const [pointProfile, setPointProfile] =
    useState<PointProfile | null>(null);
  const [argoComparison, setArgoComparison] =
    useState<ArgoComparison | null>(null);
  const [pointProfileLoading, setPointProfileLoading] =
    useState(false);
  const [pointProfileError, setPointProfileError] =
    useState<string | null>(null);

  const [analysisPosition, setAnalysisPosition] =
    useState({ x: 24, y: 105 });
  const [analysisAnchor, setAnalysisAnchor] =
    useState<{ x: number; y: number } | null>(null);
  const [draggingAnalysis, setDraggingAnalysis] =
    useState(false);

  const analysisDragRef = useRef({
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  /* ---------------------------------------------------------------------- */
  /* Cesium initialization                                                   */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!containerRef.current) return;

    Cesium.Ion.defaultAccessToken = '';

    const imagery = new Cesium.UrlTemplateImageryProvider({
      url:
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      maximumLevel: 19,
    });

    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayer: new Cesium.ImageryLayer(imagery),
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      creditContainer: document.createElement('div'),
      scene3DOnly: true,
      shouldAnimate: false,
    });

    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    viewer.scene.screenSpaceCameraController.enableCollisionDetection =
      false;

    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        67.5,
        12.5,
        850000
      ),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-40),
        roll: 0,
      },
    });

    earthGridRef.current = createEarthGraticule(viewer);
    viewerRef.current = viewer;

    const handler = new Cesium.ScreenSpaceEventHandler(
      viewer.scene.canvas
    );

    handler.setInputAction(
      (movement: any) => {
        const ray = viewer.camera.getPickRay(
          movement.endPosition
        );
        if (!ray) return;

        const cartesian = viewer.scene.globe.pick(
          ray,
          viewer.scene
        );
        if (!cartesian) return;

        const carto =
          Cesium.Cartographic.fromCartesian(cartesian);

        setMouseCoords({
          lat: Number(
            Cesium.Math.toDegrees(carto.latitude).toFixed(3)
          ),
          lon: Number(
            Cesium.Math.toDegrees(carto.longitude).toFixed(3)
          ),
        });
      },
      Cesium.ScreenSpaceEventType.MOUSE_MOVE
    );

    handler.setInputAction(
      async (click: any) => {
        const ray = viewer.camera.getPickRay(click.position);
        if (!ray) return;

        const cartesian = viewer.scene.globe.pick(
          ray,
          viewer.scene
        );
        const currentSlice = sliceRef.current;
        const currentSettings = settingsRef.current;

        if (!cartesian || !currentSlice) return;

        const carto =
          Cesium.Cartographic.fromCartesian(cartesian);

        const lat = Cesium.Math.toDegrees(carto.latitude);
        const lon = Cesium.Math.toDegrees(carto.longitude);

        const probed = probeOceanLocation(
          lat,
          lon,
          currentSlice,
          currentSettings.variable
        );

        onProbeLocationRef.current(probed);

        const minLat = Math.min(...currentSlice.latitude);
        const maxLat = Math.max(...currentSlice.latitude);
        const minLon = Math.min(...currentSlice.longitude);
        const maxLon = Math.max(...currentSlice.longitude);

        if (
          lat < minLat ||
          lat > maxLat ||
          lon < minLon ||
          lon > maxLon
        ) {
          return;
        }

        setAnalysisAnchor({
          x: click.position.x,
          y: click.position.y,
        });

        setAnalysisPosition({
          x: Math.min(click.position.x + 28, 760),
          y: Math.max(75, click.position.y - 190),
        });

        setPointProfileLoading(true);
        setPointProfileError(null);
        setPointProfile(null);
        setArgoComparison(null);

        const timeIndex = currentSettings.timeIndex;
        const cacheKey =
          `${timeIndex}:${lat.toFixed(3)}:${lon.toFixed(3)}`;

        try {
          let result = pointProfileCache.get(cacheKey);

          if (!result) {
            const response = await fetch(
              `http://127.0.0.1:8000/point-profile?latitude=${encodeURIComponent(
                lat
              )}&longitude=${encodeURIComponent(
                lon
              )}&time_index=${timeIndex}`
            );

            if (!response.ok) {
              throw new Error(
                `Point profile request failed (${response.status})`
              );
            }

            result = await response.json();
            pointProfileCache.set(cacheKey, result);
          }

          const model = result?.model;

          if (!model) {
            throw new Error('Invalid point-profile response');
          }

          setPointProfile({
            lat: Number(model.latitude),
            lon: Number(model.longitude),
            time: String(model.time),
            depth: Array.isArray(model.depth)
              ? model.depth.map(Number)
              : [],
            temperature: Array.isArray(model.temperature)
              ? model.temperature.map((v: any) =>
                  Number.isFinite(Number(v))
                    ? Number(v)
                    : null
                )
              : [],
            salinity: Array.isArray(model.salinity)
              ? model.salinity.map((v: any) =>
                  Number.isFinite(Number(v))
                    ? Number(v)
                    : null
                )
              : [],
            speed: Array.isArray(model.current_speed)
              ? model.current_speed.map((v: any) =>
                  Number.isFinite(Number(v))
                    ? Number(v)
                    : null
                )
              : [],
          });

          const argo = result?.argo;

          if (argo) {
            setArgoComparison({
              platform: Number(argo.platform),
              cycle: Number(argo.cycle),
              lat: Number(argo.latitude),
              lon: Number(argo.longitude),
              time: String(argo.time),
              distanceKm: Number(argo.distance_km),
              argoTemperature:
                Array.isArray(argo.temperature)
                  ? argo.temperature.map((v: any) =>
                      Number.isFinite(Number(v))
                        ? Number(v)
                        : null
                    )
                  : [],
              argoSalinity:
                Array.isArray(argo.salinity)
                  ? argo.salinity.map((v: any) =>
                      Number.isFinite(Number(v))
                        ? Number(v)
                        : null
                    )
                  : [],
              maeTemperature:
                argo.temperature_stats?.mae ?? null,
              rmseTemperature:
                argo.temperature_stats?.rmse ?? null,
              pairsTemperature:
                Number(argo.temperature_stats?.count ?? 0),
              maeSalinity:
                argo.salinity_stats?.mae ?? null,
              rmseSalinity:
                argo.salinity_stats?.rmse ?? null,
              pairsSalinity:
                Number(argo.salinity_stats?.count ?? 0),
            });
          }
        } catch (error) {
          setPointProfileError(
            error instanceof Error
              ? error.message
              : 'Unable to load point profile'
          );
        } finally {
          setPointProfileLoading(false);
        }
      },
      Cesium.ScreenSpaceEventType.LEFT_CLICK
    );

    return () => {
      handler.destroy();

      if (particleFrameRef.current !== null) {
        cancelAnimationFrame(particleFrameRef.current);
      }

      [
        earthGridRef.current,
        modelGridRef.current,
        fieldPrimitiveRef.current,
        vectorPrimitiveRef.current,
        particlePrimitiveRef.current,
      ].forEach((primitive: any) => {
        try {
          if (
            primitive &&
            !viewer.scene.primitives.isDestroyed()
          ) {
            viewer.scene.primitives.remove(primitive);
          }
        } catch {
          // cleanup only
        }
      });

      [probeEntityRef, boundaryEntityRef, transectEntityRef]
        .forEach((ref) => {
          if (ref.current) {
            try {
              viewer.entities.remove(ref.current);
            } catch {
              // cleanup only
            }
            ref.current = null;
          }
        });

      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }

      viewerRef.current = null;
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Grid visibility                                                         */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (modelGridRef.current) {
      viewer.scene.primitives.remove(modelGridRef.current);
      modelGridRef.current = null;
    }

    if (
      settings.showGridLines &&
      slice?.latitude?.length &&
      slice?.longitude?.length
    ) {
      modelGridRef.current = createModelGrid(
        viewer,
        slice.latitude,
        slice.longitude
      );
    }

    if (earthGridRef.current) {
      earthGridRef.current.show = settings.showGridLines;
    }

    viewer.scene.requestRender();
  }, [
    settings.showGridLines,
    slice?.latitude,
    slice?.longitude,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Real model field                                                        */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !slice) return;

    const { latitude, longitude, values } = slice;

    if (
      latitude.length < 2 ||
      longitude.length < 2 ||
      !values.length
    ) {
      return;
    }

    if (fieldPrimitiveRef.current) {
      viewer.scene.primitives.remove(
        fieldPrimitiveRef.current
      );
      fieldPrimitiveRef.current = null;
    }

    const config =
      VARIABLE_CONFIGS[settings.variable];

    let minValue =
      settings.customMin ?? config.defaultMin;
    let maxValue =
      settings.customMax ?? config.defaultMax;

    if (
      settings.customMin === null ||
      settings.customMax === null
    ) {
      let min = Infinity;
      let max = -Infinity;

      for (const row of values) {
        for (const value of row ?? []) {
          if (
            value !== null &&
            value !== undefined &&
            Number.isFinite(value)
          ) {
            min = Math.min(min, value);
            max = Math.max(max, value);
          }
        }
      }

      if (Number.isFinite(min) && Number.isFinite(max)) {
        if (settings.customMin === null) minValue = min;
        if (settings.customMax === null) maxValue = max;
      }
    }

    const range = Math.max(maxValue - minValue, 1e-9);

    const rows = latitude.length;
    const cols = longitude.length;

    const read = (r: number, c: number) => {
      const v = values[r]?.[c];
      return v !== null &&
        v !== undefined &&
        Number.isFinite(v)
        ? Number(v)
        : null;
    };

    const instances: Cesium.GeometryInstance[] = [];

    // 60 x 60 display cells. Colors are sampled from the real
    // 61 x 61 Copernicus field; no values are fabricated.
    const displayRows = Math.min(60, rows - 1);
    const displayCols = Math.min(60, cols - 1);

    for (let r = 0; r < displayRows; r++) {
      const y0 = r / displayRows;
      const y1 = (r + 1) / displayRows;

      const lat0 =
        latitude[0] +
        y0 * (latitude[rows - 1] - latitude[0]);
      const lat1 =
        latitude[0] +
        y1 * (latitude[rows - 1] - latitude[0]);

      for (let c = 0; c < displayCols; c++) {
        const x0 = c / displayCols;
        const x1 = (c + 1) / displayCols;

        const lon0 =
          longitude[0] +
          x0 *
            (longitude[cols - 1] - longitude[0]);
        const lon1 =
          longitude[0] +
          x1 *
            (longitude[cols - 1] - longitude[0]);

        const sourceR = Math.min(
          rows - 1,
          Math.floor(
            y0 * (rows - 1)
          )
        );
        const sourceC = Math.min(
          cols - 1,
          Math.floor(
            x0 * (cols - 1)
          )
        );

        const candidates = [
          read(sourceR, sourceC),
          read(
            Math.min(rows - 1, sourceR + 1),
            sourceC
          ),
          read(
            sourceR,
            Math.min(cols - 1, sourceC + 1)
          ),
          read(
            Math.min(rows - 1, sourceR + 1),
            Math.min(cols - 1, sourceC + 1)
          ),
        ].filter(
          (v): v is number => v !== null
        );

        if (!candidates.length) continue;

        const value =
          candidates.reduce(
            (sum, v) => sum + v,
            0
          ) / candidates.length;

        const normalized = Math.max(
          0,
          Math.min(
            1,
            (value - minValue) / range
          )
        );

        const rgb = interpolateColor(
          normalized,
          settings.palette
        );

        instances.push(
          new Cesium.GeometryInstance({
            geometry: new Cesium.RectangleGeometry({
              rectangle:
                Cesium.Rectangle.fromDegrees(
                  lon0,
                  lat0,
                  lon1,
                  lat1
                ),
              height:
                settings.render3DDepth &&
                (slice.depth ?? 0) > 2
                  ? -(slice.depth ?? 0) *
                    settings.verticalExaggeration
                  : 55,
              vertexFormat:
                Cesium.PerInstanceColorAppearance
                  .VERTEX_FORMAT,
            }),
            attributes: {
              color:
                Cesium.ColorGeometryInstanceAttribute.fromColor(
                  new Cesium.Color(
                    rgb.r / 255,
                    rgb.g / 255,
                    rgb.b / 255,
                    Math.max(
                      0.12,
                      settings.opacity
                    )
                  )
                ),
            },
          })
        );
      }
    }

    if (instances.length) {
      fieldPrimitiveRef.current =
        viewer.scene.primitives.add(
          new Cesium.Primitive({
            geometryInstances: instances,
            appearance:
              new Cesium.PerInstanceColorAppearance({
                flat: true,
                translucent: true,
                renderState: {
                  depthTest: {
                    enabled: false,
                  },
                  blending:
                    Cesium.BlendingState
                      .ALPHA_BLEND,
                },
              }),
            asynchronous: false,
          })
        );
    }

    if (boundaryEntityRef.current) {
      viewer.entities.remove(
        boundaryEntityRef.current
      );
    }

    boundaryEntityRef.current =
      viewer.entities.add({
        id: 'copernicus-model-boundary',
        rectangle: {
          coordinates:
            Cesium.Rectangle.fromDegrees(
              Math.min(...longitude),
              Math.min(...latitude),
              Math.max(...longitude),
              Math.max(...latitude)
            ),
          material: Cesium.Color.TRANSPARENT,
          outline: true,
          outlineColor:
            Cesium.Color.fromCssColorString(
              '#22d3ee'
            ).withAlpha(0.8),
          outlineWidth: 2,
        },
      });

    viewer.scene.requestRender();
  }, [slice, settings]);

  /* ---------------------------------------------------------------------- */
  /* Current vectors + animated particle trails                              */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (particleFrameRef.current !== null) {
      cancelAnimationFrame(
        particleFrameRef.current
      );
      particleFrameRef.current = null;
    }

    if (particlePrimitiveRef.current) {
      viewer.scene.primitives.remove(
        particlePrimitiveRef.current
      );
      particlePrimitiveRef.current = null;
    }

    if (vectorPrimitiveRef.current) {
      viewer.scene.primitives.remove(
        vectorPrimitiveRef.current
      );
      vectorPrimitiveRef.current = null;
    }

    particleDrawRef.current = null;

    if (
      settings.variable !== 'currents' ||
      !slice ||
      !('uoValues' in slice) ||
      !('voValues' in slice)
    ) {
      viewer.scene.requestRender();
      return;
    }

    const uGrid = slice.uoValues;
    const vGrid = slice.voValues;
    const rows = slice.latitude.length;
    const cols = slice.longitude.length;

    if (rows < 3 || cols < 3) return;

    const lat0 = slice.latitude[0];
    const lat1 =
      slice.latitude[rows - 1];
    const lon0 = slice.longitude[0];
    const lon1 =
      slice.longitude[cols - 1];

    const sample = (
      x: number,
      y: number
    ): [number, number, number] => {
      const x0 = Math.max(
        0,
        Math.min(cols - 1, Math.floor(x))
      );
      const x1 = Math.max(
        0,
        Math.min(cols - 1, x0 + 1)
      );
      const y0 = Math.max(
        0,
        Math.min(rows - 1, Math.floor(y))
      );
      const y1 = Math.max(
        0,
        Math.min(rows - 1, y0 + 1)
      );

      const tx = x - x0;
      const ty = y - y0;

      const bilinear = (
        grid: (number | null)[][]
      ) => {
        const a = grid[y0]?.[x0];
        const b = grid[y0]?.[x1];
        const c = grid[y1]?.[x0];
        const d = grid[y1]?.[x1];

        if (
          [a, b, c, d].some(
            (v) =>
              v === null ||
              v === undefined ||
              !Number.isFinite(v)
          )
        ) {
          return null;
        }

        return (
          (a as number) * (1 - tx) * (1 - ty) +
          (b as number) * tx * (1 - ty) +
          (c as number) * (1 - tx) * ty +
          (d as number) * tx * ty
        );
      };

      const u = bilinear(uGrid);
      const v = bilinear(vGrid);

      if (u === null || v === null) {
        return [0, 0, 0];
      }

      return [
        u,
        v,
        Math.hypot(u, v),
      ];
    };

    /* Direction arrows */
    if (settings.showVectors) {
      const arrowInstances: Cesium.GeometryInstance[] = [];

      const stepX = Math.max(
        3,
        Math.floor(cols / 15)
      );
      const stepY = Math.max(
        3,
        Math.floor(rows / 15)
      );

      for (
        let y = 2;
        y < rows - 1;
        y += stepY
      ) {
        for (
          let x = 2;
          x < cols - 1;
          x += stepX
        ) {
          const [u, v, speed] = sample(x, y);

          if (speed < 0.02) continue;

          const lat =
            lat0 +
            (y / (rows - 1)) *
              (lat1 - lat0);
          const lon =
            lon0 +
            (x / (cols - 1)) *
              (lon1 - lon0);

          const angle = Math.atan2(v, u);
          const lengthDeg = Math.min(
            0.30,
            0.07 + speed * 0.22
          );

          const cosLat = Math.max(
            0.25,
            Math.cos(
              Cesium.Math.toRadians(lat)
            )
          );

          const endLon =
            lon +
            (Math.cos(angle) *
              lengthDeg) /
              cosLat;
          const endLat =
            lat +
            Math.sin(angle) *
              lengthDeg;

          const head =
            lengthDeg * 0.32;

          const wingAngle =
            Cesium.Math.toRadians(32);

          const wing1Lon =
            endLon +
            (Math.cos(
              angle +
                Math.PI -
                wingAngle
            ) *
              head) /
              cosLat;

          const wing1Lat =
            endLat +
            Math.sin(
              angle +
                Math.PI -
                wingAngle
            ) *
              head;

          const wing2Lon =
            endLon +
            (Math.cos(
              angle +
                Math.PI +
                wingAngle
            ) *
              head) /
              cosLat;

          const wing2Lat =
            endLat +
            Math.sin(
              angle +
                Math.PI +
                wingAngle
            ) *
              head;

          const addLine = (
            aLon: number,
            aLat: number,
            bLon: number,
            bLat: number
          ) => {
            arrowInstances.push(
              new Cesium.GeometryInstance({
                geometry:
                  new Cesium.PolylineGeometry({
                    positions:
                      Cesium.Cartesian3.fromDegreesArrayHeights(
                        [
                          aLon,
                          aLat,
                          120,
                          bLon,
                          bLat,
                          120,
                        ]
                      ),
                    width: 4,
                    vertexFormat:
                      Cesium.PolylineColorAppearance
                        .VERTEX_FORMAT,
                  }),
                attributes: {
                  color:
                    Cesium.ColorGeometryInstanceAttribute.fromColor(
                      Cesium.Color.WHITE.withAlpha(
                        0.95
                      )
                    ),
                },
              })
            );
          };

          addLine(
            lon,
            lat,
            endLon,
            endLat
          );
          addLine(
            endLon,
            endLat,
            wing1Lon,
            wing1Lat
          );
          addLine(
            endLon,
            endLat,
            wing2Lon,
            wing2Lat
          );
        }
      }

      if (arrowInstances.length) {
        vectorPrimitiveRef.current =
          viewer.scene.primitives.add(
            new Cesium.Primitive({
              geometryInstances:
                arrowInstances,
              appearance:
                new Cesium.PolylineColorAppearance({
                  translucent: true,
                }),
              asynchronous: false,
            })
          );
      }
    }

    /* Particles */
    type Particle = {
      x: number;
      y: number;
      age: number;
      maxAge: number;
      path: number[];
    };

    const PARTICLE_COUNT = 260;
    const MAX_AGE = 70;
    const SPEED_SCALE = 0.032;

    const particles: Particle[] =
      Array.from(
        { length: PARTICLE_COUNT },
        () => ({
          x:
            1 +
            Math.random() *
              (cols - 3),
          y:
            1 +
            Math.random() *
              (rows - 3),
          age:
            Math.floor(
              Math.random() *
                MAX_AGE
            ),
          maxAge: MAX_AGE,
          path: [],
        })
      );

    const resetParticle = (
      p: Particle
    ) => {
      p.x =
        1 +
        Math.random() *
          (cols - 3);
      p.y =
        1 +
        Math.random() *
          (rows - 3);
      p.age = p.maxAge;
      p.path = [p.x, p.y];
    };

    particles.forEach(
      (p) => {
        if (p.age <= 0)
          resetParticle(p);
      }
    );

    const draw = () => {
      const instances: Cesium.GeometryInstance[] = [];

      for (const particle of particles) {
        if (particle.age <= 0) {
          resetParticle(particle);
        }

        const [u, v, speed] =
          sample(
            particle.x,
            particle.y
          );

        if (speed < 0.015) {
          particle.age = 0;
          continue;
        }

        const midLat =
          lat0 +
          (particle.y /
            (rows - 1)) *
            (lat1 - lat0);

        const cosLat =
          Math.max(
            0.25,
            Math.cos(
              Cesium.Math.toRadians(
                midLat
              )
            )
          );

        const dLon =
          (u * SPEED_SCALE) /
          cosLat;

        const dLat =
          v * SPEED_SCALE;

        let nextX =
          particle.x +
          (dLon /
            (lon1 - lon0 || 1)) *
            (cols - 1);

        let nextY =
          particle.y +
          (dLat /
            (lat1 - lat0 || 1)) *
            (rows - 1);

        if (
          nextX < 1 ||
          nextX > cols - 2 ||
          nextY < 1 ||
          nextY > rows - 2
        ) {
          resetParticle(particle);
          continue;
        }

        particle.x = nextX;
        particle.y = nextY;

        particle.path.push(
          nextX,
          nextY
        );

        if (
          particle.path.length >
          16
        ) {
          particle.path.splice(
            0,
            2
          );
        }

        const positions: number[] =
          [];

        for (
          let i = 0;
          i < particle.path.length;
          i += 2
        ) {
          const gx =
            particle.path[i];
          const gy =
            particle.path[i + 1];

          const lon =
            lon0 +
            (gx /
              (cols - 1)) *
              (lon1 - lon0);

          const lat =
            lat0 +
            (gy /
              (rows - 1)) *
              (lat1 - lat0);

          positions.push(
            lon,
            lat,
            145
          );
        }

        if (positions.length >= 6) {
          const alpha =
            Math.min(
              0.75,
              0.15 +
                (particle.age /
                  particle.maxAge) *
                  0.60
            );

          instances.push(
            new Cesium.GeometryInstance({
              geometry:
                new Cesium.PolylineGeometry({
                  positions:
                    Cesium.Cartesian3.fromDegreesArrayHeights(
                      positions
                    ),
                  width: 1.5,
                  vertexFormat:
                    Cesium.PolylineColorAppearance
                      .VERTEX_FORMAT,
                }),
              attributes: {
                color:
                  Cesium.ColorGeometryInstanceAttribute.fromColor(
                    Cesium.Color.WHITE.withAlpha(
                      alpha
                    )
                  ),
              },
            })
          );
        }

        particle.age--;
      }

      if (
        particlePrimitiveRef.current
      ) {
        viewer.scene.primitives.remove(
          particlePrimitiveRef.current
        );
      }

      if (instances.length) {
        particlePrimitiveRef.current =
          viewer.scene.primitives.add(
            new Cesium.Primitive({
              geometryInstances:
                instances,
              appearance:
                new Cesium.PolylineColorAppearance({
                  translucent: true,
                }),
              asynchronous: false,
            })
          );
      }

      viewer.scene.requestRender();

      if (isPlayingRef.current) {
        particleFrameRef.current =
          requestAnimationFrame(
            () => {
              particleFrameRef.current =
                null;
              draw();
            }
          );
      }
    };

    particleDrawRef.current = draw;
    draw();

    return () => {
      if (
        particleFrameRef.current !==
        null
      ) {
        cancelAnimationFrame(
          particleFrameRef.current
        );
        particleFrameRef.current =
          null;
      }

      particleDrawRef.current = null;

      if (
        particlePrimitiveRef.current
      ) {
        viewer.scene.primitives.remove(
          particlePrimitiveRef.current
        );
        particlePrimitiveRef.current =
          null;
      }

      if (
        vectorPrimitiveRef.current
      ) {
        viewer.scene.primitives.remove(
          vectorPrimitiveRef.current
        );
        vectorPrimitiveRef.current =
          null;
      }
    };
  }, [
    slice,
    settings.variable,
    settings.showVectors,
  ]);

  /* Start/stop particle animation without rebuilding it. */
  useEffect(() => {
    if (!isPlaying) {
      if (particleFrameRef.current !== null) {
        cancelAnimationFrame(
          particleFrameRef.current
        );
        particleFrameRef.current = null;
      }
      return;
    }

    if (
      particleDrawRef.current &&
      particleFrameRef.current === null
    ) {
      particleFrameRef.current =
        requestAnimationFrame(() => {
          particleFrameRef.current =
            null;
          particleDrawRef.current?.();
        });
    }
  }, [isPlaying]);

  /* ---------------------------------------------------------------------- */
  /* Probe marker                                                            */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (probeEntityRef.current) {
      viewer.entities.remove(
        probeEntityRef.current
      );
      probeEntityRef.current = null;
    }

    if (!probePoint) return;

    probeEntityRef.current =
      viewer.entities.add({
        id: 'ocean-probe-marker',
        position:
          Cesium.Cartesian3.fromDegrees(
            probePoint.longitude,
            probePoint.latitude,
            160
          ),
        point: {
          pixelSize: 11,
          color:
            Cesium.Color.fromCssColorString(
              '#22d3ee'
            ),
          outlineColor:
            Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance:
            Number.POSITIVE_INFINITY,
        },
        label: {
          text:
            probePoint.value !== null
              ? `${probePoint.value.toFixed(3)} ${probePoint.unit}`
              : 'Probe',
          font: '11px monospace',
          style:
            Cesium.LabelStyle
              .FILL_AND_OUTLINE,
          fillColor:
            Cesium.Color.WHITE,
          outlineColor:
            Cesium.Color.BLACK,
          outlineWidth: 2,
          verticalOrigin:
            Cesium.VerticalOrigin
              .BOTTOM,
          pixelOffset:
            new Cesium.Cartesian2(
              0,
              -12
            ),
          disableDepthTestDistance:
            Number.POSITIVE_INFINITY,
        },
      });

    viewer.scene.requestRender();
  }, [probePoint]);

  /* ---------------------------------------------------------------------- */
  /* Cross-section line                                                       */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (transectEntityRef.current) {
      viewer.entities.remove(
        transectEntityRef.current
      );
      transectEntityRef.current = null;
    }

    if (
      !settings.crossSectionMode ||
      crossSectionCoordinate === undefined
    ) {
      return;
    }

    const positions =
      settings.crossSectionType ===
      'latitudinal'
        ? [
            Cesium.Cartesian3.fromDegrees(
              65,
              crossSectionCoordinate,
              180
            ),
            Cesium.Cartesian3.fromDegrees(
              70,
              crossSectionCoordinate,
              180
            ),
          ]
        : [
            Cesium.Cartesian3.fromDegrees(
              crossSectionCoordinate,
              10,
              180
            ),
            Cesium.Cartesian3.fromDegrees(
              crossSectionCoordinate,
              15,
              180
            ),
          ];

    transectEntityRef.current =
      viewer.entities.add({
        id: 'ocean-transect-line',
        polyline: {
          positions,
          width: 3,
          material:
            new Cesium.PolylineGlowMaterialProperty(
              {
                glowPower: 0.25,
                color:
                  Cesium.Color.fromCssColorString(
                    '#f59e0b'
                  ),
              }
            ),
        },
      });
  }, [
    settings.crossSectionMode,
    settings.crossSectionType,
    crossSectionCoordinate,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Camera                                                                  */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const viewer = viewerRef.current;
    if (
      !viewer ||
      viewer.isDestroyed() ||
      resetCameraTrigger <= 0
    ) {
      return;
    }

    viewer.camera.flyTo({
      destination:
        Cesium.Cartesian3.fromDegrees(
          67.5,
          12.5,
          850000
        ),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(
          -40
        ),
        roll: 0,
      },
      duration: 1.2,
    });
  }, [resetCameraTrigger]);

  const closeAnalysis = () => {
    setPointProfile(null);
    setArgoComparison(null);
    setPointProfileError(null);
    setPointProfileLoading(false);
    setAnalysisAnchor(null);
  };

  const handleZoomIn = () => {
    viewerRef.current?.camera.zoomIn(
      300000
    );
  };

  const handleZoomOut = () => {
    viewerRef.current?.camera.zoomOut(
      300000
    );
  };

  /* ---------------------------------------------------------------------- */
  /* Render                                                                  */
  /* ---------------------------------------------------------------------- */

  const scaleValues = slice?.values
    ?.flat()
    .filter(
      (v): v is number =>
        v !== null &&
        v !== undefined &&
        Number.isFinite(v)
    ) ?? [];

  const scaleMin =
    scaleValues.length
      ? settings.customMin ??
        Math.min(...scaleValues)
      : null;

  const scaleMax =
    scaleValues.length
      ? settings.customMax ??
        Math.max(...scaleValues)
      : null;

  return (
    <div
      id="ocean-globe-container"
      className="relative flex-1 w-full h-full overflow-hidden bg-slate-950"
    >
      <div
        ref={containerRef}
        className="w-full h-full"
      />

      {/* Scientific color scale */}
      {slice &&
        settings.variable !== 'currents' &&
        scaleMin !== null &&
        scaleMax !== null && (
          <div className="absolute top-3 left-3 z-40 w-[220px] rounded-lg border border-slate-700/80 bg-slate-950/95 px-3 py-2 shadow-xl backdrop-blur-md pointer-events-none">
            <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-300">
              <span>
                {VARIABLE_CONFIGS[
                  settings.variable
                ].name}
              </span>
              <span className="font-mono text-cyan-300">
                {VARIABLE_CONFIGS[
                  settings.variable
                ].unit}
              </span>
            </div>

            <div
              className="mt-1.5 h-2 rounded-sm"
              style={{
                background:
                  'linear-gradient(90deg,#313695 0%,#4575b4 15%,#74add1 30%,#abd9e9 40%,#ffffbf 55%,#fdae61 70%,#f46d43 85%,#d73027 100%)',
              }}
            />

            <div className="mt-1 flex justify-between text-[8px] font-mono text-slate-400">
              <span>
                {scaleMin.toFixed(2)}
              </span>
              <span>
                {scaleMax.toFixed(2)}
              </span>
            </div>
          </div>
        )}

      {/* Active depth */}
      <div className="absolute top-[68px] left-3 z-40 rounded-lg border border-cyan-900/70 bg-slate-950/90 px-3 py-2 shadow-lg backdrop-blur-md pointer-events-none">
        <div className="text-[9px] uppercase font-bold tracking-wider text-slate-400">
          Active Subsurface Depth
        </div>
        <div className="text-xs font-mono font-bold text-cyan-300">
          {slice?.depth !== undefined
            ? `${slice.depth.toFixed(1)} m`
            : '—'}
        </div>
      </div>

      {/* Point-analysis connector */}
      {analysisAnchor &&
        (pointProfileLoading ||
          pointProfile ||
          pointProfileError) && (
          <svg
            className="absolute inset-0 z-30 pointer-events-none"
            width="100%"
            height="100%"
          >
            <line
              x1={analysisAnchor.x}
              y1={analysisAnchor.y}
              x2={analysisPosition.x}
              y2={analysisPosition.y}
              stroke="rgba(34,211,238,0.9)"
              strokeWidth="2"
              strokeDasharray="6 4"
            />
            <circle
              cx={analysisAnchor.x}
              cy={analysisAnchor.y}
              r="5"
              fill="#22d3ee"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          </svg>
        )}

      {/* Draggable point analysis */}
      {(pointProfileLoading ||
        pointProfile ||
        pointProfileError) && (
        <div
          className="absolute z-50 w-[430px] max-w-[calc(100%-1.5rem)] rounded-xl border border-cyan-800/70 bg-slate-950/96 p-4 shadow-2xl backdrop-blur-xl"
          style={{
            left: `${analysisPosition.x}px`,
            top: `${analysisPosition.y}px`,
          }}
        >
          <div
            className="flex items-start justify-between gap-3 cursor-move select-none"
            onPointerDown={(e) => {
              if (
                (e.target as HTMLElement).closest(
                  'button'
                )
              ) {
                return;
              }

              analysisDragRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                originX:
                  analysisPosition.x,
                originY:
                  analysisPosition.y,
              };

              setDraggingAnalysis(true);
              (
                e.currentTarget as HTMLElement
              ).setPointerCapture?.(
                e.pointerId
              );
            }}
            onPointerMove={(e) => {
              if (!draggingAnalysis) return;

              const dx =
                e.clientX -
                analysisDragRef.current
                  .startX;
              const dy =
                e.clientY -
                analysisDragRef.current
                  .startY;

              setAnalysisPosition({
                x: Math.max(
                  8,
                  analysisDragRef.current
                    .originX + dx
                ),
                y: Math.max(
                  60,
                  analysisDragRef.current
                    .originY + dy
                ),
              });
            }}
            onPointerUp={() =>
              setDraggingAnalysis(false)
            }
            onPointerCancel={() =>
              setDraggingAnalysis(false)
            }
          >
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-cyan-400">
                Point Analysis
              </div>
              <div className="text-sm font-extrabold text-white">
                Model vs Observation
              </div>
              {pointProfile && (
                <div className="mt-1 text-[9px] font-mono text-slate-400">
                  {pointProfile.lat.toFixed(3)}°N ·{' '}
                  {pointProfile.lon.toFixed(3)}°E ·{' '}
                  {pointProfile.time}
                </div>
              )}
            </div>

            <button
              onClick={closeAnalysis}
              className="rounded border border-slate-700 px-2 py-1 text-[9px] text-slate-400 hover:text-white"
            >
              CLOSE
            </button>
          </div>

          {pointProfileLoading && (
            <div className="py-10 text-center text-xs text-slate-400">
              Loading real model and Argo data…
            </div>
          )}

          {pointProfileError && (
            <div className="py-6 text-center text-xs text-red-300">
              {pointProfileError}
            </div>
          )}

          {pointProfile && (
            <div className="mt-3 space-y-2.5">
              {(
                [
                  [
                    'temperature',
                    'SEA TEMPERATURE',
                    '°C',
                  ],
                  [
                    'salinity',
                    'SALINITY',
                    'PSU',
                  ],
                  [
                    'speed',
                    'CURRENT SPEED',
                    'm/s',
                  ],
                ] as const
              ).map(
                ([field, title, unit]) => {
                  const model =
                    pointProfile[field];

                  const observation =
                    field ===
                    'temperature'
                      ? argoComparison?.argoTemperature
                      : field === 'salinity'
                        ? argoComparison?.argoSalinity
                        : null;

                  const values = pointProfile.depth
                    .map((depth, i) => ({
                      depth,
                      model: model[i],
                      observation:
                        observation?.[i] ??
                        null,
                    }))
                    .filter(
                      (p) =>
                        p.model !== null &&
                        Number.isFinite(
                          p.model
                        )
                    );

                  if (values.length < 2) {
                    return null;
                  }

                  const all = values.flatMap(
                    (p) =>
                      [
                        p.model,
                        p.observation,
                      ].filter(
                        (
                          v
                        ): v is number =>
                          v !== null &&
                          Number.isFinite(v)
                      )
                  );

                  const min =
                    Math.min(...all);
                  const max =
                    Math.max(...all);
                  const span =
                    Math.max(
                      max - min,
                      1e-9
                    );

                  const depthMin =
                    Math.min(
                      ...pointProfile.depth
                    );
                  const depthMax =
                    Math.max(
                      ...pointProfile.depth
                    );
                  const depthSpan =
                    Math.max(
                      depthMax -
                        depthMin,
                      1
                    );

                  const toPoints = (
                    key:
                      | 'model'
                      | 'observation'
                  ) =>
                    values
                      .filter(
                        (p) =>
                          p[key] !==
                            null &&
                          Number.isFinite(
                            p[key]
                          )
                      )
                      .map((p) => {
                        const x =
                          42 +
                          (((p[key] as number) -
                            min) /
                            span) *
                            330;
                        const y =
                          10 +
                          ((p.depth -
                            depthMin) /
                            depthSpan) *
                            105;
                        return `${x},${y}`;
                      })
                      .join(' ');

                  return (
                    <div
                      key={field}
                      className="rounded-lg border border-slate-800 bg-slate-900/70 p-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex gap-3 text-[9px] font-bold tracking-wider text-slate-300">
                          <span>
                            {title}
                          </span>
                          {observation && (
                            <span className="font-normal text-slate-500">
                              <span className="text-cyan-300">
                                ━
                              </span>{' '}
                              MODEL{' '}
                              <span className="text-orange-300">
                                - -
                              </span>{' '}
                              ARGO
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] font-mono text-cyan-300">
                          {unit}
                        </span>
                      </div>

                      <svg
                        viewBox="0 0 390 130"
                        className="mt-1 h-28 w-full"
                      >
                        <line
                          x1="42"
                          y1="10"
                          x2="42"
                          y2="115"
                          stroke="rgba(148,163,184,.25)"
                        />
                        <line
                          x1="42"
                          y1="115"
                          x2="372"
                          y2="115"
                          stroke="rgba(148,163,184,.25)"
                        />

                        <polyline
                          points={toPoints(
                            'model'
                          )}
                          fill="none"
                          stroke="#22d3ee"
                          strokeWidth="2.3"
                        />

                        {observation && (
                          <polyline
                            points={toPoints(
                              'observation'
                            )}
                            fill="none"
                            stroke="#fb923c"
                            strokeWidth="2.3"
                            strokeDasharray="6 4"
                          />
                        )}

                        <text
                          x="44"
                          y="127"
                          fill="#64748b"
                          fontSize="8"
                        >
                          {min.toFixed(2)}
                        </text>

                        <text
                          x="325"
                          y="127"
                          fill="#64748b"
                          fontSize="8"
                        >
                          {max.toFixed(2)}
                        </text>

                        <text
                          x="2"
                          y="17"
                          fill="#64748b"
                          fontSize="8"
                        >
                          {depthMin.toFixed(
                            0
                          )}
                          m
                        </text>

                        <text
                          x="0"
                          y="114"
                          fill="#64748b"
                          fontSize="8"
                        >
                          {depthMax.toFixed(
                            0
                          )}
                          m
                        </text>
                      </svg>
                    </div>
                  );
                }
              )}

              {argoComparison && (
                <div className="rounded-lg border border-cyan-900/60 bg-cyan-950/10 p-3">
                  <div className="text-[10px] font-bold tracking-wider text-cyan-300">
                    MODEL vs ARGO VALIDATION
                  </div>

                  <div className="mt-1 text-[8px] font-mono text-slate-500">
                    FLOAT{' '}
                    {argoComparison.platform} ·
                    CYCLE{' '}
                    {argoComparison.cycle}
                    {' · '}
                    {argoComparison.lat.toFixed(
                      3
                    )}
                    °N ·{' '}
                    {argoComparison.lon.toFixed(
                      3
                    )}
                    °E ·{' '}
                    {argoComparison.distanceKm.toFixed(
                      1
                    )}
                    km from model grid
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded border border-slate-800 bg-slate-950/70 p-2">
                      <div className="text-[8px] text-slate-500">
                        TEMPERATURE
                      </div>
                      <div className="mt-1 text-[9px] text-white">
                        MAE{' '}
                        <b>
                          {argoComparison.maeTemperature ===
                          null
                            ? '—'
                            : argoComparison.maeTemperature.toFixed(
                                3
                              )}{' '}
                          °C
                        </b>
                        {' · '}
                        RMSE{' '}
                        <b>
                          {argoComparison.rmseTemperature ===
                          null
                            ? '—'
                            : argoComparison.rmseTemperature.toFixed(
                                3
                              )}{' '}
                          °C
                        </b>
                      </div>
                      <div className="mt-1 text-[8px] text-slate-600">
                        {
                          argoComparison.pairsTemperature
                        }{' '}
                        matched depths
                      </div>
                    </div>

                    <div className="rounded border border-slate-800 bg-slate-950/70 p-2">
                      <div className="text-[8px] text-slate-500">
                        SALINITY
                      </div>
                      <div className="mt-1 text-[9px] text-white">
                        MAE{' '}
                        <b>
                          {argoComparison.maeSalinity ===
                          null
                            ? '—'
                            : argoComparison.maeSalinity.toFixed(
                                3
                              )}{' '}
                          PSU
                        </b>
                        {' · '}
                        RMSE{' '}
                        <b>
                          {argoComparison.rmseSalinity ===
                          null
                            ? '—'
                            : argoComparison.rmseSalinity.toFixed(
                                3
                              )}{' '}
                          PSU
                        </b>
                      </div>
                      <div className="mt-1 text-[8px] text-slate-600">
                        {
                          argoComparison.pairsSalinity
                        }{' '}
                        matched depths
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-[8px] leading-4 text-slate-600">
                    Model:{' '}
                    {pointProfile.time}
                    <br />
                    Argo:{' '}
                    {argoComparison.time}
                    <br />
                    Real Argo observations are compared against the
                    real Copernicus model column at the model depth
                    levels.
                  </div>
                </div>
              )}

              {!argoComparison && (
                <div className="border-t border-slate-800 pt-2 text-[8px] text-slate-600">
                  No suitable real Argo profile was found for this
                  clicked model location/time.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Coordinate readout */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-3 rounded-md border border-slate-800 bg-slate-950/90 px-3 py-1.5 text-[10px] font-mono text-slate-300 shadow-lg pointer-events-none">
        <span className="flex items-center gap-1.5 text-cyan-300">
          <Compass className="h-3.5 w-3.5" />
          Arabian Sea
        </span>
        <span>
          Lat:{' '}
          <b className="text-white">
            {mouseCoords
              ? `${mouseCoords.lat}°N`
              : '—'}
          </b>
        </span>
        <span>
          Lon:{' '}
          <b className="text-white">
            {mouseCoords
              ? `${mouseCoords.lon}°E`
              : '—'}
          </b>
        </span>
        <span>
          Depth:{' '}
          <b className="text-cyan-300">
            {slice?.depth !== undefined
              ? `${slice.depth.toFixed(1)}m`
              : '—'}
          </b>
        </span>
      </div>

      {/* Zoom */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1 rounded-md border border-slate-800 bg-slate-950/90 p-1 shadow-lg">
        <button
          onClick={handleZoomIn}
          className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
      </div>

      {settings.showGridLines && (
        <div className="absolute top-[115px] left-3 z-20 rounded border border-cyan-900/70 bg-slate-950/90 px-2.5 py-1.5 text-[8px] font-mono text-slate-400 shadow-lg pointer-events-none">
          <span className="text-cyan-300">
            COPERNICUS GRID
          </span>
          <span className="mx-1.5">•</span>
          61 × 61
          <span className="mx-1.5">•</span>
          1/12°
        </div>
      )}
    </div>
  );
};
