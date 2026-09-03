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
 * Modélisation d'une Ligne de transport
 */
export interface TransportLine {
  id: string;             // Ex: "line_tram_1"
  name: string;           // Ex: "Ligne 1 - Universités <-> Gare"
  shortName: string;      // Ex: "T1"
  color: string;          // Couleur hexadécimale (Ex: "#3b82f6")
  mode: TransportMode;    // Mode de transport
  isActive: boolean;      // Visibilité sur la carte
  averageSpeedKmh: number;// Vitesse commerciale moyenne en km/h
  frequencyMinutes: number; // Fréquence de passage (pour calcul d'attente)
  // Séquence ordonnée de tous les IDs de nœuds (stops + waypoints) formant le tracé
  pathNodeIds: string[];
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

/**
 * Modélisation de l'arête de graphe (Edge) pour le calcul d'itinéraire (Property Graph)
 */
export interface TransportEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  lineId?: string;        // Si c'est un tronçon de transport
  mode: TransportMode | 'walk'; // 'walk' pour les correspondances à pied
  distanceMeters: number;
  durationSeconds: number;
}
