# 📘 Public Transport Builder — Documentation Technique & Récapitulatif Exhaustif

Ce document récapitule l'intégralité du travail réalisé sur le projet **Public Transport Builder**, les choix d'architecture, la modélisation des données en *Property Graph*, le fonctionnement du moteur cartographique hybride (MapLibre + SVG + DOM), le calcul géodésique des distances réelles, le tracé parallèle des tronçons partagés et le Thermomètre de Ligne.

---

## 📑 Sommaire
1. [Vision Globale et Choix de la Stack](#1-vision-globale-et-choix-de-la-stack)
2. [Modélisation des Données & Types TypeScript (Property Graph)](#2-modélisation-des-données--types-typescript-property-graph)
3. [Gestion d'État Réactive avec Zustand](#3-gestion-détat-réactive-avec-zustand)
4. [Moteur Cartographique & Rendu Hybride](#4-moteur-cartographique--rendu-hybride)
   - [A. Initialisation de MapLibre et Fonds de Carte](#a-initialisation-de-maplibre-et-fonds-de-carte)
   - [B. Stations en Points Noirs Purs & Calque au-dessus des Lignes](#b-stations-en-points-noirs-purs--calque-au-dessus-des-lignes)
   - [C. Rendu en Parallèle des Tronçons Communs (`transitGeometry.ts`)](#c-rendu-en-parallèle-des-tronçons-communs-transitgeometryts)
5. [Moteur Géodésique & Thermomètre de Ligne](#5-moteur-géodésique--thermomètre-de-ligne)
   - [A. Calcul des Distances Réelles (Haversine)](#a-calcul-des-distances-réelles-haversine)
   - [B. Le Thermomètre de Ligne Interactif](#b-le-thermomètre-de-ligne-interactif)
   - [C. Tracé Bidirectionnel & Extension en Tête de Ligne (Prepend)](#c-tracé-bidirectionnel--extension-en-tête-de-ligne-prepend)
6. [Interface Utilisateur & Ergonomie](#6-interface-utilisateur--ergonomie)
   - [A. Disposition Split-Screen (50% Menu / 50% Carte)](#a-disposition-split-screen-50-menu--50-carte)
   - [B. Changement Rapide de Couleur de Ligne (1 Clic)](#b-changement-rapide-de-couleur-de-ligne-1-clic)
   - [C. Fenêtre d'Édition In-Place sur l'Arrêt](#c-fenêtre-dédition-in-place-sur-larrêt)
7. [Arborescence Complète du Projet](#7-arborescence-complète-du-projet)
8. [Feuille de Route pour la Prochaine Étape (Calcul d'Itinéraire)](#8-feuille-de-route-pour-la-prochaine-étape-calcul-ditinéraire)

---

## 1. Vision Globale et Choix de la Stack

### 🎯 L'Objectif
Créer un outil cartographique interactif inspiré de *Google MyMaps*, spécialisé dans les réseaux de transport en commun.  
L'application permet :
1. De placer des **arrêts commerciaux** (stations).
2. De tracer des **lignes de transport** en reliant des arrêts et en insérant des **points de virage (waypoints)**.
3. D'afficher les **tronçons communs partagés par plusieurs lignes en parallèle côte à côte** sans chevauchement.
4. De changer la **couleur d'une ligne en 1 clic** (pastilles rapides, badge cliquable, sélecteur libre).
5. D'étendre les lignes dans les deux directions (**au Départ** ou **au Terminus**) et d'inverser le sens à tout moment.
6. D'afficher le **thermomètre de ligne** avec distances inter-stations réelles, temps de parcours et correspondances.
7. De modéliser l'ensemble sous forme de **graphe de propriétés (Property Graph)** afin d'exécuter ultérieurement des algorithmes de calcul d'itinéraire (Dijkstra, A*, recherche de correspondances).

### 🛠️ Stack Technologique
* **React 19 & TypeScript :** Typage strict, composants fonctionnels, hooks personnalisés.
* **Vite :** Outil de build ultra-rapide avec HMR (Hot Module Replacement).
* **MapLibre GL JS :** Moteur cartographique open-source pour le rendu de tuiles raster (OSM, Satellite ESRI, Dark, Positron).
* **Zustand :** Gestionnaire d'état global léger, sans boilerplate Redux, avec immutabilité et sélecteurs optimisés.
* **Lucide React :** Bibliothèque d'icônes vectorielles cohérente.
* **Vanilla CSS (Design Tokens & Glassmorphism) :** Système de design sombre, moderne et épuré.

---

## 2. Modélisation des Données & Types TypeScript (Property Graph)

Dans [`src/types/transport.ts`](./src/types/transport.ts), les données sont modélisées selon la théorie des **Graphes de Propriétés (Property Graph)** :

```
                               ┌─────────────────┐
                               │   Nœud LIGNE    │
                               │   (Transport)   │
                               └────────┬────────┘
                                        │
                      ┌─────────────────┴─────────────────┐
                      │                                   │
              Arête "TRACE"                       Arête "SUIVI"
       (Affichage & Géométrie)              (Topologie Commerciale)
                      │                                   │
         ┌────────────┴────────────┐             ┌────────┴────────┐
         ▼                         ▼             ▼                 ▼
   Station / Waypoint ──TRACE──► Waypoint ──► Station A ──SUIVI──► Station B
   (Tracé physique séquentiel)                (Liaison directe inter-stations)
```

### A. Les Nœuds du Graphe (Nodes)
1. **`StationNode` / `StopNode` (Nœud Commercial) :** Représente une station où les passagers montent et descendent (`id`, `name`, `coordinates`, `isTransfer`, `linesServed`, `transferDurationSec`, `fareZone`, `isAccessiblePMR`).
2. **`WaypointNode` (Nœud Géométrique) :** Représente une courbure de la voie/route sans arrêt commercial (`id`, `coordinates`, `lineId`, `order`).
3. **`TransportLine` / `LineNode` (Nœud Ligne) :** Représente la ligne avec son mode/catégorie (`tram`, `metro`, `bus`, `train`, `cable_car`), sa vitesse moyenne (`averageSpeedKmh`), et ses propriétés d'exploitation :
   - **Fréquences par tranche horaire :** `peakFrequencyMinutes` (Heures de pointe), `offPeakFrequencyMinutes` (Heures creuses), `nightFrequencyMinutes` (Soirée & nuit).
   - **Amplitude horaire de service :** `firstDeparture` (ex: "05:30"), `lastDeparture` (ex: "01:00").
   - **Sens & Accessibilité :** `isBidirectional` (Aller-Retour / Sens unique), `isAccessiblePMR` (Accessibilité handicapés/poussettes).

### B. Les Arêtes du Graphe (Edges)
1. **Arête `TRACE` (Rendu cartographique & Affichage)** :
   - Relie deux nœuds consécutifs du tracé physique d'une ligne ($N_i \rightarrow N_{i+1}$ : Station $\leftrightarrow$ Waypoint, Waypoint $\leftrightarrow$ Waypoint, Waypoint $\leftrightarrow$ Station, Station $\leftrightarrow$ Station).
   - Stocke : `lineId`, `sourceNodeId`, `targetNodeId`, `distanceMeters`, `distanceKm`, `orderIndex`.
2. **Arête `SUIVI` (Exploitation commerciale & Calcul d'Itinéraire)** :
   - Relie directement deux stations consécutives d'une ligne ($S_A \rightarrow S_B$) en intégrant la distance cumulée réelle avec virages.
   - Stocke : `lineId`, `sourceStationId`, `targetStationId`, `direction` (`forward` ou `backward`), `distanceMeters`, `distanceKm`, `intermediateWaypointsCount`.
   - *Note :* La durée de trajet n'est pas stockée statiquement : elle est calculée dynamiquement par le moteur à partir de la distance et de la vitesse commerciale de la ligne (`calculateTravelDurationSeconds`).
3. **Arête `TRANSFER` (Correspondance)** :
   - Relie deux stations pour modéliser une correspondance à pied (`sourceStationId`, `targetStationId`, `distanceMeters`, `durationSeconds`).

### C. Moteur de Génération du Graphe (`geo.ts`)
La fonction `buildTransportGraph(lines, stops, waypoints): TransportGraph` génère dynamiquement l'intégralité du réseau de propriétés pour alimenter l'interface et les algorithmes de recherche de chemin (Dijkstra multimodal avec filtrage horaire et PMR).

---

## 3. Gestion d'État Réactive avec Zustand

Le store global est défini dans [`src/store/useTransportStore.ts`](./src/store/useTransportStore.ts).  
Contrairement à `useState` local ou `useContext` qui peut provoquer des re-renders inutiles, Zustand permet d'isoler les actions et de manipuler les dictionnaires de données (`Record<string, ...>`) en temps constant $O(1)$.

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
│    POINTS NOIRS (Haut)  │ Stations au-dessus des lignes     │
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

### B. Stations en Points Noirs Purs & Calque au-dessus des Lignes
Les stations sont rendues dans un calque interactif dédié `.map-stations-overlay` avec `z-index: 10`, placé **strictement au-dessus des lignes SVG** (`z-index: 5`).  
Chaque station est représentée par un point noir épuré avec contour blanc net et infobulle apparaissant au survol.

### C. Rendu en Parallèle des Tronçons Communs (`transitGeometry.ts`)
Lorsque deux ou plusieurs lignes partagent une même section (mêmes arrêts ou waypoints adjacents) :
* Le module [`src/utils/transitGeometry.ts`](./src/utils/transitGeometry.ts) indexe chaque arête commune et calcule la normale perpendiculaire unitaire $\vec{n} = \left(-\frac{\Delta y}{L}, \frac{\Delta x}{L}\right)$.
* Chaque ligne $k$ parmi les $N$ lignes partageant ce tronçon est décalée d'un offset parallèle proportionnel :
  $$\text{shift} = \left(k - \frac{N - 1}{2}\right) \times 6\text{px}$$
* Les lignes cheminent ainsi **côte à côte en parallèle** de manière parfaitement fluide et sans aucun chevauchement.

---

## 5. Moteur Géodésique & Thermomètre de Ligne

Le module [`src/utils/geo.ts`](./src/utils/geo.ts) gère tous les calculs géométriques côté front-end sans nécessiter de serveur backend.

### A. Calcul des Distances Réelles (Haversine)
Pour deux points de coordonnées GPS $(lat_1, lng_1)$ et $(lat_2, lng_2)$ :
$$\Delta\text{lat} = \text{lat}_2 - \text{lat}_1, \quad \Delta\text{lng} = \text{lng}_2 - \text{lng}_1$$
$$a = \sin^2\left(\frac{\Delta\text{lat}}{2}\right) + \cos(\text{lat}_1)\cos(\text{lat}_2)\sin^2\left(\frac{\Delta\text{lng}}{2}\right)$$
$$d = 2 R \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1-a}\right)$$

Entre deux stations adjacentes dans une ligne, la distance affichée est la somme exacte de tous les segments géométriques (y compris les virages/waypoints intermédiaires).

### B. Le Thermomètre de Ligne Interactif
Le composant [`src/components/Sidebar/LineThermometer.tsx`](./src/components/Sidebar/LineThermometer.tsx) affiche :
* **Indicateurs KPI de ligne :** Longueur totale ($km$), nombre d'arrêts, durée de trajet estimée, distance inter-station moyenne.
* **Schéma linéaire vertical :** Ligne colorée aux couleurs de la ligne, pastilles de départ/terminus, distances inter-arrêts avec badge virages, temps de parcours cumulé et correspondances.
* **Édition des paramètres :** Modification directe du nom, code court, couleur, mode de transport, vitesse moyenne et fréquence.

### C. Tracé Bidirectionnel & Extension en Tête de Ligne (Prepend)
L'application permet d'étendre les lignes dans les deux sens :
1. **Prolongement au Départ (`prependStopToLine` / `createAndPrependWaypoint`) :**  
   Bouton **`+ Prolonger avant le départ...`** en haut du thermomètre ou bascule `[◀ Départ]` dans la barre d'outils. Les nouveaux clics sur la carte ou sur les stations s'insèrent en amont (index 0).
2. **Prolongement au Terminus (`appendStopToLine` / `createAndAppendWaypoint`) :**  
   Bouton **`+ Prolonger après le terminus...`** en bas du thermomètre ou bascule `[Terminus ▶]`.
3. **Inversion Complète du Tracé (`reverseLinePath`) :**  
   Bouton ($\text{🔄}$) permettant d'inverser instantanément la direction de la ligne (le Départ devient le Terminus et vice-versa).

---

## 6. Interface Utilisateur & Ergonomie

### A. Disposition Split-Screen (50% Menu / 50% Carte)
Dans [`src/App.tsx`](./src/App.tsx) et [`src/App.css`](./src/App.css) :
* **Panneau de gauche (50%) :**
  1. **Header :** Titre de l'application et badge.
  2. **Toolbar :** Sélectionner, Poser un arrêt, Tracer une ligne, Démo, Vider, et bascule Noms ON/OFF (organisée sur 2 rangées anti-débordement).
  3. **Sidebar de Gestion :** Onglets Lignes (avec Thermomètre détaillé) et Arrêts.
  4. **Pied de panneau :** Sélecteur de fond de carte.
* **Carte (50% Droite) :** Vue cartographique complète sans boutons flottants parasites.

### B. Changement Rapide de Couleur de Ligne (1 Clic)
* **Dans la liste des lignes :** Clic direct sur le badge coloré de la ligne.
* **Dans le Thermomètre de ligne :** Barre de pastilles rapides (8 teintes standard + sélecteur couleur libre) et badge Hero interactif.
* **Dans les paramètres :** Palette avec aperçu en temps réel.

---

## 7. Arborescence Complète du Projet

```
PublicTransportBuilder/
├── src/
│   ├── types/
│   │   └── transport.ts             # Définitions TypeScript (Property Graph, Lignes, Arrêts, Waypoints)
│   ├── constants/
│   │   └── basemaps.ts              # Catalogues des 4 fonds de carte (OSM, Satellite, Dark, Positron)
│   ├── store/
│   │   └── useTransportStore.ts     # Store Zustand réactif (État global & Actions du réseau)
│   ├── utils/
│   │   ├── geo.ts                   # Calculs géodésiques (Haversine, métriques de ligne, distances)
│   │   └── transitGeometry.ts       # Moteur de tracé parallèle pour tronçons partagés
│   ├── components/
│   │   ├── MapView.tsx              # Carte (MapLibre + Calque SVG + Points Noirs interactifs + Popover)
│   │   ├── Toolbar.tsx              # Barre d'outils (Outils de tracé, Démo, Vider, Toggle Noms)
│   │   ├── BasemapSelector.tsx      # Sélecteur des 4 fonds de carte
│   │   └── Sidebar/
│   │       ├── NetworkSidebar.tsx   # Gestionnaire Lignes/Arrêts avec onglets
│   │       └── LineThermometer.tsx  # Thermomètre de Ligne & Schéma linéaire interactif avec distances
│   ├── App.tsx                      # Layout principal Split-Screen 50/50
│   ├── App.css                      # Design system, Glassmorphism, Thermomètre et Thème Sombre
│   ├── index.css                    # Variables CSS globales et imports MapLibre
│   └── main.tsx                     # Point d'entrée React 19
├── DOCUMENTATION_PROJET.md          # Le présent document récapitulatif
├── package.json                     # Dépendances (maplibre-gl, zustand, lucide-react, etc.)
└── vite.config.ts                   # Configuration Vite
```

---

## 8. Feuille de Route pour la Prochaine Étape (Calcul d'Itinéraire)

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
