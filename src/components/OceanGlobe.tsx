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
}

export const OceanGlobe: React.FC<OceanGlobeProps> = ({
  metadata,
  slice,
  settings,
  probePoint,
  onProbeLocation,
  crossSectionCoordinate,
  resetCameraTrigger,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const sliceEntityRef = useRef<Cesium.Entity | null>(null);
  const boundaryEntityRef = useRef<Cesium.Entity | null>(null);
  const probeMarkerEntityRef = useRef<Cesium.Entity | null>(null);
  const transectLineEntityRef = useRef<Cesium.Entity | null>(null);

  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lon: number } | null>(null);

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

    // Initial camera flight to Arabian Sea
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(67.5, 12.5, 1400000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-62),
        roll: 0.0,
      },
      duration: 2.0,
    });

    // Add mouse move listener for coordinate readout
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((movement: any) => {
      const ray = viewer.camera.getPickRay(movement.endPosition);
      if (!ray) return;
      const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
      if (cartesian) {
        const carto = Cesium.Cartographic.fromCartesian(cartesian);
        setMouseCoords({
          lat: Number(Cesium.Math.toDegrees(carto.latitude).toFixed(3)),
          lon: Number(Cesium.Math.toDegrees(carto.longitude).toFixed(3)),
        });
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // Add click handler for probing real ocean values
    handler.setInputAction((click: any) => {
      const ray = viewer.camera.getPickRay(click.position);
      if (!ray) return;
      const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
      if (cartesian && slice) {
        const carto = Cesium.Cartographic.fromCartesian(cartesian);
        const lat = Cesium.Math.toDegrees(carto.latitude);
        const lon = Cesium.Math.toDegrees(carto.longitude);

        const probed = probeOceanLocation(lat, lon, slice, settings.variable);
        onProbeLocation(probed);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    viewerRef.current = viewer;

    return () => {
      handler.destroy();
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

  // Recenter Camera Handler
  useEffect(() => {
    if (resetCameraTrigger > 0 && viewerRef.current) {
      viewerRef.current.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(67.5, 12.5, 1400000),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-62),
          roll: 0.0,
        },
        duration: 1.5,
      });
    }
  }, [resetCameraTrigger]);

  // Render Real Ocean Slice onto Cesium Globe
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !slice) return;

    const { latitude, longitude, values, depth } = slice;
    if (!latitude.length || !longitude.length || !values.length) return;

    // Boundaries of the Copernicus slice
    const minLat = Math.min(...latitude);
    const maxLat = Math.max(...latitude);
    const minLon = Math.min(...longitude);
    const maxLon = Math.max(...longitude);

    // Compute min / max for normalization
    const varConfig = VARIABLE_CONFIGS[settings.variable];
    let minVal = settings.customMin ?? varConfig.defaultMin;
    let maxVal = settings.customMax ?? varConfig.defaultMax;

    // Find actual slice bounds if default not overridden
    if (settings.customMin === null || settings.customMax === null) {
      let actualMin = Infinity;
      let actualMax = -Infinity;
      for (let r = 0; r < values.length; r++) {
        for (let c = 0; c < values[r].length; c++) {
          const v = values[r][c];
          if (v !== null && !isNaN(v)) {
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

    // Create Canvas to paint the exact scientific slice texture
    const rows = latitude.length;
    const cols = longitude.length;
    const canvas = document.createElement('canvas');
    canvas.width = cols * 4; // high-resolution smooth sampling
    canvas.height = rows * 4;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.createImageData(canvas.width, canvas.height);
    const data = imgData.data;

    // Note: in Copernicus grid, latitude can be sorted ascending (10 -> 15)
    // In Canvas, y=0 is TOP (highest latitude = 15°N), y=max is BOTTOM (lowest latitude = 10°N)
    const latAscending = latitude[0] < latitude[latitude.length - 1];

    for (let py = 0; py < canvas.height; py++) {
      const rowFloat = (py / canvas.height) * (rows - 1);
      const r = latAscending
        ? Math.round(rows - 1 - rowFloat)
        : Math.round(rowFloat);

      for (let px = 0; px < canvas.width; px++) {
        const c = Math.round((px / canvas.width) * (cols - 1));

        const val = values[r]?.[c];
        const pixelIdx = (py * canvas.width + px) * 4;

        if (val !== null && val !== undefined && !isNaN(val)) {
          const norm = Math.max(0, Math.min(1, (val - minVal) / range));
          const { r: cr, g: cg, b: cb } = interpolateColor(norm, settings.palette);
          data[pixelIdx] = cr;
          data[pixelIdx + 1] = cg;
          data[pixelIdx + 2] = cb;
          data[pixelIdx + 3] = Math.round(settings.opacity * 255);
        } else {
          // Transparent for land / masked regions
          data[pixelIdx] = 0;
          data[pixelIdx + 1] = 0;
          data[pixelIdx + 2] = 0;
          data[pixelIdx + 3] = 0;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // If currents variable is selected and showVectors is true, draw authentic vector arrows
    if (
      settings.variable === 'currents' &&
      settings.showVectors &&
      'uoValues' in slice &&
      'voValues' in slice
    ) {
      const uoGrid = slice.uoValues;
      const voGrid = slice.voValues;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 1.5;

      const step = 4; // grid step for legible arrows
      for (let r = 0; r < rows; r += step) {
        const py = latAscending
          ? ((rows - 1 - r) / (rows - 1)) * canvas.height
          : (r / (rows - 1)) * canvas.height;

        for (let c = 0; c < cols; c += step) {
          const px = (c / (cols - 1)) * canvas.width;
          const u = uoGrid[r]?.[c];
          const v = voGrid[r]?.[c];

          if (u !== null && u !== undefined && v !== null && v !== undefined) {
            const speed = Math.sqrt(u * u + v * v);
            if (speed > 0.02) {
              const angle = Math.atan2(-v, u); // negative because canvas Y is flipped
              const arrowLen = Math.min(22, 6 + speed * 12);

              const endX = px + Math.cos(angle) * arrowLen;
              const endY = py + Math.sin(angle) * arrowLen;

              // Line
              ctx.beginPath();
              ctx.moveTo(px, py);
              ctx.lineTo(endX, endY);
              ctx.stroke();

              // Arrowhead
              const headLen = 4;
              ctx.beginPath();
              ctx.moveTo(endX, endY);
              ctx.lineTo(
                endX - headLen * Math.cos(angle - Math.PI / 6),
                endY - headLen * Math.sin(angle - Math.PI / 6)
              );
              ctx.lineTo(
                endX - headLen * Math.cos(angle + Math.PI / 6),
                endY - headLen * Math.sin(angle + Math.PI / 6)
              );
              ctx.closePath();
              ctx.fill();
            }
          }
        }
      }
    }

    // 3D Altitude calculation
    const altitude = settings.render3DDepth
      ? -depth * settings.verticalExaggeration
      : 0;

    // Add or update Cesium Entity
    if (sliceEntityRef.current) {
      viewer.entities.remove(sliceEntityRef.current);
    }

    const rectCoordinates = Cesium.Rectangle.fromDegrees(minLon, minLat, maxLon, maxLat);

    sliceEntityRef.current = viewer.entities.add({
      id: 'copernicus_ocean_slice',
      rectangle: {
        coordinates: rectCoordinates,
        material: new Cesium.ImageMaterialProperty({
          image: canvas,
          transparent: true,
        }),
        height: altitude,
      },
    });

    // Add boundary wireframe entity
    if (!boundaryEntityRef.current) {
      boundaryEntityRef.current = viewer.entities.add({
        id: 'copernicus_boundary',
        rectangle: {
          coordinates: rectCoordinates,
          material: Cesium.Color.fromCssColorString('rgba(6, 182, 212, 0.05)'),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('rgba(6, 182, 212, 0.8)'),
          outlineWidth: 2,
        },
      });
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

      {/* Real-time Geographic Coordinate Readout in Bottom Left */}
      <div
        id="globe-coordinates-readout"
        className="absolute bottom-4 left-4 z-10 bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 backdrop-blur-md text-[11px] font-mono text-slate-300 flex items-center gap-3 shadow-lg pointer-events-none"
      >
        <span className="flex items-center gap-1 text-cyan-400">
          <Compass className="w-3.5 h-3.5" />
          <span>Arabian Sea</span>
        </span>
        <span>
          Lat: <span className="text-white font-bold">{mouseCoords ? `${mouseCoords.lat}°N` : '12.500°N'}</span>
        </span>
        <span>
          Lon: <span className="text-white font-bold">{mouseCoords ? `${mouseCoords.lon}°E` : '67.500°E'}</span>
        </span>
        <span className="hidden sm:inline text-slate-500">
          Elevation: 0 m
        </span>
      </div>

      {/* Floating Viewport Navigation Toolbar */}
      <div
        id="globe-toolbar"
        className="absolute top-4 right-4 z-10 flex flex-col gap-1.5 bg-slate-900/80 border border-slate-800 p-1.5 rounded-xl backdrop-blur-md shadow-xl"
      >
        <button
          id="zoom-in-btn"
          onClick={handleZoomIn}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          id="zoom-out-btn"
          onClick={handleZoomOut}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {/* 3D Depth Level Indicator Badge in Top-Left of Globe */}
      <div
        id="depth-badge"
        className="absolute top-4 left-4 z-10 bg-slate-950/85 border border-cyan-800/80 rounded-xl px-3.5 py-2 backdrop-blur-md shadow-xl flex items-center gap-3"
      >
        <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
        <div>
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Active Subsurface Depth
          </div>
          <div className="text-xs font-mono font-extrabold text-cyan-300">
            {slice?.depth !== undefined ? `${slice.depth.toFixed(1)} meters` : '0.5 meters'}
            {settings.render3DDepth && (
              <span className="text-[10px] text-emerald-400 font-normal ml-1.5">
                (3D -{slice?.depth ? (slice.depth * settings.verticalExaggeration).toFixed(0) : 0}m)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
