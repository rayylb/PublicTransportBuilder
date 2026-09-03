import React, { useEffect, useRef, useState, useReducer, useCallback } from 'react';
import {
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  NavigationControl,
  FullscreenControl,
  ScaleControl,
  type MapMouseEvent,
} from 'maplibre-gl';
import { getBasemapStyle } from '../constants/basemaps';
import { useTransportStore } from '../store/useTransportStore';
import type { BasemapId, Coordinates } from '../types/transport';
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
  const mapInstanceRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, MapLibreMarker>>(new Map());

  // Force le rafraîchissement réactif du calque vectoriel SVG et du popover lors des mouvements de carte
  const [, forceMapUpdate] = useReducer((x) => x + 1, 0);

  const [cursorCoords, setCursorCoords] = useState<Coordinates | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(initialZoom);

  // Store Zustand
  const {
    stops,
    waypoints,
    lines,
    activeTool,
    activeLineId,
    selectedElement,
    editingStopId,
    showStationLabels,
    addStop,
    updateStop,
    deleteStop,
    createAndAppendWaypoint,
    setSelectedElement,
    setEditingStopId,
  } = useTransportStore();

  // État local pour le nom de l'arrêt en cours d'édition dans le popover
  const [tempStopName, setTempStopName] = useState('');
  const stopInputRef = useRef<HTMLInputElement | null>(null);

  // Synchroniser le nom temporaire quand l'arrêt à éditer change
  useEffect(() => {
    if (editingStopId && stops[editingStopId]) {
      setTempStopName(stops[editingStopId].name);
      setTimeout(() => {
        stopInputRef.current?.focus();
        stopInputRef.current?.select();
      }, 50);
    }
  }, [editingStopId, stops]);

  // Synchronisation des Marqueurs DOM pour les Arrêts (Stations)
  const syncStopMarkers = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentMarkers = markersRef.current;
    const currentStopIds = new Set(Object.keys(stops));

    // Supprimer les marqueurs d'arrêts supprimés
    for (const [id, marker] of currentMarkers.entries()) {
      if (!currentStopIds.has(id)) {
        marker.remove();
        currentMarkers.delete(id);
      }
    }

    // Créer ou actualiser chaque station
    for (const stop of Object.values(stops)) {
      const isSelected = selectedElement?.type === 'stop' && selectedElement.id === stop.id;
      const isTransfer = stop.isTransfer || stop.linesServed.length > 1;

      let marker = currentMarkers.get(stop.id);

      if (!marker) {
        const el = document.createElement('div');
        el.className = 'map-station-marker';
        el.innerHTML = `
          <div class="station-pin-circle ${isTransfer ? 'transfer' : 'standard'} ${isSelected ? 'selected' : ''}">
            <div class="station-inner-dot"></div>
          </div>
          <div class="station-pin-label ${!showStationLabels && !isSelected ? 'hidden-label' : ''}">${stop.name}</div>
        `;

        el.onclick = (e) => {
          e.stopPropagation();
          const state = useTransportStore.getState();
          if (state.activeTool === 'draw_line' && state.activeLineId) {
            state.appendStopToLine(state.activeLineId, stop.id);
          } else {
            state.setSelectedElement({ type: 'stop', id: stop.id });
            state.setEditingStopId(stop.id);
          }
        };

        marker = new MapLibreMarker({ element: el })
          .setLngLat([stop.coordinates.lng, stop.coordinates.lat])
          .addTo(map);

        currentMarkers.set(stop.id, marker);
      } else {
        // Mise à jour de la position GPS exacte
        marker.setLngLat([stop.coordinates.lng, stop.coordinates.lat]);

        // Mise à jour des classes et texte
        const el = marker.getElement();
        const circleEl = el.querySelector('.station-pin-circle');
        if (circleEl) {
          circleEl.className = `station-pin-circle ${isTransfer ? 'transfer' : 'standard'} ${isSelected ? 'selected' : ''}`;
        }
        const labelEl = el.querySelector('.station-pin-label');
        if (labelEl) {
          if (labelEl.textContent !== stop.name) {
            labelEl.textContent = stop.name;
          }
          if (showStationLabels || isSelected) {
            labelEl.classList.remove('hidden-label');
          } else {
            labelEl.classList.add('hidden-label');
          }
        }
      }
    }
  }, [stops, selectedElement, showStationLabels]);

  // Initialisation de la carte MapLibre
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: getBasemapStyle(activeBasemap),
      center: initialCenter,
      zoom: initialZoom,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new FullscreenControl(), 'top-right');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right');

    map.on('mousemove', (e) => {
      setCursorCoords({
        lng: Number(e.lngLat.lng.toFixed(5)),
        lat: Number(e.lngLat.lat.toFixed(5)),
      });
    });

    // Mettre à jour l'affichage SVG en temps réel lors du déplacement / zoom
    map.on('move', () => {
      forceMapUpdate();
    });

    map.on('zoom', () => {
      setCurrentZoom(Number(map.getZoom().toFixed(1)));
      forceMapUpdate();
    });

    map.on('resize', () => {
      forceMapUpdate();
    });

    map.on('load', () => {
      map.resize();
      syncStopMarkers();
      forceMapUpdate();
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Changement réactif du fond de carte
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map) {
      map.setStyle(getBasemapStyle(activeBasemap));
    }
  }, [activeBasemap]);

  // Synchronisation des marqueurs quand le store change
  useEffect(() => {
    syncStopMarkers();
    forceMapUpdate();
  }, [stops, waypoints, lines, selectedElement, activeLineId, showStationLabels, syncStopMarkers]);

  // Redimensionnement automatique de la carte
  useEffect(() => {
    const handleResize = () => {
      mapInstanceRef.current?.resize();
    };
    window.addEventListener('resize', handleResize);
    const timeout = setTimeout(handleResize, 100);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeout);
    };
  }, []);

  // Clic sur la carte pour poser un arrêt ou un waypoint
  useEffect(() => {
    const map = mapInstanceRef.current;
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
        createAndAppendWaypoint(activeLineId, coords);
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
    activeTool,
    activeLineId,
    addStop,
    createAndAppendWaypoint,
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

  // Calcul dynamique des tracés SVG pour chaque ligne de transport active
  const map = mapInstanceRef.current;

  const renderedLines = Object.values(lines)
    .filter((line) => line.isActive !== false) // Afficher uniquement les lignes visibles
    .map((line) => {
      if (!map) return null;

      const points: { x: number; y: number }[] = [];

      line.pathNodeIds.forEach((nodeId) => {
        const node = stops[nodeId] || waypoints[nodeId];
        if (node) {
          const projected = map.project([node.coordinates.lng, node.coordinates.lat]);
          points.push(projected);
        }
      });

      if (points.length < 2) return null;

      const pathData = `M ${points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}`;
      const isSelected = selectedElement?.type === 'line' && selectedElement.id === line.id;
      const isActive = activeLineId === line.id;

      return (
        <g key={line.id} className="svg-transit-line-group">
          {/* Sous-couche de contraste noir */}
          <path
            d={pathData}
            fill="none"
            stroke="#000000"
            strokeWidth={isSelected || isActive ? 9 : 7}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={0.85}
          />
          {/* Tracé coloré principal */}
          <path
            d={pathData}
            fill="none"
            stroke={line.color || '#0ea5e9'}
            strokeWidth={isSelected || isActive ? 5.5 : 4.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );
    });

  // Calcul dynamique des Waypoints (points de virage) en SVG pour les lignes visibles
  const renderedWaypoints = Object.values(waypoints)
    .filter((wp) => !wp.lineId || lines[wp.lineId]?.isActive !== false)
    .map((wp) => {
      if (!map) return null;
      const p = map.project([wp.coordinates.lng, wp.coordinates.lat]);

      return (
        <circle
          key={wp.id}
          cx={p.x}
          cy={p.y}
          r={4.5}
          fill="#ffffff"
          stroke="#0284c7"
          strokeWidth={2}
          className="svg-waypoint-dot"
        />
      );
    });

  // Position du Popover d'édition au-dessus de l'arrêt sélectionné
  const activeEditingStop = editingStopId && stops[editingStopId] ? stops[editingStopId] : null;
  const popupPixelPos = activeEditingStop && map
    ? map.project([activeEditingStop.coordinates.lng, activeEditingStop.coordinates.lat])
    : null;

  return (
    <div className="map-view-wrapper">
      {/* Conteneur MapLibre WebGL (Fond de carte raster / satellite) */}
      <div ref={mapContainerRef} className="map-gl-container" />

      {/* Calque Vectoriel SVG Haute Performance pour les Lignes et Waypoints */}
      <svg className="map-routes-svg-overlay">
        {renderedLines}
        {renderedWaypoints}
      </svg>

      {/* POPUP D'ÉDITION IN-PLACE DIRECTEMENT SUR L'ARRÊT */}
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

      {/* Barre d'état HUD */}
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
