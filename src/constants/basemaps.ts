import type { StyleSpecification } from 'maplibre-gl';
import type { BasemapConfig, BasemapId } from '../types/transport';

/**
 * Catalogue des fonds de carte disponibles
 */
export const BASEMAPS: Record<BasemapId, BasemapConfig> = {
  osm: {
    id: 'osm',
    name: 'Plan Standard',
    description: 'Cartographie OpenStreetMap classique',
    tiles: [
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    ],
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    id: 'satellite',
    name: 'Satellite',
    description: 'Imagerie satellite mondiale haute résolution ESRI',
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    ],
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 19,
  },
  dark: {
    id: 'dark',
    name: 'Mode Sombre',
    description: 'Fond sombre CartoDB Dark Matter',
    tiles: [
      'https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
      'https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
      'https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
    ],
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap',
    maxZoom: 20,
  },
  positron: {
    id: 'positron',
    name: 'Clair Épuré',
    description: 'Fond clair minimaliste CartoDB Positron',
    tiles: [
      'https://a.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png',
      'https://b.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png',
      'https://c.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png',
    ],
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap',
    maxZoom: 20,
  },
};

/**
 * Génère une spécification de style valide pour MapLibre GL
 */
export function getBasemapStyle(basemapId: BasemapId): StyleSpecification {
  const config = BASEMAPS[basemapId] || BASEMAPS.osm;

  return {
    version: 8,
    sources: {
      'raster-tiles-source': {
        type: 'raster',
        tiles: config.tiles,
        tileSize: 256,
        attribution: config.attribution,
        maxzoom: config.maxZoom || 19,
      },
    },
    layers: [
      {
        id: 'raster-tiles-layer',
        type: 'raster',
        source: 'raster-tiles-source',
        minzoom: 0,
      },
    ],
  };
}
