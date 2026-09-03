import type { TransportLine, StopNode, WaypointNode } from '../types/transport';

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface ComputedLineSegmentPath {
  lineId: string;
  pathData: string;
  color: string;
  shortName: string;
  name: string;
}

const OFFSET_STEP_PX = 6.0; // Décalage parallèle en pixels entre deux lignes sur un tronçon partagé
const MAX_MITER_FACTOR = 1.6; // Facteur max pour éviter les pointes excessives aux virages aigus

/**
 * Calcule les tracés SVG géométriques décalés en parallèle pour toutes les lignes actives.
 * Quand 2 ou plusieurs lignes partagent le même tronçon (mêmes arrêts/waypoints adjacents),
 * elles sont automatiquement tracées côte à côte en parallèle sans se chevaucher.
 */
export function computeParallelTransitLines(
  lines: Record<string, TransportLine>,
  stops: Record<string, StopNode>,
  waypoints: Record<string, WaypointNode>,
  project: (coords: [number, number]) => { x: number; y: number }
): Record<string, string> {
  const activeLines = Object.values(lines).filter(
    (l) => l.isActive !== false && l.pathNodeIds.length >= 2
  );

  if (activeLines.length === 0) return {};

  // 1. Indexation des tronçons (edges) partagés par les lignes
  // Clé canonique pour deux nœuds u et v : "minNode::maxNode"
  const edgeLinesMap: Record<string, string[]> = {};

  activeLines.forEach((line) => {
    for (let i = 0; i < line.pathNodeIds.length - 1; i++) {
      const u = line.pathNodeIds[i];
      const v = line.pathNodeIds[i + 1];
      if (!u || !v || u === v) continue;

      const edgeKey = u < v ? `${u}::${v}` : `${v}::${u}`;
      if (!edgeLinesMap[edgeKey]) {
        edgeLinesMap[edgeKey] = [];
      }
      if (!edgeLinesMap[edgeKey].includes(line.id)) {
        edgeLinesMap[edgeKey].push(line.id);
      }
    }
  });

  // Trier les IDs de lignes sur chaque tronçon pour garantir un ordre stable et déterministe
  Object.keys(edgeLinesMap).forEach((edgeKey) => {
    edgeLinesMap[edgeKey].sort((a, b) => {
      const lineA = lines[a];
      const lineB = lines[b];
      return (lineA?.name || a).localeCompare(lineB?.name || b);
    });
  });

  // 2. Calcul des coordonnées projetées pour chaque nœud utilisé
  const nodePixelMap: Record<string, ScreenPoint> = {};
  const getNodePixel = (nodeId: string): ScreenPoint | null => {
    if (nodePixelMap[nodeId]) return nodePixelMap[nodeId];
    const node = stops[nodeId] || waypoints[nodeId];
    if (!node) return null;
    const p = project([node.coordinates.lng, node.coordinates.lat]);
    nodePixelMap[nodeId] = p;
    return p;
  };

  // 3. Calcul des décalages parallèles pour chaque ligne
  const resultSvgPaths: Record<string, string> = {};

  activeLines.forEach((line) => {
    const nodeIds = line.pathNodeIds;
    const n = nodeIds.length;
    if (n < 2) return;

    // Récupérer les points projetés valides
    const rawPoints: (ScreenPoint | null)[] = nodeIds.map(getNodePixel);
    const segmentOffsets: ScreenPoint[] = [];

    // Calculer le vecteur de décalage normal pour chaque segment i -> i+1
    for (let i = 0; i < n - 1; i++) {
      const u = nodeIds[i];
      const v = nodeIds[i + 1];
      const pU = rawPoints[i];
      const pV = rawPoints[i + 1];

      if (!pU || !pV || !u || !v) {
        segmentOffsets.push({ x: 0, y: 0 });
        continue;
      }

      const edgeKey = u < v ? `${u}::${v}` : `${v}::${u}`;
      const sharingLines = edgeLinesMap[edgeKey] || [line.id];
      const lineCount = sharingLines.length;

      if (lineCount <= 1) {
        segmentOffsets.push({ x: 0, y: 0 });
        continue;
      }

      const lineIndex = sharingLines.indexOf(line.id);
      const shiftDistance = (lineIndex - (lineCount - 1) / 2) * OFFSET_STEP_PX;

      // Calcul du vecteur normal canonique basé sur canonicalStart -> canonicalEnd
      const canonicalStart = u < v ? pU : pV;
      const canonicalEnd = u < v ? pV : pU;

      const dx = canonicalEnd.x - canonicalStart.x;
      const dy = canonicalEnd.y - canonicalStart.y;
      const len = Math.sqrt(dx * dx + dy * dy);

      if (len < 0.001) {
        segmentOffsets.push({ x: 0, y: 0 });
      } else {
        // Normale perpendiculaire unitaire (-dy / len, dx / len)
        const nx = -dy / len;
        const ny = dx / len;
        segmentOffsets.push({
          x: nx * shiftDistance,
          y: ny * shiftDistance,
        });
      }
    }

    // Calculer les points finaux décalés pour chaque sommet du tracé
    const finalShiftedPoints: ScreenPoint[] = [];

    for (let i = 0; i < n; i++) {
      const basePoint = rawPoints[i];
      if (!basePoint) continue;

      let offsetX = 0;
      let offsetY = 0;

      if (i === 0) {
        // Premier sommet : décalage du premier segment
        const sNext = segmentOffsets[0] || { x: 0, y: 0 };
        offsetX = sNext.x;
        offsetY = sNext.y;
      } else if (i === n - 1) {
        // Dernier sommet : décalage du dernier segment
        const sPrev = segmentOffsets[n - 2] || { x: 0, y: 0 };
        offsetX = sPrev.x;
        offsetY = sPrev.y;
      } else {
        // Sommet intermédiaire : moyenne pondérée / miter des décalages adjacent
        const sPrev = segmentOffsets[i - 1] || { x: 0, y: 0 };
        const sNext = segmentOffsets[i] || { x: 0, y: 0 };

        offsetX = (sPrev.x + sNext.x) / 2;
        offsetY = (sPrev.y + sNext.y) / 2;

        // Limiter l'amplitude pour éviter les pointes aberrantes lors de virages serrés
        const maxShift = Math.max(
          Math.sqrt(sPrev.x * sPrev.x + sPrev.y * sPrev.y),
          Math.sqrt(sNext.x * sNext.x + sNext.y * sNext.y)
        ) * MAX_MITER_FACTOR;

        const currentLen = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
        if (currentLen > maxShift && currentLen > 0.001) {
          const factor = maxShift / currentLen;
          offsetX *= factor;
          offsetY *= factor;
        }
      }

      finalShiftedPoints.push({
        x: Number((basePoint.x + offsetX).toFixed(1)),
        y: Number((basePoint.y + offsetY).toFixed(1)),
      });
    }

    if (finalShiftedPoints.length >= 2) {
      const pathString = `M ${finalShiftedPoints.map((p) => `${p.x},${p.y}`).join(' L ')}`;
      resultSvgPaths[line.id] = pathString;
    }
  });

  return resultSvgPaths;
}
