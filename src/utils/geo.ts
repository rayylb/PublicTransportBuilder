import type {
  Coordinates,
  StopNode,
  TransportLine,
  WaypointNode,
  TraceEdge,
  SuiviEdge,
  TransferEdge,
  TransportGraph,
  TimeSlot,
} from '../types/transport';

/**
 * Calcule la distance orthodromique (formule de Haversine) en kilomètres entre deux coordonnées GPS
 */
export function calculateHaversineDistanceKm(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371; // Rayon moyen de la Terre en km
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.lat * Math.PI) / 180) *
      Math.cos((coord2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formate une distance en mètres ou kilomètres de manière lisible
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m`;
  }
  return `${distanceKm.toFixed(2)} km`;
}

/**
 * Formate une durée en minutes ou heures/minutes
 */
export function formatDuration(minutes: number): string {
  if (minutes < 1) {
    return '< 1 min';
  }
  const totalMins = Math.round(minutes);
  if (totalMins < 60) {
    return `${totalMins} min`;
  }
  const hours = Math.floor(totalMins / 60);
  const remainingMins = totalMins % 60;
  return `${hours}h ${remainingMins.toString().padStart(2, '0')}`;
}

/**
 * Retourne la fréquence en minutes pour une tranche horaire donnée
 */
export function getLineFrequencyForSlot(
  line: TransportLine,
  slot: TimeSlot = 'peak'
): number {
  switch (slot) {
    case 'peak':
      return line.peakFrequencyMinutes || line.frequencyMinutes || 5;
    case 'off_peak':
      return line.offPeakFrequencyMinutes || line.frequencyMinutes || 8;
    case 'night':
      return line.nightFrequencyMinutes || line.frequencyMinutes || 15;
    default:
      return line.frequencyMinutes || 6;
  }
}

export interface LineThermometerStopItem {
  stop: StopNode;
  nodeIndex: number;
  isTerminusStart: boolean;
  isTerminusEnd: boolean;
  segmentDistanceKm: number; // Distance depuis l'arrêt précédent (incluant les waypoints intermédiaires)
  intermediateWaypointsCount: number; // Nombre de virages géométriques entre l'arrêt précédent et celui-ci
  cumulativeDistanceKm: number; // Distance cumulée depuis le terminus de départ
  cumulativeDurationMinutes: number; // Temps de trajet estimé depuis le départ
  otherLinesServed: string[]; // Autres lignes passant par cette station
}

export interface LineMetrics {
  totalDistanceKm: number;
  totalDurationMinutes: number;
  stopsCount: number;
  waypointsCount: number;
  averageInterStationDistanceKm: number;
  thermometerStops: LineThermometerStopItem[];
  traceEdges: TraceEdge[];
  suiviEdges: SuiviEdge[];
}

/**
 * Calcule dynamiquement la durée estimée de parcours d'un tronçon en secondes
 * basée sur la distance et la vitesse commerciale de la ligne (+ 30s d'arrêt station)
 */
export function calculateTravelDurationSeconds(
  distanceKm: number,
  line: TransportLine
): number {
  const speed = line.averageSpeedKmh || (line.mode === 'metro' ? 30 : line.mode === 'tram' ? 22 : line.mode === 'train' ? 60 : 18);
  const dwellTimeSeconds = 30;
  const travelSeconds = (distanceKm / speed) * 3600;
  return Math.round(travelSeconds + dwellTimeSeconds);
}

/**
 * Calcule dynamiquement la durée estimée de parcours d'un tronçon en minutes
 */
export function calculateTravelDurationMinutes(
  distanceKm: number,
  line: TransportLine
): number {
  return calculateTravelDurationSeconds(distanceKm, line) / 60;
}

/**
 * Calcule l'intégralité des métriques géométriques, la séquence du thermomètre et les arêtes (TRACE & SUIVI) d'une ligne
 */
export function calculateLineMetrics(
  line: TransportLine,
  stops: Record<string, StopNode>,
  waypoints: Record<string, WaypointNode>
): LineMetrics {
  const pathIds = line.pathNodeIds;
  const speedKmh = line.averageSpeedKmh || 20;
  const stopDwellMinutes = 0.5; // 30 secondes d'arrêt en station
  const isBidirectional = line.isBidirectional !== false;

  // 1. Calculer les arêtes TRACE (segments physiques consécutifs pour l'affichage)
  const traceEdges: TraceEdge[] = [];
  let totalDistanceKm = 0;

  for (let i = 0; i < pathIds.length - 1; i++) {
    const fromId = pathIds[i];
    const toId = pathIds[i + 1];
    const fromNode = stops[fromId] || waypoints[fromId];
    const toNode = stops[toId] || waypoints[toId];

    if (fromNode && toNode) {
      const segDistKm = calculateHaversineDistanceKm(
        fromNode.coordinates,
        toNode.coordinates
      );
      totalDistanceKm += segDistKm;

      traceEdges.push({
        id: `trace_${line.id}_${fromId}_${toId}_${i}`,
        type: 'TRACE',
        lineId: line.id,
        sourceNodeId: fromId,
        targetNodeId: toId,
        orderIndex: i,
        distanceMeters: Math.round(segDistKm * 1000),
        distanceKm: segDistKm,
      });
    }
  }

  // 2. Extraire la séquence ordonnée des arrêts commerciaux et générer les arêtes SUIVI
  const thermometerStops: LineThermometerStopItem[] = [];
  const suiviEdges: SuiviEdge[] = [];
  let currentCumulativeDistanceKm = 0;
  let lastStopPathIndex = -1;
  let lastStopId: string | null = null;
  let suiviOrder = 0;

  for (let i = 0; i < pathIds.length; i++) {
    const nodeId = pathIds[i];
    const stop = stops[nodeId];

    if (stop) {
      let segmentDistanceKm = 0;
      let intermediateWaypointsCount = 0;

      if (lastStopPathIndex !== -1 && lastStopId) {
        // Additionner tous les segments géométriques (y compris virages/waypoints) entre lastStopPathIndex et i
        for (let j = lastStopPathIndex; j < i; j++) {
          const fromNode = stops[pathIds[j]] || waypoints[pathIds[j]];
          const toNode = stops[pathIds[j + 1]] || waypoints[pathIds[j + 1]];
          if (fromNode && toNode) {
            segmentDistanceKm += calculateHaversineDistanceKm(
              fromNode.coordinates,
              toNode.coordinates
            );
          }
          if (j > lastStopPathIndex && waypoints[pathIds[j]]) {
            intermediateWaypointsCount++;
          }
        }

        const distanceMeters = Math.round(segmentDistanceKm * 1000);

        // Arête SUIVI sens ALLER (forward)
        suiviEdges.push({
          id: `suivi_${line.id}_${lastStopId}_${stop.id}_fwd_${suiviOrder}`,
          type: 'SUIVI',
          lineId: line.id,
          sourceStationId: lastStopId,
          targetStationId: stop.id,
          direction: 'forward',
          orderIndex: suiviOrder,
          distanceMeters,
          distanceKm: segmentDistanceKm,
          intermediateWaypointsCount,
        });

        // Arête SUIVI sens RETOUR (backward) si la ligne est bidirectionnelle
        if (isBidirectional) {
          suiviEdges.push({
            id: `suivi_${line.id}_${stop.id}_${lastStopId}_bwd_${suiviOrder}`,
            type: 'SUIVI',
            lineId: line.id,
            sourceStationId: stop.id,
            targetStationId: lastStopId,
            direction: 'backward',
            orderIndex: suiviOrder,
            distanceMeters,
            distanceKm: segmentDistanceKm,
            intermediateWaypointsCount,
          });
        }

        suiviOrder++;
      }

      currentCumulativeDistanceKm += segmentDistanceKm;

      // Calcul de la durée cumulée estimée pour l'affichage thermomètre
      const travelTimeMinutes = (currentCumulativeDistanceKm / speedKmh) * 60;
      const cumulativeDurationMinutes =
        thermometerStops.length > 0
          ? travelTimeMinutes + thermometerStops.length * stopDwellMinutes
          : 0;

      const otherLinesServed = stop.linesServed.filter((lId) => lId !== line.id);

      thermometerStops.push({
        stop,
        nodeIndex: i,
        isTerminusStart: thermometerStops.length === 0,
        isTerminusEnd: false, // sera mis à jour à la fin
        segmentDistanceKm,
        intermediateWaypointsCount,
        cumulativeDistanceKm: currentCumulativeDistanceKm,
        cumulativeDurationMinutes,
        otherLinesServed,
      });

      lastStopPathIndex = i;
      lastStopId = stop.id;
    }
  }

  // Marquer le dernier arrêt comme terminus de fin
  if (thermometerStops.length > 0) {
    thermometerStops[thermometerStops.length - 1].isTerminusEnd = true;
  }

  const stopsCount = thermometerStops.length;
  const waypointsCount = pathIds.filter((id) => waypoints[id]).length;
  const averageInterStationDistanceKm =
    stopsCount > 1 ? totalDistanceKm / (stopsCount - 1) : 0;

  const totalDurationMinutes =
    stopsCount > 0
      ? (totalDistanceKm / speedKmh) * 60 + Math.max(0, stopsCount - 1) * stopDwellMinutes
      : 0;

  return {
    totalDistanceKm,
    totalDurationMinutes,
    stopsCount,
    waypointsCount,
    averageInterStationDistanceKm,
    thermometerStops,
    traceEdges,
    suiviEdges,
  };
}

/**
 * Construit la structure complète du Property Graph du réseau
 * avec l'ensemble des Nœuds (Stations, Waypoints, Lignes)
 * et des Arêtes (TRACE, SUIVI, TRANSFER).
 */
export function buildTransportGraph(
  lines: Record<string, TransportLine>,
  stops: Record<string, StopNode>,
  waypoints: Record<string, WaypointNode>
): TransportGraph {
  const allTraceEdges: TraceEdge[] = [];
  const allSuiviEdges: SuiviEdge[] = [];
  const allTransferEdges: TransferEdge[] = [];

  // 1. Générer les arêtes TRACE et SUIVI pour chaque ligne active
  Object.values(lines).forEach((line) => {
    if (line.isActive === false) return;
    const metrics = calculateLineMetrics(line, stops, waypoints);
    allTraceEdges.push(...metrics.traceEdges);
    allSuiviEdges.push(...metrics.suiviEdges);
  });

  // 2. Générer les arêtes de correspondance (TRANSFER) pour les stations multi-lignes
  Object.values(stops).forEach((stop) => {
    if (stop.isTransfer || stop.linesServed.length > 1) {
      allTransferEdges.push({
        id: `transfer_${stop.id}`,
        type: 'TRANSFER',
        sourceStationId: stop.id,
        targetStationId: stop.id,
        distanceMeters: 50,
        durationSeconds: stop.transferDurationSec || 120,
      });
    }
  });

  return {
    nodes: {
      stations: stops,
      waypoints,
      lines,
    },
    edges: {
      traceEdges: allTraceEdges,
      suiviEdges: allSuiviEdges,
      transferEdges: allTransferEdges,
    },
  };
}
