/**
 * Types TypeScript fondamentaux pour la modélisation du réseau de transport
 * et la structure en Property Graph.
 */

// Format standard géographique (GeoJSON standard : Longitude en premier, Latitude en second)
export interface Coordinates {
  lng: number;
  lat: number;
}

// Modes de transport supportés
export type TransportMode = 'bus' | 'tram' | 'metro' | 'train' | 'cable_car';

// Type discriminant pour les nœuds cartographiques
export type NodeType = 'stop' | 'waypoint';

/**
 * Interface de base pour tout point situé sur la carte
 */
export interface BaseNode {
  id: string;             // Identifiant unique (UUID ou préfixe 'stop_', 'wp_')
  type: NodeType;         // 'stop' ou 'waypoint'
  coordinates: Coordinates;
  createdAt: number;
}

/**
 * Nœud représentant un Arrêt / Station commerciale de transport
 * (Point où des passagers montent et descendent)
 */
export interface StopNode extends BaseNode {
  type: 'stop';
  name: string;           // Ex: "Gare Centrale"
  code?: string;          // Ex: "GC-01"
  isTransfer: boolean;    // Est-ce un pôle d'échange / correspondance ?
  linesServed: string[];  // Liste des IDs de lignes passant par cet arrêt
  transferDurationSec?: number; // Temps moyen de correspondance à pied (défaut: 120s)
  fareZone?: number;      // Zone tarifaire (ex: 1, 2)
  isAccessiblePMR?: boolean; // Accessibilité PMR / Fauteuil roulant
}

/**
 * Nœud géométrique intermédiaire (Waypoint)
 * (Permet de courber une ligne le long d'une route/voie ferrée sans arrêt commercial)
 */
export interface WaypointNode extends BaseNode {
  type: 'waypoint';
  lineId: string;         // Ligne à laquelle ce point de tracé appartient
  order: number;          // Position ordonnée dans la séquence de tracé de la ligne
}

/**
 * Modélisation d'une Ligne de transport (Nœud Ligne dans le Property Graph)
 */
export interface TransportLine {
  id: string;               // Ex: "line_tram_1"
  name: string;             // Ex: "Ligne 1 - Universités <-> Gare"
  shortName: string;        // Ex: "T1"
  color: string;            // Couleur hexadécimale (Ex: "#3b82f6")
  mode: TransportMode;      // Catégorie / mode de transport (tram, metro, bus, train, cable_car)
  category?: TransportMode;  // Alias optionnel pour mode
  isActive: boolean;        // Visibilité sur la carte
  averageSpeedKmh: number;  // Vitesse commerciale moyenne en km/h

  // Fréquences modulées selon les tranches horaires (en minutes)
  peakFrequencyMinutes: number;    // Fréquence en Heures de pointe (ex: 3-5 min)
  offPeakFrequencyMinutes: number; // Fréquence en Heures creuses (ex: 7-10 min)
  nightFrequencyMinutes: number;   // Fréquence en Soirée & Nuit (ex: 15-20 min)

  // Amplitude horaire & Exploitation
  firstDeparture?: string;         // Premier départ (ex: "05:30")
  lastDeparture?: string;          // Dernier départ (ex: "01:00")
  isBidirectional?: boolean;       // Circule dans les deux sens (true par défaut)
  isAccessiblePMR?: boolean;       // Matériel roulant accessible PMR (true par défaut)

  frequencyMinutes?: number;       // Rétrocompatibilité (fréquence indicative)

  // Séquence ordonnée de tous les IDs de nœuds (stops + waypoints) formant le tracé
  pathNodeIds: string[];
}

/**
 * Tranche horaire pour le calcul d'itinéraire et d'attente
 */
export type TimeSlot = 'peak' | 'off_peak' | 'night';

/**
 * Nœud Station (alias de StopNode pour la terminologie Property Graph)
 */
export type StationNode = StopNode;

/**
 * Arête TRACE (Rendu cartographique et géométrie séquentielle)
 * Relie deux nœuds consécutifs du tracé physique d'une ligne (Station/Waypoint <-> Station/Waypoint)
 */
export interface TraceEdge {
  id: string;             // Ex: "trace_line1_stop1_wp1"
  type: 'TRACE';
  lineId: string;         // Ligne concernée
  sourceNodeId: string;   // ID du nœud de départ (station ou waypoint)
  targetNodeId: string;   // ID du nœud d'arrivée (station ou waypoint)
  orderIndex: number;     // Index séquentiel dans le tracé de la ligne
  distanceMeters: number; // Distance géodésique réelle en mètres
  distanceKm: number;     // Distance géodésique en kilomètres
}

/**
 * Arête SUIVI (Topologie commerciale et calcul d'itinéraire)
 * Relie directement deux stations consécutives d'une ligne en sautant les waypoints intermédiaires.
 * La durée n'est pas stockée en dur : elle est calculée dynamiquement à partir de distanceKm et de la vitesse de la ligne.
 */
export interface SuiviEdge {
  id: string;                       // Ex: "suivi_line1_stop1_stop2_fwd"
  type: 'SUIVI';
  lineId: string;                   // Ligne concernée
  sourceStationId: string;          // ID de la station de départ
  targetStationId: string;          // ID de la station d'arrivée
  direction: 'forward' | 'backward'; // Sens de circulation (aller ou retour)
  orderIndex: number;               // Index de succession inter-stations
  distanceMeters: number;           // Distance totale cumulée en mètres (incluant les virages waypoints)
  distanceKm: number;               // Distance totale cumulée en kilomètres
  intermediateWaypointsCount: number; // Nombre de waypoints géométriques intermédiaires
}

/**
 * Arête TRANSFER (Correspondance à pied entre deux stations ou au sein d'un pôle d'échange)
 */
export interface TransferEdge {
  id: string;
  type: 'TRANSFER';
  sourceStationId: string;
  targetStationId: string;
  distanceMeters: number;
  durationSeconds: number; // Temps de correspondance à pied en secondes
}

/**
 * Type union pour les arêtes du réseau de transport
 */
export type TransportEdge = TraceEdge | SuiviEdge | TransferEdge;

/**
 * Structure complète du Property Graph du réseau de transport
 */
export interface TransportGraph {
  nodes: {
    stations: Record<string, StopNode>;
    waypoints: Record<string, WaypointNode>;
    lines: Record<string, TransportLine>;
  };
  edges: {
    traceEdges: TraceEdge[];
    suiviEdges: SuiviEdge[];
    transferEdges: TransferEdge[];
  };
}

/**
 * Types pour les fonds de carte (Basemaps)
 */
export type BasemapId = 'osm' | 'satellite' | 'dark' | 'positron';

export interface BasemapConfig {
  id: BasemapId;
  name: string;
  description: string;
  tiles: string[];
  attribution: string;
  maxZoom?: number;
}
