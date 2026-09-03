import React from 'react';
import { Globe, Map, Moon, Sun } from 'lucide-react';
import { BASEMAPS } from '../constants/basemaps';
import type { BasemapId } from '../types/transport';

interface BasemapSelectorProps {
  activeBasemap: BasemapId;
  onSelectBasemap: (id: BasemapId) => void;
}

const BASEMAP_ICONS: Record<BasemapId, React.ReactNode> = {
  satellite: <Globe size={16} />,
  osm: <Map size={16} />,
  dark: <Moon size={16} />,
  positron: <Sun size={16} />,
};

export const BasemapSelector: React.FC<BasemapSelectorProps> = ({
  activeBasemap,
  onSelectBasemap,
}) => {
  return (
    <div className="basemap-selector-container">
      <div className="basemap-selector-label">
        <span>Fond de carte</span>
      </div>
      <div className="basemap-buttons-group">
        {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => {
          const basemap = BASEMAPS[id];
          const isActive = activeBasemap === id;

          return (
            <button
              key={id}
              type="button"
              className={`basemap-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectBasemap(id)}
              title={basemap.description}
            >
              <span className="basemap-icon">{BASEMAP_ICONS[id]}</span>
              <span className="basemap-name">{basemap.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
