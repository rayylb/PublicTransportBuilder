import type { Coordinates, StopNode, TransportLine, WaypointNode } from '../types/transport';

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
}

/**
 * Calcule l'intégralité des métriques géométriques et la séquence du thermomètre d'une ligne
 */
export function calculateLineMetrics(
  line: TransportLine,
  stops: Record<string, StopNode>,
  waypoints: Record<string, WaypointNode>
): LineMetrics {
  const pathIds = line.pathNodeIds;
  const speedKmh = line.averageSpeedKmh || 20;
  const stopDwellMinutes = 0.5; // 30 secondes d'arrêt en station

  // 1. Calculer la distance totale de tous les segments consécutifs du tracé
  let totalDistanceKm = 0;
  for (let i = 0; i < pathIds.length - 1; i++) {
    const fromNode = stops[pathIds[i]] || waypoints[pathIds[i]];
    const toNode = stops[pathIds[i + 1]] || waypoints[pathIds[i + 1]];
    if (fromNode && toNode) {
      totalDistanceKm += calculateHaversineDistanceKm(
        fromNode.coordinates,
        toNode.coordinates
      );
    }
  }

  // 2. Extraire la séquence ordonnée des arrêts commerciaux avec les distances inter-arrêts
  const thermometerStops: LineThermometerStopItem[] = [];
  let currentCumulativeDistanceKm = 0;
  let lastStopPathIndex = -1;

  for (let i = 0; i < pathIds.length; i++) {
    const nodeId = pathIds[i];
    const stop = stops[nodeId];

    if (stop) {
      let segmentDistanceKm = 0;
      let intermediateWaypointsCount = 0;

      if (lastStopPathIndex !== -1) {
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
      }

      currentCumulativeDistanceKm += segmentDistanceKm;

      // Calcul de la durée cumulée estimée : (distance / vitesse) * 60 + temps d'attente en station
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
  };
}
