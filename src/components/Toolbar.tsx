import React from 'react';
import {
  MousePointer,
  MapPin,
  PenTool,
  Check,
  Sparkles,
  Trash2,
  Tag,
  EyeOff,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import { useTransportStore, type ToolType } from '../store/useTransportStore';

export const Toolbar: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    activeLineId,
    drawingEnd,
    setDrawingEnd,
    reverseLinePath,
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
      icon: <MousePointer size={15} />,
      tooltip: 'Inspecter les arrêts et les lignes (clic sur un élément)',
    },
    {
      id: 'add_stop',
      label: 'Ajouter Arrêt',
      icon: <MapPin size={15} />,
      tooltip: 'Cliquez sur la carte pour créer une nouvelle station',
    },
    {
      id: 'draw_line',
      label: 'Tracer Ligne',
      icon: <PenTool size={15} />,
      tooltip: 'Relier des arrêts ou créer des virages (waypoints automatiques)',
    },
  ];

  return (
    <div className="toolbar-panel-wrapper">
      {/* Ligne 1 : Outils de création et sélection */}
      <div className="toolbar-row-main">
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
      </div>

      {/* Ligne 2 : Actions et Affichage (Noms, Démo, Vider) */}
      <div className="toolbar-row-secondary">
        {/* Bouton pour afficher/masquer le nom des stations */}
        <button
          type="button"
          className={`tool-action-btn ${showStationLabels ? 'active-toggle' : 'muted'}`}
          onClick={toggleShowStationLabels}
          title={showStationLabels ? 'Masquer les noms permanents des stations' : 'Afficher les noms permanents des stations'}
        >
          {showStationLabels ? <Tag size={14} /> : <EyeOff size={14} />}
          <span>{showStationLabels ? 'Noms ON' : 'Noms OFF'}</span>
        </button>

        {/* Bouton Démo */}
        <button
          type="button"
          className="tool-action-btn secondary"
          onClick={loadSampleData}
          title="Charger le réseau exemple (Paris - Tram T1 & Bus B2)"
        >
          <Sparkles size={14} />
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
          <Trash2 size={14} />
          <span>Vider</span>
        </button>
      </div>

      {/* Bannière contextuelle d'aide au tracé avec sélecteur d'extrémité (Départ / Terminus) */}
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
                    Tracé : <strong>{activeLine.name}</strong> ({activeLine.pathNodeIds.length} pts)
                  </span>
                </div>
                <button
                  type="button"
                  className="finish-drawing-btn"
                  onClick={() => setActiveTool('select')}
                  title="Terminer le tracé"
                >
                  <Check size={13} />
                  <span>Terminer</span>
                </button>
              </div>

              {/* Sélecteur de l'extrémité à prolonger (Départ ou Terminus) et Inversion */}
              <div className="drawing-direction-controls">
                <span className="direction-label">Prolonger vers :</span>
                <div className="direction-toggle-group">
                  <button
                    type="button"
                    className={`btn-direction-pill ${drawingEnd === 'start' ? 'active start' : ''}`}
                    onClick={() => setDrawingEnd('start')}
                    title="Ajouter les prochains arrêts ou virages AU DÉBUT de la ligne (avant le départ)"
                  >
                    <ArrowUp size={11} />
                    <span>◀ Départ (Début)</span>
                  </button>

                  <button
                    type="button"
                    className={`btn-direction-pill ${drawingEnd === 'end' ? 'active end' : ''}`}
                    onClick={() => setDrawingEnd('end')}
                    title="Ajouter les prochains arrêts ou virages À LA FIN de la ligne (après le terminus)"
                  >
                    <ArrowDown size={11} />
                    <span>Terminus (Fin) ▶</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="btn-reverse-direction"
                  onClick={() => reverseLinePath(activeLine.id)}
                  title="Inverser le sens de la ligne (le premier arrêt devient le dernier)"
                >
                  <ArrowUpDown size={12} />
                  <span>Inverser</span>
                </button>
              </div>

              <p className="drawing-instructions">
                {drawingEnd === 'start' ? (
                  <span>
                    🟢 Mode <strong>Début</strong> : Chaque clic sur un arrêt ou virage s'insère <strong>avant le départ</strong>.
                  </span>
                ) : (
                  <span>
                    💡 Mode <strong>Fin</strong> : Chaque clic sur un arrêt ou virage s'ajoute <strong>après le terminus</strong>.
                  </span>
                )}
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
