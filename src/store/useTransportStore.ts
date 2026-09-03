import { create } from 'zustand';
import type {
  StopNode,
  WaypointNode,
  TransportLine,
  Coordinates,
  TransportMode,
} from '../types/transport';

export type ToolType = 'select' | 'add_stop' | 'draw_line';

export interface SelectedElement {
  type: 'stop' | 'line' | 'waypoint';
  id: string;
}

interface TransportStoreState {
  stops: Record<string, StopNode>;
  waypoints: Record<string, WaypointNode>;
  lines: Record<string, TransportLine>;

  activeTool: ToolType;
  activeLineId: string | null;
  drawingEnd: 'start' | 'end'; // 'start' = prolonger en tête (Départ), 'end' = prolonger en fin (Terminus)
  selectedElement: SelectedElement | null;
  editingStopId: string | null;
  showStationLabels: boolean;

  setActiveTool: (tool: ToolType) => void;
  setActiveLineId: (lineId: string | null) => void;
  setDrawingEnd: (end: 'start' | 'end') => void;
  setSelectedElement: (element: SelectedElement | null) => void;
  setEditingStopId: (id: string | null) => void;
  toggleShowStationLabels: () => void;
  toggleLineVisibility: (lineId: string) => void;

  addStop: (coords: Coordinates, customName?: string) => string;
  updateStop: (id: string, updates: Partial<Omit<StopNode, 'id' | 'type'>>) => void;
  deleteStop: (id: string) => void;

  createLine: (params: {
    name: string;
    shortName: string;
    color: string;
    mode: TransportMode;
  }) => string;
  updateLine: (id: string, updates: Partial<Omit<TransportLine, 'id'>>) => void;
  deleteLine: (id: string) => void;

  appendStopToLine: (lineId: string, stopId: string) => void;
  prependStopToLine: (lineId: string, stopId: string) => void;
  insertStopInLine: (lineId: string, stopId: string, atIndex: number) => void;
  createAndAppendWaypoint: (lineId: string, coords: Coordinates) => string;
  createAndPrependWaypoint: (lineId: string, coords: Coordinates) => string;
  removeNodeFromLine: (lineId: string, nodeIndex: number) => void;
  reverseLinePath: (lineId: string) => void;

  loadSampleData: () => void;
  clearAll: () => void;
}

const generateId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

export const useTransportStore = create<TransportStoreState>((set, get) => ({
  stops: {},
  waypoints: {},
  lines: {},
  activeTool: 'select',
  activeLineId: null,
  drawingEnd: 'end',
  selectedElement: null,
  editingStopId: null,
  showStationLabels: true,

  setActiveTool: (tool) => set({ activeTool: tool }),

  setActiveLineId: (lineId) => set({ activeLineId: lineId }),

  setDrawingEnd: (end) => set({ drawingEnd: end }),

  setSelectedElement: (element) =>
    set({
      selectedElement: element,
      editingStopId: element?.type === 'stop' ? element.id : null,
    }),

  setEditingStopId: (id) => set({ editingStopId: id }),

  toggleShowStationLabels: () =>
    set((state) => ({ showStationLabels: !state.showStationLabels })),

  toggleLineVisibility: (lineId) =>
    set((state) => {
      const line = state.lines[lineId];
      if (!line) return state;
      return {
        lines: {
          ...state.lines,
          [lineId]: { ...line, isActive: !line.isActive },
        },
      };
    }),

  addStop: (coords, customName) => {
    const id = generateId('stop');
    const stopCount = Object.keys(get().stops).length + 1;
    const name = customName || `Arrêt ${stopCount}`;

    const newStop: StopNode = {
      id,
      type: 'stop',
      name,
      code: `ST-${stopCount.toString().padStart(2, '0')}`,
      coordinates: coords,
      isTransfer: false,
      linesServed: [],
      transferDurationSec: 120,
      createdAt: Date.now(),
    };

    set((state) => ({
      stops: { ...state.stops, [id]: newStop },
      editingStopId: id,
      selectedElement: { type: 'stop', id },
    }));

    return id;
  },

  updateStop: (id, updates) => {
    set((state) => {
      const existing = state.stops[id];
      if (!existing) return state;
      return {
        stops: {
          ...state.stops,
          [id]: { ...existing, ...updates },
        },
      };
    });
  },

  deleteStop: (id) => {
    set((state) => {
      const newStops = { ...state.stops };
      delete newStops[id];

      const newLines = { ...state.lines };
      Object.keys(newLines).forEach((lineId) => {
        newLines[lineId] = {
          ...newLines[lineId],
          pathNodeIds: newLines[lineId].pathNodeIds.filter((nodeId) => nodeId !== id),
        };
      });

      return {
        stops: newStops,
        lines: newLines,
        editingStopId: state.editingStopId === id ? null : state.editingStopId,
        selectedElement: state.selectedElement?.id === id ? null : state.selectedElement,
      };
    });
  },

  createLine: ({ name, shortName, color, mode }) => {
    const id = generateId('line');
    const newLine: TransportLine = {
      id,
      name,
      shortName,
      color,
      mode,
      isActive: true,
      averageSpeedKmh: mode === 'metro' ? 30 : mode === 'tram' ? 22 : mode === 'train' ? 60 : 18,
      frequencyMinutes: mode === 'metro' ? 4 : 6,
      pathNodeIds: [],
    };

    set((state) => ({
      lines: { ...state.lines, [id]: newLine },
      activeLineId: id,
      activeTool: 'draw_line',
      drawingEnd: 'end',
      selectedElement: { type: 'line', id },
    }));

    return id;
  },

  updateLine: (id, updates) => {
    set((state) => {
      const existing = state.lines[id];
      if (!existing) return state;
      return {
        lines: {
          ...state.lines,
          [id]: { ...existing, ...updates },
        },
      };
    });
  },

  deleteLine: (id) => {
    set((state) => {
      const newLines = { ...state.lines };
      delete newLines[id];

      const newWaypoints = { ...state.waypoints };
      Object.keys(newWaypoints).forEach((wpId) => {
        if (newWaypoints[wpId].lineId === id) {
          delete newWaypoints[wpId];
        }
      });

      const newStops = { ...state.stops };
      Object.keys(newStops).forEach((stopId) => {
        newStops[stopId] = {
          ...newStops[stopId],
          linesServed: newStops[stopId].linesServed.filter((lId) => lId !== id),
        };
      });

      return {
        lines: newLines,
        waypoints: newWaypoints,
        stops: newStops,
        activeLineId: state.activeLineId === id ? null : state.activeLineId,
        selectedElement: state.selectedElement?.id === id ? null : state.selectedElement,
      };
    });
  },

  // Ajouter un arrêt à la fin de la ligne (Terminus / Aval)
  appendStopToLine: (lineId, stopId) => {
    set((state) => {
      const line = state.lines[lineId];
      const stop = state.stops[stopId];
      if (!line || !stop) return state;

      const lastNodeId = line.pathNodeIds[line.pathNodeIds.length - 1];
      if (lastNodeId === stopId) return state;

      const updatedPath = [...line.pathNodeIds, stopId];
      const updatedLinesServed = stop.linesServed.includes(lineId)
        ? stop.linesServed
        : [...stop.linesServed, lineId];

      return {
        lines: {
          ...state.lines,
          [lineId]: { ...line, pathNodeIds: updatedPath },
        },
        stops: {
          ...state.stops,
          [stopId]: {
            ...stop,
            linesServed: updatedLinesServed,
            isTransfer: updatedLinesServed.length > 1,
          },
        },
      };
    });
  },

  // Ajouter un arrêt au début de la ligne (Départ / Amont / Tête de ligne)
  prependStopToLine: (lineId, stopId) => {
    set((state) => {
      const line = state.lines[lineId];
      const stop = state.stops[stopId];
      if (!line || !stop) return state;

      const firstNodeId = line.pathNodeIds[0];
      if (firstNodeId === stopId) return state;

      const updatedPath = [stopId, ...line.pathNodeIds];
      const updatedLinesServed = stop.linesServed.includes(lineId)
        ? stop.linesServed
        : [...stop.linesServed, lineId];

      return {
        lines: {
          ...state.lines,
          [lineId]: { ...line, pathNodeIds: updatedPath },
        },
        stops: {
          ...state.stops,
          [stopId]: {
            ...stop,
            linesServed: updatedLinesServed,
            isTransfer: updatedLinesServed.length > 1,
          },
        },
      };
    });
  },

  // Insérer un arrêt à un index spécifique
  insertStopInLine: (lineId, stopId, atIndex) => {
    set((state) => {
      const line = state.lines[lineId];
      const stop = state.stops[stopId];
      if (!line || !stop) return state;

      const updatedPath = [...line.pathNodeIds];
      updatedPath.splice(atIndex, 0, stopId);

      const updatedLinesServed = stop.linesServed.includes(lineId)
        ? stop.linesServed
        : [...stop.linesServed, lineId];

      return {
        lines: {
          ...state.lines,
          [lineId]: { ...line, pathNodeIds: updatedPath },
        },
        stops: {
          ...state.stops,
          [stopId]: {
            ...stop,
            linesServed: updatedLinesServed,
            isTransfer: updatedLinesServed.length > 1,
          },
        },
      };
    });
  },

  // Créer un point de virage à la fin de la ligne
  createAndAppendWaypoint: (lineId, coords) => {
    const line = get().lines[lineId];
    if (!line) return '';

    const wpId = generateId('wp');
    const order = line.pathNodeIds.length;

    const newWaypoint: WaypointNode = {
      id: wpId,
      type: 'waypoint',
      coordinates: coords,
      lineId,
      order,
      createdAt: Date.now(),
    };

    set((state) => {
      const targetLine = state.lines[lineId];
      if (!targetLine) return state;

      return {
        waypoints: { ...state.waypoints, [wpId]: newWaypoint },
        lines: {
          ...state.lines,
          [lineId]: {
            ...targetLine,
            pathNodeIds: [...targetLine.pathNodeIds, wpId],
          },
        },
      };
    });

    return wpId;
  },

  // Créer un point de virage au début de la ligne (en tête)
  createAndPrependWaypoint: (lineId, coords) => {
    const line = get().lines[lineId];
    if (!line) return '';

    const wpId = generateId('wp');

    const newWaypoint: WaypointNode = {
      id: wpId,
      type: 'waypoint',
      coordinates: coords,
      lineId,
      order: 0,
      createdAt: Date.now(),
    };

    set((state) => {
      const targetLine = state.lines[lineId];
      if (!targetLine) return state;

      return {
        waypoints: { ...state.waypoints, [wpId]: newWaypoint },
        lines: {
          ...state.lines,
          [lineId]: {
            ...targetLine,
            pathNodeIds: [wpId, ...targetLine.pathNodeIds],
          },
        },
      };
    });

    return wpId;
  },

  removeNodeFromLine: (lineId, nodeIndex) => {
    set((state) => {
      const line = state.lines[lineId];
      if (!line) return state;

      const nodeIdToRemove = line.pathNodeIds[nodeIndex];
      const updatedPath = line.pathNodeIds.filter((_, idx) => idx !== nodeIndex);

      const newWaypoints = { ...state.waypoints };
      if (nodeIdToRemove && newWaypoints[nodeIdToRemove]) {
        delete newWaypoints[nodeIdToRemove];
      }

      return {
        lines: {
          ...state.lines,
          [lineId]: { ...line, pathNodeIds: updatedPath },
        },
        waypoints: newWaypoints,
      };
    });
  },

  // Inverser l'ordre du tracé de la ligne (Départ ↔ Terminus)
  reverseLinePath: (lineId) => {
    set((state) => {
      const line = state.lines[lineId];
      if (!line) return state;

      return {
        lines: {
          ...state.lines,
          [lineId]: {
            ...line,
            pathNodeIds: [...line.pathNodeIds].reverse(),
          },
        },
      };
    });
  },

  loadSampleData: () => {
    const s1: StopNode = { id: 'stop_1', type: 'stop', name: 'Gare Centrale', code: 'GC-01', coordinates: { lng: 2.3522, lat: 48.8566 }, isTransfer: true, linesServed: ['line_t1', 'line_b2'], transferDurationSec: 120, createdAt: 1 };
    const s2: StopNode = { id: 'stop_2', type: 'stop', name: 'Place de la République', code: 'REP', coordinates: { lng: 2.3634, lat: 48.8675 }, isTransfer: true, linesServed: ['line_t1', 'line_b2'], transferDurationSec: 90, createdAt: 2 };
    const s3: StopNode = { id: 'stop_3', type: 'stop', name: 'Parc des Expositions', code: 'PEX', coordinates: { lng: 2.3850, lat: 48.8750 }, isTransfer: false, linesServed: ['line_t1'], transferDurationSec: 60, createdAt: 3 };
    const s4: StopNode = { id: 'stop_4', type: 'stop', name: 'Université Campus', code: 'UNI', coordinates: { lng: 2.3488, lat: 48.8462 }, isTransfer: false, linesServed: ['line_b2'], transferDurationSec: 60, createdAt: 4 };

    const wp1: WaypointNode = { id: 'wp_1', type: 'waypoint', coordinates: { lng: 2.3580, lat: 48.8620 }, lineId: 'line_t1', order: 1, createdAt: 5 };

    const lineT1: TransportLine = {
      id: 'line_t1',
      name: 'Tramway T1 - Est/Ouest',
      shortName: 'T1',
      color: '#0ea5e9',
      mode: 'tram',
      isActive: true,
      averageSpeedKmh: 22,
      frequencyMinutes: 5,
      pathNodeIds: ['stop_1', 'wp_1', 'stop_2', 'stop_3'],
    };

    const lineB2: TransportLine = {
      id: 'line_b2',
      name: 'Bus Express B2 - Campus',
      shortName: 'B2',
      color: '#f59e0b',
      mode: 'bus',
      isActive: true,
      averageSpeedKmh: 18,
      frequencyMinutes: 8,
      pathNodeIds: ['stop_4', 'stop_1', 'wp_1', 'stop_2'],
    };

    set({
      stops: { stop_1: s1, stop_2: s2, stop_3: s3, stop_4: s4 },
      waypoints: { wp_1: wp1 },
      lines: { line_t1: lineT1, line_b2: lineB2 },
      activeTool: 'select',
      activeLineId: 'line_t1',
      drawingEnd: 'end',
      selectedElement: null,
      editingStopId: null,
      showStationLabels: true,
    });
  },

  clearAll: () => {
    set({
      stops: {},
      waypoints: {},
      lines: {},
      activeTool: 'select',
      activeLineId: null,
      drawingEnd: 'end',
      selectedElement: null,
      editingStopId: null,
      showStationLabels: true,
    });
  },
}));
