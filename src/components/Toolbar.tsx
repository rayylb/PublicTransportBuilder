import React from 'react';
import { MousePointer, MapPin, PenTool, Check, Sparkles, Trash2, Tag, EyeOff } from 'lucide-react';
import { useTransportStore, type ToolType } from '../store/useTransportStore';

export const Toolbar: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    activeLineId,
    lines,
    showStationLabels,
    toggleShowStationLabels,
    loadSampleData,
    clearAll,
  } = useTransportStore();

  const activeLine = activeLineId ? lines[activeLineId] : null;

  const tools: { id: ToolType; label: string; icon: React.ReactNode; tooltip: string }[] = [
    {
      id: 'select',
      label: 'Sélectionner',
      icon: <MousePointer size={16} />,
      tooltip: 'Inspecter les arrêts et les lignes (clic sur un élément)',
    },
    {
      id: 'add_stop',
      label: 'Ajouter un Arrêt',
      icon: <MapPin size={16} />,
      tooltip: 'Cliquez sur la carte pour créer une nouvelle station',
    },
    {
      id: 'draw_line',
      label: 'Tracer une Ligne',
      icon: <PenTool size={16} />,
      tooltip: 'Relier des arrêts ou créer des virages (waypoints automatiques)',
    },
  ];

  return (
    <div className="toolbar-panel-wrapper">
      {/* Boutons d'outils principaux */}
      <div className="toolbar-buttons-grid">
        {tools.map((t) => {
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={`tool-action-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTool(t.id)}
              title={t.tooltip}
            >
              <span className="tool-btn-icon">{t.icon}</span>
              <span className="tool-btn-label">{t.label}</span>
            </button>
          );
        })}

        {/* Bouton pour afficher/masquer le nom des stations */}
        <button
          type="button"
          className={`tool-action-btn ${showStationLabels ? 'active-toggle' : 'muted'}`}
          onClick={toggleShowStationLabels}
          title={showStationLabels ? 'Masquer les noms des stations sur la carte' : 'Afficher les noms des stations sur la carte'}
        >
          {showStationLabels ? <Tag size={15} /> : <EyeOff size={15} />}
          <span>{showStationLabels ? 'Noms ON' : 'Noms OFF'}</span>
        </button>

        {/* Bouton Démo */}
        <button
          type="button"
          className="tool-action-btn secondary"
          onClick={loadSampleData}
          title="Charger le réseau exemple (Paris - Tram T1 & Bus B2)"
        >
          <Sparkles size={15} />
          <span>Démo</span>
        </button>

        {/* Bouton Vider */}
        <button
          type="button"
          className="tool-action-btn danger"
          onClick={() => {
            if (window.confirm('Voulez-vous vraiment effacer tout le réseau ?')) {
              clearAll();
            }
          }}
          title="Effacer tout le réseau"
        >
          <Trash2 size={15} />
          <span>Vider</span>
        </button>
      </div>

      {/* Bannière contextuelle d'aide au tracé */}
      {activeTool === 'draw_line' && (
        <div className="panel-drawing-banner">
          {activeLine ? (
            <>
              <div className="drawing-header-row">
                <div className="drawing-line-info">
                  <span
                    className="line-color-dot"
                    style={{ backgroundColor: activeLine.color }}
                  />
                  <span className="drawing-line-title">
                    Tracé : <strong>{activeLine.name}</strong> ({activeLine.pathNodeIds.length} points)
                  </span>
                </div>
                <button
                  type="button"
                  className="finish-drawing-btn"
                  onClick={() => setActiveTool('select')}
                >
                  <Check size={13} />
                  <span>Terminer</span>
                </button>
              </div>
              <p className="drawing-instructions">
                💡 Cliquez sur un <strong>arrêt</strong> pour le relier, ou dans le <strong>vide</strong> pour insérer un virage.
              </p>
            </>
          ) : (
            <div className="drawing-no-line-warning">
              <span>⚠️ Sélectionnez ou créez une ligne ci-dessous pour démarrer le tracé.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
