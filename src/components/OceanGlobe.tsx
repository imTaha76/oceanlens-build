/**
 * OCEANLENS - Interactive 3D Geospatial Ocean Globe (CesiumJS)
 * Visualizes real Copernicus ocean model data in the Arabian Sea
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import {
  Compass,
  Layers,
  MapPin,
  Maximize2,
  Navigation,
  RefreshCw,
  Sparkles,
  Waves,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  CurrentVelocitySlice,
  OceanMetadata,
  OceanSlice,
  ProbePoint,
  SelectedGridCell,
  VisualizationSettings,
} from '../types';
import { interpolateColor } from '../utils/colorMapping';
import {
  getCopernicusModelCell,
} from '../services/copernicusModelEngine';
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
  selectedGridCell: SelectedGridCell | null;
  onSelectGridCell: (cell: SelectedGridCell | null) => void;
  crossSectionCoordinate?: number;
  resetCameraTrigger: number;
}

/**
 * Constructs exactly ONE authoritative WGS84 Geographic Graticule for the 3D Globe.
 * - Spacing: 10° latitude x 10° longitude.
 * - Single, smooth, curved naturally over the spherical Earth.
 * - Uniform surface altitude (12m) tightly hugging the WGS84 ellipsoid surface.
 * - 0.25° sampling along arcs maintains < 15m sagitta to prevent lines from diving or floating.
 * - Subtle cyan/blue lines with moderate transparency for clean scientific reference.
 * - Created once and reused across all re-renders; toggles via .show in O(1).
 */
function createEarthGraticule(viewer: Cesium.Viewer): Cesium.PolylineCollection {
  const polylines = new Cesium.PolylineCollection();

  const SURFACE_ALTITUDE = 12.0;
  const gridColor = Cesium.Color.fromCssColorString('rgba(56, 189, 248, 0.35)');
  const majorColor = Cesium.Color.fromCssColorString('rgba(6, 182, 212, 0.65)');

  // 1. Parallels (Circles of Latitude): Every 10° from -80° to +80°
  for (let lat = -80; lat <= 80; lat += 10) {
    const isEquator = lat === 0;
    const pts: number[] = [];
    for (let lon = -180; lon <= 180; lon += 0.25) {
      pts.push(lon, lat, SURFACE_ALTITUDE);
    }
    polylines.add({
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(pts),
      width: isEquator ? 1.4 : 1.0,
      material: Cesium.Material.fromType('Color', {
        color: isEquator ? majorColor : gridColor,
      }),
    });
  }

  // 2. Meridians (Lines of Longitude): Every 10° from -180° to 170°
  for (let lon = -180; lon < 180; lon += 10) {
    const isPrimeOrAnti = lon === 0 || lon === -180;
    const pts: number[] = [];
    for (let lat = -80; lat <= 80; lat += 0.25) {
      pts.push(lon, lat, SURFACE_ALTITUDE);
    }
    polylines.add({
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(pts),
      width: isPrimeOrAnti ? 1.4 : 1.0,
      material: Cesium.Material.fromType('Color', {
        color: isPrimeOrAnti ? majorColor : gridColor,
      }),
    });
  }

  viewer.scene.primitives.add(polylines);
  return polylines;
}

/**
 * Constructs the 61 x 61 Copernicus Model Grid on the Arabian Sea region
 * Longitude: 65°E to 70°E (61 points)
 * Latitude: 10°N to 15°N (61 points)
 */
function createCopernicusModelGrid(viewer: Cesium.Viewer): Cesium.PolylineCollection {
  const polylines = new Cesium.PolylineCollection();
  const ALTITUDE = 24.0;

  const cellLineColor = Cesium.Color.fromCssColorString('rgba(56, 189, 248, 0.22)');
  const majorLineColor = Cesium.Color.fromCssColorString('rgba(56, 189, 248, 0.65)');
  const boundaryColor = Cesium.Color.fromCssColorString('rgba(251, 191, 36, 0.85)');

  // Parallels (61 lines along latitude)
  for (let r = 0; r <= 60; r++) {
    const lat = 10.0 + (r / 60) * 5.0;
    const isBoundary = r === 0 || r === 60;
    const isMajor = r % 12 === 0; // Every 1°

    const pts = [65.0, lat, ALTITUDE, 70.0, lat, ALTITUDE];
    polylines.add({
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(pts),
      width: isBoundary ? 2.0 : isMajor ? 1.4 : 0.8,
      material: Cesium.Material.fromType('Color', {
        color: isBoundary ? boundaryColor : isMajor ? majorLineColor : cellLineColor,
      }),
    });
  }

  // Meridians (61 lines along longitude)
  for (let c = 0; c <= 60; c++) {
    const lon = 65.0 + (c / 60) * 5.0;
    const isBoundary = c === 0 || c === 60;
    const isMajor = c % 12 === 0; // Every 1°

    const pts = [lon, 10.0, ALTITUDE, lon, 15.0, ALTITUDE];
    polylines.add({
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(pts),
      width: isBoundary ? 2.0 : isMajor ? 1.4 : 0.8,
      material: Cesium.Material.fromType('Color', {
        color: isBoundary ? boundaryColor : isMajor ? majorLineColor : cellLineColor,
      }),
    });
  }

  viewer.scene.primitives.add(polylines);
  return polylines;
}

export const OceanGlobe: React.FC<OceanGlobeProps> = ({
  metadata,
  slice,
  settings,
  probePoint,
  onProbeLocation,
  selectedGridCell,
  onSelectGridCell,
  crossSectionCoordinate,
  resetCameraTrigger,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const oceanGridPrimitiveRef = useRef<Cesium.Primitive | null>(null);
  const vectorPolylineCollectionRef = useRef<Cesium.PolylineCollection | null>(null);
  const depthPillarEntitiesRef = useRef<Cesium.Entity[]>([]);
  const gridPolylinesRef = useRef<Cesium.PolylineCollection | null>(null);
  const copernicusModelGridRef = useRef<Cesium.PolylineCollection | null>(null);
  const hoverCellEntityRef = useRef<Cesium.Entity | null>(null);
  const selectedCellEntityRef = useRef<Cesium.Entity | null>(null);
  const probeMarkerEntityRef = useRef<Cesium.Entity | null>(null);
  const transectLineEntityRef = useRef<Cesium.Entity | null>(null);

  const sliceRef = useRef(slice);
  sliceRef.current = slice;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onProbeLocationRef = useRef(onProbeLocation);
  onProbeLocationRef.current = onProbeLocation;
  const onSelectGridCellRef = useRef(onSelectGridCell);
  onSelectGridCellRef.current = onSelectGridCell;

  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [hoveredCell, setHoveredCell] = useState<SelectedGridCell | null>(null);
  const [mouseScreenPos, setMouseScreenPos] = useState<{ x: number; y: number } | null>(null);

  // Initialize Cesium Globe
  useEffect(() => {
    if (!containerRef.current) return;

    // Prevent Cesium Ion token warnings
    Cesium.Ion.defaultAccessToken = '';

    // Create imagery provider for satellite base
    const baseImagery = new Cesium.UrlTemplateImageryProvider({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      maximumLevel: 19,
    });

    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayer: new Cesium.ImageryLayer(baseImagery),
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
      creditContainer: document.createElement('div'), // uncluttered viewport
      scene3DOnly: true,
      shouldAnimate: false,
      contextOptions: {
        webgl: {
          alpha: true,
          preserveDrawingBuffer: true,
        },
      },
    });

    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;

    // Immediately focus camera on the Arabian Sea with tilted 3D depth perspective
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(67.5, 8.8, 850000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-40),
        roll: 0,
      },
    });

    // Add mouse move listener for coordinate readout & model cell hover
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((movement: any) => {
      const ray = viewer.camera.getPickRay(movement.endPosition);
      if (!ray) return;
      const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
      if (cartesian) {
        const carto = Cesium.Cartographic.fromCartesian(cartesian);
        const lat = Number(Cesium.Math.toDegrees(carto.latitude).toFixed(4));
        const lon = Number(Cesium.Math.toDegrees(carto.longitude).toFixed(4));
        setMouseCoords({ lat, lon });

        // Check if cursor is over the Arabian Sea model region
        const cell = getCopernicusModelCell(lat, lon);
        if (cell) {
          setHoveredCell(cell);
          setMouseScreenPos({ x: movement.endPosition.x, y: movement.endPosition.y });
        } else {
          setHoveredCell(null);
          setMouseScreenPos(null);
        }
      } else {
        setHoveredCell(null);
        setMouseScreenPos(null);
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // Add click handler for selecting model cell & volumetric view
    handler.setInputAction((click: any) => {
      const ray = viewer.camera.getPickRay(click.position);
      if (!ray) return;
      const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
      if (cartesian) {
        const carto = Cesium.Cartographic.fromCartesian(cartesian);
        const lat = Cesium.Math.toDegrees(carto.latitude);
        const lon = Cesium.Math.toDegrees(carto.longitude);

        // 1. Interactive Ocean Model Cell Selection
        const cell = getCopernicusModelCell(lat, lon);
        if (cell) {
          onSelectGridCellRef.current?.(cell);
        }

        // 2. Probing real ocean scalar/vector values
        if (sliceRef.current) {
          const probed = probeOceanLocation(lat, lon, sliceRef.current, settingsRef.current.variable);
          onProbeLocationRef.current(probed);
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    viewerRef.current = viewer;

    return () => {
      handler.destroy();

      if (oceanGridPrimitiveRef.current) {
        try {
          viewer.scene.primitives.remove(oceanGridPrimitiveRef.current);
        } catch {
          // ignore
        }
        oceanGridPrimitiveRef.current = null;
      }

      if (vectorPolylineCollectionRef.current) {
        try {
          viewer.scene.primitives.remove(vectorPolylineCollectionRef.current);
        } catch {
          // ignore
        }
        vectorPolylineCollectionRef.current = null;
      }

      if (gridPolylinesRef.current) {
        try {
          viewer.scene.primitives.remove(gridPolylinesRef.current);
          if (!gridPolylinesRef.current.isDestroyed?.()) {
            gridPolylinesRef.current.destroy();
          }
        } catch {
          // ignore
        }
        gridPolylinesRef.current = null;
      }

      if (copernicusModelGridRef.current) {
        try {
          viewer.scene.primitives.remove(copernicusModelGridRef.current);
          if (!copernicusModelGridRef.current.isDestroyed?.()) {
            copernicusModelGridRef.current.destroy();
          }
        } catch {
          // ignore
        }
        copernicusModelGridRef.current = null;
      }

      if (hoverCellEntityRef.current) {
        try {
          viewer.entities.remove(hoverCellEntityRef.current);
        } catch {
          // ignore
        }
        hoverCellEntityRef.current = null;
      }

      if (selectedCellEntityRef.current) {
        try {
          viewer.entities.remove(selectedCellEntityRef.current);
        } catch {
          // ignore
        }
        selectedCellEntityRef.current = null;
      }

      depthPillarEntitiesRef.current.forEach((p) => {
        try {
          viewer.entities.remove(p);
        } catch {
          // ignore
        }
      });
      depthPillarEntitiesRef.current = [];

      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }
      viewerRef.current = null;
    };
  }, []);

  // Update Basemap when changed in settings
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    viewer.imageryLayers.removeAll();

    let newProvider: Cesium.ImageryProvider;
    if (settings.basemap === 'satellite') {
      newProvider = new Cesium.UrlTemplateImageryProvider({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        maximumLevel: 19,
      });
    } else if (settings.basemap === 'ocean_dark') {
      newProvider = new Cesium.UrlTemplateImageryProvider({
        url: 'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
        maximumLevel: 18,
      });
    } else {
      newProvider = new Cesium.UrlTemplateImageryProvider({
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        maximumLevel: 19,
      });
    }

    viewer.imageryLayers.addImageryProvider(newProvider);
  }, [settings.basemap]);

  // =========================================================================
  // AUTHORITATIVE EARTH GEOGRAPHIC GRATICULE (10° x 10°)
  // Created once, reused across re-renders, visibility toggled in O(1) via .show
  // Does NOT re-create or duplicate when ocean slice / data state changes
  // =========================================================================
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (!gridPolylinesRef.current) {
      gridPolylinesRef.current = createEarthGraticule(viewer);
    }

    gridPolylinesRef.current.show = Boolean(settings.showGridLines);
    viewer.scene.requestRender();
  }, [settings.showGridLines]);

  // =========================================================================
  // ARABIAN SEA COPERNICUS 61x61 HIGH-RES DATA GRID (Interactive model layer)
  // =========================================================================
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (!copernicusModelGridRef.current) {
      copernicusModelGridRef.current = createCopernicusModelGrid(viewer);
    }

    copernicusModelGridRef.current.show = Boolean(settings.showGridLines);
    viewer.scene.requestRender();
  }, [settings.showGridLines]);

  // =========================================================================
  // HOVER CELL HIGHLIGHT (Subtle cyan box over the hovered model grid cell)
  // =========================================================================
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (hoverCellEntityRef.current) {
      viewer.entities.remove(hoverCellEntityRef.current);
      hoverCellEntityRef.current = null;
    }

    if (
      hoveredCell &&
      (!selectedGridCell ||
        hoveredCell.latitudeIndex !== selectedGridCell.latitudeIndex ||
        hoveredCell.longitudeIndex !== selectedGridCell.longitudeIndex)
    ) {
      hoverCellEntityRef.current = viewer.entities.add({
        id: 'ocean_hover_cell',
        rectangle: {
          coordinates: Cesium.Rectangle.fromDegrees(
            hoveredCell.minLongitude,
            hoveredCell.minLatitude,
            hoveredCell.maxLongitude,
            hoveredCell.maxLatitude
          ),
          material: Cesium.Color.fromCssColorString('rgba(56, 189, 248, 0.28)'),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('#38bdf8'),
          outlineWidth: 2,
          height: 60,
        },
      });
      viewer.scene.requestRender();
    }
  }, [hoveredCell, selectedGridCell]);

  // =========================================================================
  // SELECTED CELL PERSISTENT HIGHLIGHT (Vibrant golden cell with active label)
  // =========================================================================
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (selectedCellEntityRef.current) {
      viewer.entities.remove(selectedCellEntityRef.current);
      selectedCellEntityRef.current = null;
    }

    if (selectedGridCell) {
      selectedCellEntityRef.current = viewer.entities.add({
        id: 'ocean_selected_cell',
        rectangle: {
          coordinates: Cesium.Rectangle.fromDegrees(
            selectedGridCell.minLongitude,
            selectedGridCell.minLatitude,
            selectedGridCell.maxLongitude,
            selectedGridCell.maxLatitude
          ),
          material: Cesium.Color.fromCssColorString('rgba(251, 191, 36, 0.38)'),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('#fbbf24'),
          outlineWidth: 3,
          height: 75,
        },
        label: {
          text: `Cell [${selectedGridCell.latitudeIndex}, ${selectedGridCell.longitudeIndex}]`,
          font: 'bold 11px monospace',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.fromCssColorString('#fbbf24'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -10),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      viewer.scene.requestRender();
    }
  }, [selectedGridCell]);

  // Recenter Camera Handler: Focus Arabian Sea with 3D tilted depth perspective
  useEffect(() => {
    if (resetCameraTrigger > 0 && viewerRef.current) {
      viewerRef.current.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(67.5, 8.8, 850000),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-40),
          roll: 0,
        },
        duration: 1.4,
      });
    }
  }, [resetCameraTrigger]);

  // =========================================================================
  // RENDER CONTINUOUS 3D GEOGRAPHIC OCEAN VOLUME (No Square PNGs or Heatmap Cards)
  // =========================================================================
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // 1. Completely clear previous oceanographic primitives and depth pillars
    if (oceanGridPrimitiveRef.current) {
      try {
        viewer.scene.primitives.remove(oceanGridPrimitiveRef.current);
      } catch {
        // ignore
      }
      oceanGridPrimitiveRef.current = null;
    }

    if (vectorPolylineCollectionRef.current) {
      try {
        viewer.scene.primitives.remove(vectorPolylineCollectionRef.current);
      } catch {
        // ignore
      }
      vectorPolylineCollectionRef.current = null;
    }

    depthPillarEntitiesRef.current.forEach((p) => {
      try {
        viewer.entities.remove(p);
      } catch {
        // ignore
      }
    });
    depthPillarEntitiesRef.current = [];

    if (!slice || !slice.latitude?.length || !slice.longitude?.length || !slice.values?.length) {
      viewer.scene.requestRender();
      return;
    }

    const { latitude, longitude, values } = slice;
    const depthMeters = slice.depth ?? 0.5;
    const is3D = settings.render3DDepth;

    // 2. Determine Layer Altitude & Vertical Exaggeration
    // When subsurface depth (> 2m) and 3D depth mode is active:
    // Place layer at real physical depth exaggerated into 3D ocean space
    const layerAltitude = (is3D && depthMeters > 2)
      ? -depthMeters * Math.max(1, settings.verticalExaggeration)
      : 50; // Above sea level to sit cleanly over ocean satellite tiles

    // 3. Configure Globe Translucency for subsurface visibility
    if (is3D && depthMeters > 2) {
      viewer.scene.globe.translucency.enabled = true;
      viewer.scene.globe.translucency.frontFaceAlpha = Math.min(0.65, Math.max(0.35, settings.opacity * 0.75));
      viewer.scene.globe.translucency.backFaceAlpha = 0.0;
      viewer.scene.globe.depthTestAgainstTerrain = false;
      viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
    } else {
      viewer.scene.globe.translucency.enabled = false;
      viewer.scene.globe.depthTestAgainstTerrain = false;
    }

    // 4. Physical normalization bounds
    const varConfig = VARIABLE_CONFIGS[settings.variable];
    let minVal = settings.customMin ?? varConfig.defaultMin;
    let maxVal = settings.customMax ?? varConfig.defaultMax;

    if (settings.customMin === null || settings.customMax === null) {
      let actualMin = Infinity;
      let actualMax = -Infinity;
      for (let r = 0; r < values.length; r++) {
        const row = values[r];
        if (!row) continue;
        for (let c = 0; c < row.length; c++) {
          const v = row[c];
          if (v !== null && v !== undefined && !isNaN(v)) {
            if (v < actualMin) actualMin = v;
            if (v > actualMax) actualMax = v;
          }
        }
      }
      if (actualMin !== Infinity && actualMax !== -Infinity && actualMax > actualMin) {
        if (settings.customMin === null) minVal = actualMin;
        if (settings.customMax === null) maxVal = actualMax;
      }
    }
    const range = maxVal - minVal || 1;

    // 5. Geographic Bounds
    const minLat = Math.min(...latitude);
    const maxLat = Math.max(...latitude);
    const minLon = Math.min(...longitude);
    const maxLon = Math.max(...longitude);
    const latAscending = latitude[0] < latitude[latitude.length - 1];

    // Bilinear sampler across real data grid
    const sampleBilinear = (lat: number, lon: number): number | null => {
      const nLats = latitude.length;
      const nLons = longitude.length;
      const minL = latAscending ? latitude[0] : latitude[nLats - 1];
      const maxL = latAscending ? latitude[nLats - 1] : latitude[0];
      const minO = longitude[0];
      const maxO = longitude[nLons - 1];

      const rFrac = ((lat - minL) / (maxL - minL || 1)) * (nLats - 1);
      const cFrac = ((lon - minO) / (maxO - minO || 1)) * (nLons - 1);

      const r0 = Math.max(0, Math.min(nLats - 1, Math.floor(rFrac)));
      const r1 = Math.max(0, Math.min(nLats - 1, Math.ceil(rFrac)));
      const c0 = Math.max(0, Math.min(nLons - 1, Math.floor(cFrac)));
      const c1 = Math.max(0, Math.min(nLons - 1, Math.ceil(cFrac)));

      const row0 = latAscending ? r0 : nLats - 1 - r0;
      const row1 = latAscending ? r1 : nLats - 1 - r1;

      const v00 = values[row0]?.[c0];
      const v01 = values[row0]?.[c1];
      const v10 = values[row1]?.[c0];
      const v11 = values[row1]?.[c1];

      const dr = rFrac - r0;
      const dc = cFrac - c0;

      let sum = 0;
      let wSum = 0;

      if (v00 !== null && v00 !== undefined && !isNaN(v00)) {
        const w = (1 - dr) * (1 - dc);
        sum += v00 * w;
        wSum += w;
      }
      if (v01 !== null && v01 !== undefined && !isNaN(v01)) {
        const w = (1 - dr) * dc;
        sum += v01 * w;
        wSum += w;
      }
      if (v10 !== null && v10 !== undefined && !isNaN(v10)) {
        const w = dr * (1 - dc);
        sum += v10 * w;
        wSum += w;
      }
      if (v11 !== null && v11 !== undefined && !isNaN(v11)) {
        const w = dr * dc;
        sum += v11 * w;
        wSum += w;
      }

      return wSum > 0 ? sum / wSum : null;
    };

    // 6. Generate Continuous Geographic Field Grid Cells
    // 44x44 grid gives ~1936 smooth contiguous cells positioned directly on Cesium's ellipsoidal globe
    const GRID_N = 44;
    const instances: Cesium.GeometryInstance[] = [];

    for (let r = 0; r < GRID_N; r++) {
      const lat0 = minLat + (r / GRID_N) * (maxLat - minLat);
      const lat1 = minLat + ((r + 1) / GRID_N) * (maxLat - minLat);
      const latMid = (lat0 + lat1) / 2;

      for (let c = 0; c < GRID_N; c++) {
        const lon0 = minLon + (c / GRID_N) * (maxLon - minLon);
        const lon1 = minLon + ((c + 1) / GRID_N) * (maxLon - minLon);
        const lonMid = (lon0 + lon1) / 2;

        const val = sampleBilinear(latMid, lonMid);
        if (val === null || val === undefined || isNaN(val)) {
          continue; // Masked land / invalid coordinate
        }

        // Calculate smooth color from physical value
        const normVal = Math.max(0, Math.min(1, (val - minVal) / range));
        const { r: cr, g: cg, b: cb } = interpolateColor(normVal, settings.palette);

        // Soft geographic boundary feathering (avoids harsh artificial square borders)
        const edgeDistX = Math.min(c, GRID_N - 1 - c);
        const edgeDistY = Math.min(r, GRID_N - 1 - r);
        const minEdge = Math.min(edgeDistX, edgeDistY);
        const margin = 3.5;
        const edgeNorm = Math.min(1.0, minEdge / margin);
        // Smoothstep fade factor
        const fade = edgeNorm * edgeNorm * (3 - 2 * edgeNorm);
        const cellAlpha = Math.max(0.08, settings.opacity * (0.2 + 0.8 * fade));

        // Create geographic cell geometry at true coordinates and altitude
        instances.push(
          new Cesium.GeometryInstance({
            geometry: new Cesium.RectangleGeometry({
              rectangle: Cesium.Rectangle.fromDegrees(lon0, lat0, lon1, lat1),
              height: layerAltitude,
              vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
            }),
            attributes: {
              color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                new Cesium.Color(cr / 255, cg / 255, cb / 255, cellAlpha)
              ),
            },
          })
        );
      }
    }

    if (instances.length > 0) {
      const gridPrimitive = new Cesium.Primitive({
        geometryInstances: instances,
        appearance: new Cesium.PerInstanceColorAppearance({
          flat: true,
          translucent: true,
          renderState: {
            depthTest: { enabled: false },
            blending: Cesium.BlendingState.ALPHA_BLEND,
          },
        }),
        asynchronous: false,
      });

      viewer.scene.primitives.add(gridPrimitive);
      oceanGridPrimitiveRef.current = gridPrimitive;
    }

    // 7. CURRENT VELOCITY: Directional Vector Arrows
    // Render real physical vectors based on uo (eastward) and vo (northward) components
    if (
      settings.variable === 'currents' &&
      settings.showVectors &&
      'uoValues' in slice &&
      'voValues' in slice &&
      slice.uoValues?.length &&
      slice.voValues?.length
    ) {
      const polylineCollection = new Cesium.PolylineCollection();
      const uoGrid = slice.uoValues;
      const voGrid = slice.voValues;
      const nLat = slice.latitude.length;
      const nLon = slice.longitude.length;

      // Sample grid stations across Arabian Sea for legible vector field
      const stepLat = Math.max(2, Math.floor(nLat / 16));
      const stepLon = Math.max(2, Math.floor(nLon / 16));
      const vectorAlt = layerAltitude + 80;

      for (let r = Math.floor(stepLat / 2); r < nLat; r += stepLat) {
        const lat = slice.latitude[r];
        const rowIdx = latAscending ? r : nLat - 1 - r;

        for (let c = Math.floor(stepLon / 2); c < nLon; c += stepLon) {
          const lon = slice.longitude[c];
          const u = uoGrid[rowIdx]?.[c];
          const v = voGrid[rowIdx]?.[c];

          if (u !== null && u !== undefined && !isNaN(u) && v !== null && v !== undefined && !isNaN(v)) {
            const speed = Math.sqrt(u * u + v * v);
            if (speed > 0.02) {
              // Mathematical flow angle in radians (0 is East, PI/2 is North)
              const angle = Math.atan2(v, u);
              // Scale arrow length geographically based on real physical velocity
              const lenDeg = Math.min(0.28, 0.06 + speed * 0.18);

              const cosLat = Math.cos((lat * Math.PI) / 180);
              const dLon = (lenDeg * Math.cos(angle)) / (cosLat || 1);
              const dLat = lenDeg * Math.sin(angle);

              const endLon = lon + dLon;
              const endLat = lat + dLat;

              // Vector Main Shaft
              polylineCollection.add({
                positions: Cesium.Cartesian3.fromDegreesArrayHeights([
                  lon, lat, vectorAlt,
                  endLon, endLat, vectorAlt,
                ]),
                width: 2.5,
                material: Cesium.Material.fromType('Color', {
                  color: Cesium.Color.fromCssColorString('rgba(255, 255, 255, 0.95)'),
                }),
              });

              // Vector Arrowhead Wings
              const headLen = lenDeg * 0.32;
              const wing1Angle = angle + (5 * Math.PI) / 6;
              const wing2Angle = angle - (5 * Math.PI) / 6;

              const w1Lon = endLon + (headLen * Math.cos(wing1Angle)) / (cosLat || 1);
              const w1Lat = endLat + headLen * Math.sin(wing1Angle);
              const w2Lon = endLon + (headLen * Math.cos(wing2Angle)) / (cosLat || 1);
              const w2Lat = endLat + headLen * Math.sin(wing2Angle);

              polylineCollection.add({
                positions: Cesium.Cartesian3.fromDegreesArrayHeights([
                  w1Lon, w1Lat, vectorAlt,
                  endLon, endLat, vectorAlt,
                  w2Lon, w2Lat, vectorAlt,
                ]),
                width: 2.2,
                material: Cesium.Material.fromType('Color', {
                  color: Cesium.Color.fromCssColorString('rgba(255, 255, 255, 0.95)'),
                }),
              });
            }
          }
        }
      }

      viewer.scene.primitives.add(polylineCollection);
      vectorPolylineCollectionRef.current = polylineCollection;
    }

    // 8. TRUE 3D DEPTH PERSPECTIVE & WATER COLUMN
    // If subsurface depth is selected, render vertical water column soundings & surface reference
    if (is3D && depthMeters > 2) {
      const surfaceHeight = 80;
      const corners = [
        { lon: minLon, lat: minLat },
        { lon: maxLon, lat: minLat },
        { lon: maxLon, lat: maxLat },
        { lon: minLon, lat: maxLat },
      ];

      // Subtle surface boundary wireframe marking Sea Level (0m) above the submerged layer
      const surfacePerimeter = Cesium.Cartesian3.fromDegreesArrayHeights([
        minLon, minLat, surfaceHeight,
        maxLon, minLat, surfaceHeight,
        maxLon, maxLat, surfaceHeight,
        minLon, maxLat, surfaceHeight,
        minLon, minLat, surfaceHeight,
      ]);

      const surfaceOutlineEntity = viewer.entities.add({
        id: `surface_ref_${Date.now()}`,
        polyline: {
          positions: surfacePerimeter,
          width: 1.8,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString('rgba(56, 189, 248, 0.6)'),
            dashLength: 16.0,
          }),
        },
      });
      depthPillarEntitiesRef.current.push(surfaceOutlineEntity);

      // 4 vertical sounding columns connecting sea level to deep layer
      corners.forEach((corner, idx) => {
        const pillar = viewer.entities.add({
          id: `depth_pillar_${idx}_${Date.now()}`,
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArrayHeights([
              corner.lon, corner.lat, surfaceHeight,
              corner.lon, corner.lat, layerAltitude,
            ]),
            width: 2.0,
            material: Cesium.Color.fromCssColorString('rgba(6, 182, 212, 0.7)'),
          },
        });
        depthPillarEntitiesRef.current.push(pillar);
      });

      // Depth indicator callout on primary corner
      const calloutEntity = viewer.entities.add({
        id: `depth_callout_${Date.now()}`,
        position: Cesium.Cartesian3.fromDegrees(minLon, minLat, layerAltitude),
        label: {
          text: `▼ ${depthMeters.toFixed(1)}m Depth (${Math.abs(Math.round(layerAltitude)).toLocaleString()}m 3D)`,
          font: '600 11px "JetBrains Mono", monospace',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.fromCssColorString('#38bdf8'),
          outlineColor: Cesium.Color.fromCssColorString('#020617'),
          outlineWidth: 3,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('rgba(15, 23, 42, 0.85)'),
          backgroundPadding: new Cesium.Cartesian2(6, 3),
          horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
          verticalOrigin: Cesium.VerticalOrigin.TOP,
          pixelOffset: new Cesium.Cartesian2(8, 0),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      depthPillarEntitiesRef.current.push(calloutEntity);
    }

    viewer.scene.requestRender();
  }, [slice, settings]);

  // Update Probe Point Marker Entity on Globe
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (probeMarkerEntityRef.current) {
      viewer.entities.remove(probeMarkerEntityRef.current);
      probeMarkerEntityRef.current = null;
    }

    if (probePoint) {
      const position = Cesium.Cartesian3.fromDegrees(
        probePoint.longitude,
        probePoint.latitude,
        1000
      );

      probeMarkerEntityRef.current = viewer.entities.add({
        id: 'ocean_probe_marker',
        position,
        point: {
          pixelSize: 12,
          color: Cesium.Color.fromCssColorString('#38bdf8'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `${probePoint.value !== null ? `${probePoint.value} ${probePoint.unit}` : 'Probe'}`,
          font: '12px monospace',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });

      viewer.scene.requestRender();
    }
  }, [probePoint]);

  // Update Cross-Section Transect line on globe
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (transectLineEntityRef.current) {
      viewer.entities.remove(transectLineEntityRef.current);
      transectLineEntityRef.current = null;
    }

    if (settings.crossSectionMode && crossSectionCoordinate !== undefined) {
      let positions: Cesium.Cartesian3[];

      if (settings.crossSectionType === 'latitudinal') {
        positions = [
          Cesium.Cartesian3.fromDegrees(65.0, crossSectionCoordinate, 500),
          Cesium.Cartesian3.fromDegrees(70.0, crossSectionCoordinate, 500),
        ];
      } else {
        positions = [
          Cesium.Cartesian3.fromDegrees(crossSectionCoordinate, 10.0, 500),
          Cesium.Cartesian3.fromDegrees(crossSectionCoordinate, 15.0, 500),
        ];
      }

      transectLineEntityRef.current = viewer.entities.add({
        id: 'transect_line',
        polyline: {
          positions,
          width: 3,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.3,
            color: Cesium.Color.fromCssColorString('#f59e0b'),
          }),
        },
      });

      viewer.scene.requestRender();
    }
  }, [settings.crossSectionMode, settings.crossSectionType, crossSectionCoordinate]);

  // Quick Zoom Controls
  const handleZoomIn = () => {
    if (viewerRef.current) {
      viewerRef.current.camera.zoomIn(300000);
    }
  };

  const handleZoomOut = () => {
    if (viewerRef.current) {
      viewerRef.current.camera.zoomOut(300000);
    }
  };

  return (
    <div id="ocean-globe-container" className="relative flex-1 w-full h-full bg-slate-950 overflow-hidden">
      {/* Cesium canvas target */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Bottom Status & Coordinates Bar */}
      <div
        id="globe-coordinates-readout"
        className="absolute bottom-3 left-3 z-10 bg-slate-900/90 border border-slate-800 rounded-md px-3 py-1.5 text-xs font-mono text-slate-300 flex items-center gap-3 shadow-md"
      >
        <span className="flex items-center gap-1.5 text-slate-400">
          <Compass className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-slate-200">Arabian Sea</span>
        </span>
        <span className="text-slate-600">•</span>
        <span>
          Lat: <span className="text-white font-medium">{mouseCoords ? `${mouseCoords.lat}°N` : '12.500°N'}</span>
        </span>
        <span>
          Lon: <span className="text-white font-medium">{mouseCoords ? `${mouseCoords.lon}°E` : '67.500°E'}</span>
        </span>
        <span className="text-slate-600">•</span>
        <span>
          Depth: <span className="text-sky-300 font-medium">{slice?.depth !== undefined ? `${slice.depth.toFixed(1)}m` : '0.5m'}</span>
        </span>

        {selectedGridCell && (
          <>
            <span className="text-slate-600">•</span>
            <span className="text-amber-300 flex items-center gap-1.5">
              <span>Cell [{selectedGridCell.latitudeIndex}, {selectedGridCell.longitudeIndex}]</span>
              <button
                onClick={() => onSelectGridCell(null)}
                className="text-slate-400 hover:text-white px-1 rounded hover:bg-slate-800"
                title="Deselect Cell"
              >
                ✕
              </button>
            </span>
          </>
        )}
      </div>

      {/* Floating Viewport Navigation Toolbar */}
      <div
        id="globe-toolbar"
        className="absolute top-3 right-3 z-10 flex flex-col gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-md shadow-md"
      >
        <button
          id="zoom-in-btn"
          onClick={handleZoomIn}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          id="zoom-out-btn"
          onClick={handleZoomOut}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {/* Interactive Grid Cell Hover Tooltip */}
      {hoveredCell && mouseScreenPos && (
        <div
          id="grid-hover-tooltip"
          className="absolute pointer-events-none z-40 transform -translate-x-1/2 -translate-y-full mb-3 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-md shadow-lg text-left transition-all duration-75"
          style={{
            left: Math.max(120, Math.min(window.innerWidth - 120, mouseScreenPos.x)),
            top: Math.max(70, mouseScreenPos.y),
          }}
        >
          <div className="text-xs font-semibold text-white">
            Model Cell [{hoveredCell.latitudeIndex}, {hoveredCell.longitudeIndex}]
          </div>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
            {hoveredCell.centerLatitude.toFixed(4)}°N, {hoveredCell.centerLongitude.toFixed(4)}°E
          </div>
          <div className="text-[10px] text-sky-400 mt-0.5">
            Click to open 3D volume view
          </div>
        </div>
      )}
    </div>
  );
};
