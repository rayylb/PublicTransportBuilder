import React, { useEffect, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  NavigationControl,
  FullscreenControl,
  ScaleControl,
  type MapMouseEvent,
} from 'maplibre-gl';
import { getBasemapStyle } from '../constants/basemaps';
import { useTransportStore } from '../store/useTransportStore';
import type { BasemapId, Coordinates } from '../types/transport';
import { computeParallelTransitLines } from '../utils/transitGeometry';
import { Crosshair, ZoomIn, Check, X, Trash2, ArrowRightLeft } from 'lucide-react';

interface MapViewProps {
  activeBasemap?: BasemapId;
  initialCenter?: [number, number];
  initialZoom?: number;
}

export const MapView: React.FC<MapViewProps> = ({
  activeBasemap = 'osm',
  initialCenter = [2.3522, 48.8566], // Paris
  initialZoom = 12,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [, setMapRenderTick] = useState(0);

  const [cursorCoords, setCursorCoords] = useState<Coordinates | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(initialZoom);
  const [hoveredStopId, setHoveredStopId] = useState<string | null>(null);

  // Store Zustand
  const {
    stops,
    waypoints,
    lines,
    activeTool,
    activeLineId,
    drawingEnd,
    selectedElement,
    editingStopId,
    showStationLabels,
    addStop,
    updateStop,
    deleteStop,
    createAndAppendWaypoint,
    createAndPrependWaypoint,
    appendStopToLine,
    prependStopToLine,
    setSelectedElement,
    setEditingStopId,
  } = useTransportStore();

  const [tempStopName, setTempStopName] = useState('');
  const stopInputRef = useRef<HTMLInputElement | null>(null);

  // Initialisation de la carte MapLibre
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const mapInstance = new MapLibreMap({
      container: mapContainerRef.current,
      style: getBasemapStyle(activeBasemap),
      center: initialCenter,
      zoom: initialZoom,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    mapInstance.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    mapInstance.addControl(new FullscreenControl(), 'top-right');
    mapInstance.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right');

    mapInstance.on('mousemove', (e) => {
      setCursorCoords({
        lng: Number(e.lngLat.lng.toFixed(5)),
        lat: Number(e.lngLat.lat.toFixed(5)),
      });
    });

    // Mettre à jour l'affichage SVG / Stations en temps réel lors du déplacement / zoom
    mapInstance.on('move', () => {
      setMapRenderTick((t) => t + 1);
    });

    mapInstance.on('zoom', () => {
      setCurrentZoom(Number(mapInstance.getZoom().toFixed(1)));
      setMapRenderTick((t) => t + 1);
    });

    mapInstance.on('resize', () => {
      setMapRenderTick((t) => t + 1);
    });

    mapInstance.on('load', () => {
      mapInstance.resize();
      setMap(mapInstance);
      setMapRenderTick((t) => t + 1);
    });

    return () => {
      mapInstance.remove();
      setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus automatique du champ texte lors de l'ouverture du popover
  useEffect(() => {
    if (editingStopId && stops[editingStopId]) {
      const stop = stops[editingStopId];
      setTempStopName(stop.name);
      const timer = setTimeout(() => {
        stopInputRef.current?.focus();
        stopInputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [editingStopId, stops]);

  // Changement réactif du fond de carte
  useEffect(() => {
    if (map) {
      map.setStyle(getBasemapStyle(activeBasemap));
    }
  }, [map, activeBasemap]);

  // Redimensionnement automatique de la carte
  useEffect(() => {
    const handleResize = () => {
      map?.resize();
    };
    window.addEventListener('resize', handleResize);
    const timeout = setTimeout(handleResize, 100);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeout);
    };
  }, [map]);

  // Clic sur la carte pour poser un arrêt ou un waypoint
  useEffect(() => {
    if (!map) return;

    if (activeTool === 'add_stop') {
      map.getCanvas().style.cursor = 'crosshair';
    } else if (activeTool === 'draw_line') {
      map.getCanvas().style.cursor = 'pointer';
    } else {
      map.getCanvas().style.cursor = '';
    }

    const handleMapClick = (e: MapMouseEvent) => {
      const coords: Coordinates = {
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
      };

      if (activeTool === 'add_stop') {
        // Crée l'arrêt et ouvre le popover d'édition directement dessus
        addStop(coords);
      } else if (activeTool === 'draw_line') {
        if (!activeLineId) {
          alert('Veuillez d\'abord sélectionner ou créer une ligne dans le panneau de gauche.');
          return;
        }
        if (drawingEnd === 'start') {
          createAndPrependWaypoint(activeLineId, coords);
        } else {
          createAndAppendWaypoint(activeLineId, coords);
        }
      } else if (activeTool === 'select') {
        setSelectedElement(null);
        setEditingStopId(null);
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [
    map,
    activeTool,
    activeLineId,
    drawingEnd,
    addStop,
    createAndAppendWaypoint,
    createAndPrependWaypoint,
    setSelectedElement,
    setEditingStopId,
  ]);

  // Validation du formulaire de modification d'arrêt
  const handleSaveStopName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStopId || !stops[editingStopId]) return;

    if (tempStopName.trim()) {
      updateStop(editingStopId, { name: tempStopName.trim() });
    }
    setEditingStopId(null);
  };

  // Bascule correspondance
  const handleToggleTransfer = () => {
    if (!editingStopId || !stops[editingStopId]) return;
    const current = stops[editingStopId];
    updateStop(editingStopId, { isTransfer: !current.isTransfer });
  };

  // 1. Calcul dynamique des tracés SVG décalés en parallèle pour les tronçons communs
  const parallelPaths = map
    ? computeParallelTransitLines(lines, stops, waypoints, (coords) => map.project(coords))
    : {};

  const renderedLines = map
    ? Object.values(lines)
        .filter((line) => line.isActive !== false && parallelPaths[line.id])
        .sort((a, b) => {
          const aSelected = selectedElement?.type === 'line' && selectedElement.id === a.id;
          const bSelected = selectedElement?.type === 'line' && selectedElement.id === b.id;
          const aActive = activeLineId === a.id;
          const bActive = activeLineId === b.id;
          if ((aSelected || aActive) && !(bSelected || bActive)) return 1;
          if (!(aSelected || aActive) && (bSelected || bActive)) return -1;
          return 0;
        })
        .map((line) => {
          const pathData = parallelPaths[line.id];
          if (!pathData) return null;

          const isSelected = selectedElement?.type === 'line' && selectedElement.id === line.id;
          const isActive = activeLineId === line.id;

          return (
            <g
              key={line.id}
              className={`svg-transit-line-group ${isSelected || isActive ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedElement({ type: 'line', id: line.id });
              }}
              style={{ cursor: 'pointer' }}
            >
              {/* Zone de clic invisible élargie (24px) pour faciliter la sélection de ligne au clic sur la carte */}
              <path
                d={pathData}
                fill="none"
                stroke="transparent"
                strokeWidth={24}
                pointerEvents="stroke"
              />
              {/* Lueur d'illumination si la ligne est active ou sélectionnée */}
              {(isSelected || isActive) && (
                <path
                  d={pathData}
                  fill="none"
                  stroke={line.color || '#0ea5e9'}
                  strokeWidth={13}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={0.4}
                  pointerEvents="none"
                />
              )}
              {/* Sous-couche de contraste noir */}
              <path
                d={pathData}
                fill="none"
                stroke="#000000"
                strokeWidth={isSelected || isActive ? 8.5 : 7}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={0.85}
                pointerEvents="none"
              />
              {/* Tracé coloré principal */}
              <path
                d={pathData}
                fill="none"
                stroke={line.color || '#0ea5e9'}
                strokeWidth={isSelected || isActive ? 5.5 : 4.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
              />
            </g>
          );
        })
    : null;

  // 2. Calcul dynamique des Waypoints (points de virage) en SVG
  const renderedWaypoints = map
    ? Object.values(waypoints)
        .filter((wp) => !wp.lineId || lines[wp.lineId]?.isActive !== false)
        .map((wp) => {
          const p = map.project([wp.coordinates.lng, wp.coordinates.lat]);

          return (
            <circle
              key={wp.id}
              cx={p.x}
              cy={p.y}
              r={4}
              fill="#ffffff"
              stroke="#0284c7"
              strokeWidth={2}
              className="svg-waypoint-dot"
            />
          );
        })
    : null;

  // 3. Calcul dynamique des Arrêts (Stations) sous forme de simples points noirs AU-DESSUS des lignes
  const renderedStops = map
    ? Object.values(stops).map((stop) => {
        const p = map.project([stop.coordinates.lng, stop.coordinates.lat]);
        const isSelected = selectedElement?.type === 'stop' && selectedElement.id === stop.id;
        const isEditing = editingStopId === stop.id;
        const isHovered = hoveredStopId === stop.id;
        const isTransfer = stop.isTransfer || stop.linesServed.length > 1;
        const shouldShowLabel = showStationLabels || isHovered || isSelected || isEditing;

        return (
          <div
            key={stop.id}
            className={`map-station-dot-wrapper ${isSelected ? 'selected' : ''} ${isTransfer ? 'transfer' : ''}`}
            style={{
              transform: `translate3d(${p.x}px, ${p.y}px, 0)`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (activeTool === 'draw_line' && activeLineId) {
                if (drawingEnd === 'start') {
                  prependStopToLine(activeLineId, stop.id);
                } else {
                  appendStopToLine(activeLineId, stop.id);
                }
              } else {
                setSelectedElement({ type: 'stop', id: stop.id });
                setEditingStopId(stop.id);
              }
            }}
            onMouseEnter={() => setHoveredStopId(stop.id)}
            onMouseLeave={() => setHoveredStopId(null)}
          >
            {/* Le point noir simple */}
            <div className="station-black-dot" />

            {/* Le nom de la station (affiché au survol ou si l'affichage permanent est activé) */}
            {shouldShowLabel && (
              <div className={`station-name-tooltip ${isHovered ? 'hovered' : ''}`}>
                {stop.name}
              </div>
            )}
          </div>
        );
      })
    : null;

  // Position du Popover d'édition au-dessus de l'arrêt sélectionné
  const activeEditingStop = editingStopId && stops[editingStopId] ? stops[editingStopId] : null;
  const popupPixelPos = activeEditingStop && map
    ? map.project([activeEditingStop.coordinates.lng, activeEditingStop.coordinates.lat])
    : null;

  return (
    <div className="map-view-wrapper">
      {/* 1. Conteneur MapLibre WebGL (Fond de carte raster / satellite) */}
      <div ref={mapContainerRef} className="map-gl-container" />

      {/* 2. Calque Vectoriel SVG Haute Performance pour les Lignes et Waypoints (sous les stations) */}
      <svg className="map-routes-svg-overlay">
        {renderedLines}
        {renderedWaypoints}
      </svg>

      {/* 3. Calque interactif des Stations : Points noirs simples positionnés AU-DESSUS des lignes */}
      <div className="map-stations-overlay">
        {renderedStops}
      </div>

      {/* 4. POPUP D'ÉDITION IN-PLACE DIRECTEMENT SUR L'ARRÊT */}
      {activeEditingStop && popupPixelPos && (
        <div
          className="inplace-stop-popup"
          style={{
            transform: `translate3d(${popupPixelPos.x}px, ${popupPixelPos.y}px, 0)`,
          }}
        >
          <div className="popup-card">
            <div className="popup-header">
              <span className="popup-title">Édition de l'Arrêt</span>
              <button
                type="button"
                className="popup-btn-icon close"
                onClick={() => setEditingStopId(null)}
                title="Fermer"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveStopName} className="popup-form">
              <div className="popup-input-row">
                <input
                  ref={stopInputRef}
                  type="text"
                  value={tempStopName}
                  onChange={(e) => setTempStopName(e.target.value)}
                  placeholder="Nom de la station..."
                  className="popup-name-input"
                  required
                />
                <button type="submit" className="popup-btn-icon submit" title="Valider le nom (Entrée)">
                  <Check size={15} />
                </button>
              </div>

              <div className="popup-actions-bar">
                <button
                  type="button"
                  className={`popup-toggle-transfer ${activeEditingStop.isTransfer ? 'active' : ''}`}
                  onClick={handleToggleTransfer}
                  title="Déclarer comme pôle de correspondance"
                >
                  <ArrowRightLeft size={12} />
                  <span>{activeEditingStop.isTransfer ? 'Correspondance ON' : 'Correspondance'}</span>
                </button>

                <button
                  type="button"
                  className="popup-btn-delete"
                  onClick={() => {
                    deleteStop(activeEditingStop.id);
                    setEditingStopId(null);
                  }}
                  title="Supprimer cet arrêt"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </form>
            <div className="popup-tail" />
          </div>
        </div>
      )}

      {/* 5. Barre d'état HUD */}
      <div className="map-hud-bar">
        <div className="hud-item">
          <Crosshair size={13} className="hud-icon" />
          <span>
            {cursorCoords
              ? `${cursorCoords.lat.toFixed(4)}° N, ${cursorCoords.lng.toFixed(4)}° E`
              : 'Survolez la carte'}
          </span>
        </div>
        <div className="hud-separator" />
        <div className="hud-item">
          <ZoomIn size={13} className="hud-icon" />
          <span>Zoom: {currentZoom}</span>
        </div>
      </div>
    </div>
  );
};
