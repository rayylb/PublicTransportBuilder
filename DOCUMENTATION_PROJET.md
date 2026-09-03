# 📘 Public Transport Builder — Documentation Technique & Récapitulatif Exhaustif

Ce document récapitule l'intégralité du travail réalisé sur le projet **Public Transport Builder**, les choix d'architecture, la modélisation des données en *Property Graph*, le fonctionnement du moteur cartographique hybride (MapLibre + SVG + DOM) et la gestion d'état réactive avec Zustand.

---

## 📑 Sommaire
1. [Vision Globale et Choix de la Stack](#1-vision-globale-et-choix-de-la-stack)
2. [Modélisation des Données & Types TypeScript (Property Graph)](#2-modélisation-des-données--types-typescript-property-graph)
3. [Gestion d'État Réactive avec Zustand](#3-gestion-détat-réactive-avec-zustand)
4. [Moteur Cartographique & Rendu Hybride](#4-moteur-cartographique--rendu-hybride)
   - [A. Initialisation de MapLibre et Fonds de Carte](#a-initialisation-de-maplibre-et-fonds-de-carte)
   - [B. Le Problème d'Ancrage des Marqueurs et la Solution Géométrique $0\times0$ px](#b-le-problème-dancrage-des-marqueurs-et-la-solution-géométrique-0times0-px)
   - [C. Le Calque Vectoriel SVG à Projection Directe (`map.project()`)](#c-le-calque-vectoriel-svg-à-projection-directe-mapproject)
5. [Interface Utilisateur & Ergonomie](#5-interface-utilisateur--ergonomie)
   - [A. Disposition Split-Screen (50% Menu / 50% Carte)](#a-disposition-split-screen-50-menu--50-carte)
   - [B. Fenêtre d'Édition In-Place sur l'Arrêt](#b-fenêtre-dédition-in-place-sur-larrêt)
   - [C. Contrôles de Visibilité (Étiquettes & Lignes)](#c-contrôles-de-visibilité-étiquettes--lignes)
6. [Arborescence Complète du Projet](#6-arborescence-complète-du-projet)
7. [Feuille de Route pour la Prochaine Étape (Calcul d'Itinéraire)](#7-feuille-de-route-pour-la-prochaine-étape-calcul-ditinéraire)

---

## 1. Vision Globale et Choix de la Stack

### 🎯 L'Objectif
Créer un outil cartographique interactif inspiré de *Google MyMaps*, spécialisé dans les réseaux de transport en commun.  
L'application permet :
1. De placer des **arrêts commerciaux** (stations).
2. De tracer des **lignes de transport** en reliant des arrêts et en insérant des **points de virage (waypoints)**.
3. De modéliser l'ensemble sous forme de **graphe de propriétés (Property Graph)** afin d'exécuter ultérieurement des algorithmes de calcul d'itinéraire (Dijkstra, A*, recherche de correspondances).

### 🛠️ Stack Technologique
* **React 19 & TypeScript :** Typage strict, composants fonctionnels, hooks personnalisés.
* **Vite :** Outil de build ultra-rapide avec HMR (Hot Module Replacement).
* **MapLibre GL JS :** Moteur cartographique open-source pour le rendu de tuiles raster (OSM, Satellite ESRI, Dark, Positron).
* **Zustand :** Gestionnaire d'état global léger, sans boilerplate Redux, avec immutabilité et sélecteurs optimisés.
* **Lucide React :** Bibliothèque d'icônes vectorielles cohérente.
* **Vanilla CSS (Design Tokens & Glassmorphism) :** Système de design sombre, moderne et épuré.

---

## 2. Modélisation des Données & Types TypeScript (Property Graph)

Dans [`src/types/transport.ts`](./src/types/transport.ts), les données sont modélisées selon la théorie des graphes :

### 1. Les Coordonnées Géographiques
```typescript
export interface Coordinates {
  lng: number; // Longitude (axe X : standard GeoJSON)
  lat: number; // Latitude (axe Y)
}
```

### 2. La Distinction entre Stations et Waypoints
* **`StopNode` (Nœud Commercial) :** Représente une station où les passagers montent et descendent.
* **`WaypointNode` (Nœud Géométrique) :** Représente une courbure de la voie/route sans arrêt commercial.

```typescript
export type NodeType = 'stop' | 'waypoint';

export interface BaseNode {
  id: string;             // UUID unique (ex: "stop_123", "wp_456")
  type: NodeType;
  coordinates: Coordinates;
  createdAt: number;
}

export interface StopNode extends BaseNode {
  type: 'stop';
  name: string;           // Ex: "Gare Centrale"
  code?: string;          // Ex: "GC-01"
  isTransfer: boolean;    // Pôle d'échange multi-lignes
  linesServed: string[];  // Liste des IDs des lignes desservant cet arrêt
  transferDurationSec?: number; // Temps de correspondance à pied (ex: 120s)
}

export interface WaypointNode extends BaseNode {
  type: 'waypoint';
  lineId: string;         // Ligne parente
  order: number;          // Ordre séquentiel sur le tracé
}
```

### 3. La Ligne de Transport
Une ligne est une séquence ordonnée d'identifiants de nœuds (`pathNodeIds`). Elle contient également ses propriétés physiques et opérationnelles :

```typescript
export type TransportMode = 'bus' | 'tram' | 'metro' | 'train' | 'cable_car';

export interface TransportLine {
  id: string;               // Ex: "line_t1"
  name: string;             // Ex: "Tramway T1 - Est/Ouest"
  shortName: string;        // Ex: "T1"
  color: string;            // Ex: "#0ea5e9"
  mode: TransportMode;
  isActive: boolean;        // Visibilité active sur la carte (true/false)
  averageSpeedKmh: number;  // Vitesse commerciale (ex: 22 km/h)
  frequencyMinutes: number; // Fréquence de passage
  pathNodeIds: string[];    // Séquence : ['stop_1', 'wp_1', 'stop_2', ...]
}
```

### 4. L'Arête de Graphe (`TransportEdge`) — Prévue pour le Calcul d'Itinéraire
```typescript
export interface TransportEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  lineId?: string;          // Si tronçon en transport
  mode: TransportMode | 'walk'; // 'walk' pour les correspondances à pied
  distanceMeters: number;
  durationSeconds: number;  // Poids de l'arête (cost)
}
```

---

## 3. Gestion d'État Réactive avec Zustand

Le store global est défini dans [`src/store/useTransportStore.ts`](./src/store/useTransportStore.ts).  
Contrairement à `useState` local ou `useContext` qui peut provoquer des re-renders inutiles, Zustand permet d'isoler les actions et de manipuler les dictionnaires de données (`Record<string, ...>`) en temps constant $O(1)$.

### Exemple de Structure du Store :
```typescript
interface TransportStoreState {
  // Dictionnaires de données indexés par ID
  stops: Record<string, StopNode>;
  waypoints: Record<string, WaypointNode>;
  lines: Record<string, TransportLine>;

  // États d'interaction
  activeTool: 'select' | 'add_stop' | 'draw_line';
  activeLineId: string | null;
  selectedElement: { type: 'stop' | 'line' | 'waypoint'; id: string } | null;
  editingStopId: string | null;      // ID de l'arrêt actuellement en édition in-place
  showStationLabels: boolean;        // Masquage global des étiquettes

  // Actions
  addStop: (coords: Coordinates, customName?: string) => string;
  updateStop: (id: string, updates: Partial<StopNode>) => void;
  deleteStop: (id: string) => void;
  createLine: (params: { name: string; shortName: string; color: string; mode: TransportMode }) => string;
  appendStopToLine: (lineId: string, stopId: string) => void;
  createAndAppendWaypoint: (lineId: string, coords: Coordinates) => string;
  toggleLineVisibility: (lineId: string) => void;
  toggleShowStationLabels: () => void;
  loadSampleData: () => void;
  clearAll: () => void;
}
```

### Logique d'Insertion et de Connexion :
* **Ajout d'un arrêt (`addStop`) :** Crée un nouvel arrêt avec un nom automatique (`Arrêt N`), l'ajoute au dictionnaire et active automatiquement `editingStopId` pour ouvrir le popover d'édition.
* **Ajout d'un arrêt à une ligne (`appendStopToLine`) :**
  ```typescript
  appendStopToLine: (lineId, stopId) => {
    set((state) => {
      const line = state.lines[lineId];
      const stop = state.stops[stopId];
      if (!line || !stop) return state;

      // Évite les doublons consécutifs
      if (line.pathNodeIds[line.pathNodeIds.length - 1] === stopId) return state;

      const updatedPath = [...line.pathNodeIds, stopId];
      const updatedLinesServed = stop.linesServed.includes(lineId)
        ? stop.linesServed
        : [...stop.linesServed, lineId];

      return {
        lines: { ...state.lines, [lineId]: { ...line, pathNodeIds: updatedPath } },
        stops: {
          ...state.stops,
          [stopId]: {
            ...stop,
            linesServed: updatedLinesServed,
            isTransfer: updatedLinesServed.length > 1, // Devient automatiquement pôle de correspondance
          },
        },
      };
    });
  }
  ```

---

## 4. Moteur Cartographique & Rendu Hybride

Le composant principal de la carte est [`src/components/MapView.tsx`](./src/components/MapView.tsx).

```
┌─────────────────────────────────────────────────────────────┐
│                      MAPVIEW COMPONENT                      │
├─────────────────────────┬───────────────────────────────────┤
│    MAPLIBRE GL (Base)   │ Tuiles Raster (OSM, Satellite...) │
├─────────────────────────┼───────────────────────────────────┤
│    CALQUE SVG (Milieu)  │ Tracé vectoriel des lignes        │
├─────────────────────────┼───────────────────────────────────┤
│    MARQUEURS DOM (Haut) │ Pastilles et étiquettes stations  │
├─────────────────────────┼───────────────────────────────────┤
│    POPOVER IN-PLACE     │ Bulle d'édition directe           │
└─────────────────────────┴───────────────────────────────────┘
```

### A. Initialisation de MapLibre et Fonds de Carte
Dans [`src/constants/basemaps.ts`](./src/constants/basemaps.ts), 4 fonds de carte sont configurés en tuiles raster conformes à la spécification MapLibre Style v8 :
* **Plan Standard (OSM)**
* **Satellite Mondial (ESRI World Imagery)**
* **Mode Sombre (CartoDB Dark Matter)**
* **Mode Clair Épuré (CartoDB Positron)**

---

### B. Le Problème d'Ancrage des Marqueurs et la Solution Géométrique $0\times0$ px

#### 🔍 L'Anomalie initiale :
Quand un arrêt était placé, il apparaissait décalé par rapport au clic et glissait lors du zoom/dézoom.
* **Cause :** MapLibre calculait le centre d'ancrage en mesurant la boîte englobante de l'élément HTML (`offsetWidth` / `offsetHeight`). Comme notre élément contenait la pastille ronde ET le texte de l'étiquette en dessous, le centre géométrique tombait entre la pastille et le texte !

#### ✅ La Solution Implémentée :
1. Le conteneur racine du marqueur (`.map-station-marker`) a une taille stricte de **$0\times0\text{ px}$** (il s'agit d'un point géométrique pur).
2. La pastille ronde de $20\times20\text{ px}$ est positionnée en `top: -10px; left: -10px;` : son centre coïncide à $100\%$ avec le point $(0,0)$.
3. L'étiquette de texte est positionnée en `top: 14px; left: 0; transform: translateX(-50%);` : elle flotte sous le point sans modifier l'ancrage.

```css
/* src/App.css */
.map-station-marker {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: auto !important;
  z-index: 10;
}

.station-pin-circle {
  position: absolute;
  top: -10px;
  left: -10px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
  cursor: pointer;
}
```

---

### C. Le Calque Vectoriel SVG à Projection Directe (`map.project()`)

#### 🔍 Pourquoi avoir choisi un calque SVG plutôt que les calques WebGL natifs ?
MapLibre réinitialise ses calques WebGL personnalisés lors du rechargement des tuiles raster ou lors d'un changement de fond de carte (`map.setStyle()`). Cela provoquait des disparitions de lignes intempestives.

#### ✅ Le Fonctionnement du Calque SVG :
1. Un élément `<svg className="map-routes-svg-overlay">` recouvre la carte avec `pointer-events: none`.
2. Pour chaque ligne active, la fonction `map.project([lng, lat])` convertit les coordonnées GPS en pixels $(x, y)$ sur l'écran.
3. Un chemin SVG `<path d="M x1 y1 L x2 y2 ...">` est tracé en temps réel :
   * Une **sous-couche noire de contraste** (`stroke-width: 8px`).
   * Le **tracé coloré de la ligne** (`stroke-width: 5px`).
4. Les événements `map.on('move')`, `map.on('zoom')` et `map.on('resize')` déclenchent la réévaluation immédiate des coordonnées à **60 images par seconde**.

```typescript
// Extrait de MapView.tsx
const renderedLines = Object.values(lines)
  .filter((line) => line.isActive !== false)
  .map((line) => {
    const points: { x: number; y: number }[] = [];

    line.pathNodeIds.forEach((nodeId) => {
      const node = stops[nodeId] || waypoints[nodeId];
      if (node) {
        // Projection mathématique géographique -> pixels écran
        const projected = map.project([node.coordinates.lng, node.coordinates.lat]);
        points.push(projected);
      }
    });

    if (points.length < 2) return null;

    const pathData = `M ${points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}`;

    return (
      <g key={line.id} className="svg-transit-line-group">
        <path d={pathData} stroke="#000000" strokeWidth={8} strokeOpacity={0.85} fill="none" strokeLinecap="round" />
        <path d={pathData} stroke={line.color} strokeWidth={5} fill="none" strokeLinecap="round" />
      </g>
    );
  });
```

---

## 5. Interface Utilisateur & Ergonomie

### A. Disposition Split-Screen (50% Menu / 50% Carte)
Dans [`src/App.tsx`](./src/App.tsx) et [`src/App.css`](./src/App.css) :
* **Panneau de gauche (50%) :**
  1. **Header :** Titre de l'application et badge.
  2. **Toolbar :** Sélectionner, Poser un arrêt, Tracer une ligne, Démo, Vider, et bascule Noms ON/OFF.
  3. **Sidebar de Gestion :** Onglets Lignes et Arrêts, formulaire de création de ligne avec palette de couleurs, inspecteur de sélection.
  4. **Pied de panneau :** Sélecteur de fond de carte (*Plan OSM, Satellite, Sombre, Clair*).
* **Carte (50% Droite) :** Vue cartographique complète sans boutons flottants parasites.

---

### B. Fenêtre d'Édition In-Place sur l'Arrêt
Lorsqu'un arrêt est posé ou cliqué, un popover compact s'ancre directement au-dessus du marqueur avec `map.project(stop.coordinates)` :
* Champ de texte pré-sélectionné (saisie du nom immédiate + validation par touche **Entrée**).
* Bouton bascule **Correspondance**.
* Bouton **Supprimer** l'arrêt.

---

### C. Contrôles de Visibilité (Étiquettes & Lignes)
1. **Masquage global des étiquettes de station :**  
   Bouton **`Noms ON / Noms OFF`** dans la Toolbar et dans l'onglet Arrêts.
2. **Masquage individuel par ligne :**  
   Bouton œil ($\text{👁️}$ / $\text{🚫}$) sur chaque carte de ligne pour afficher ou cacher n'importe quelle ligne indépendamment.

---

## 6. Arborescence Complète du Projet

```
PublicTransportBuilder/
├── src/
│   ├── types/
│   │   └── transport.ts             # Définitions TypeScript (Property Graph, Lignes, Arrêts, Waypoints)
│   ├── constants/
│   │   └── basemaps.ts              # Catalogues des 4 fonds de carte (OSM, Satellite, Dark, Positron)
│   ├── store/
│   │   └── useTransportStore.ts     # Store Zustand réactif (État global & Actions du réseau)
│   ├── components/
│   │   ├── MapView.tsx              # Composant Carte (MapLibre + Calque SVG + Marqueurs DOM + Popover)
│   │   ├── Toolbar.tsx              # Barre d'outils (Outils de tracé, Démo, Vider, Toggle Noms)
│   │   ├── BasemapSelector.tsx      # Sélecteur des 4 fonds de carte
│   │   └── Sidebar/
│   │       └── NetworkSidebar.tsx   # Gestionnaire des Lignes et Arrêts + Inspecteur
│   ├── App.tsx                      # Layout principal Split-Screen 50/50
│   ├── App.css                      # Design system, Glassmorphism, Popover et Thème Sombre
│   ├── index.css                    # Variables CSS globales et imports MapLibre
│   └── main.tsx                     # Point d'entrée React 19
├── DOCUMENTATION_PROJET.md          # Le présent document récapitulatif
├── package.json                     # Dépendances (maplibre-gl, zustand, lucide-react, etc.)
└── vite.config.ts                   # Configuration Vite
```

---

## 7. Feuille de Route pour la Prochaine Étape (Calcul d'Itinéraire)

Maintenant que le front-end et l'éditeur visuel sont entièrement fonctionnels et stables, voici les étapes suivantes prévues :

```
┌─────────────────────────────────────────────────────────────┐
│                ÉVOLUTION VERS LE PROPERTY GRAPH             │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
       Étape 4 (Prochaine)             Étape 5 (Backend/DB)
  Moteur de Graphe Front-end         Base de Données Graphe
  - Modélisation Adjacence           - Export/Import Neo4j / Memgraph
  - Algorithme de Dijkstra           - Stockage Cypher
  - Calcul d'Itinéraire Local        - API REST / GraphQL
```

### Prochaine Étape (Étape 4) :
1. **Génération automatique du Property Graph en mémoire :**
   * Transformation des `lines` et `stops` en liste d'arêtes pondérées (`TransportEdge`).
   * Calcul des temps de parcours par tronçon :  
     $$\text{Durée (s)} = \frac{\text{Distance (m)}}{\text{Vitesse Moyenne (m/s)}} + \text{Temps d'arrêt}$$
   * Création des arêtes piétonnes de correspondance entre les lignes passant par une même station.
2. **Module de Recherche d'Itinéraire :**
   * Sélection d'une station de Départ et d'Arrivée.
   * Exécution de l'algorithme de **Dijkstra** pour trouver le chemin le plus rapide.
   * Mise en surbrillance de l'itinéraire calculé sur la carte avec feuille de route étape par étape.
