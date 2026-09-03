import React, { useState } from 'react';
import {
  ArrowLeft,
  PenTool,
  Trash2,
  Eye,
  EyeOff,
  Train,
  Bus,
  Layers,
  Clock,
  Navigation,
  MapPin,
  Route,
  XCircle,
  Sliders,
  CornerDownRight,
  ArrowRightLeft,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  PlusCircle,
  Gauge,
  Sparkles,
  Palette,
} from 'lucide-react';
import { useTransportStore } from '../../store/useTransportStore';
import type { TransportLine, TransportMode } from '../../types/transport';
import { calculateLineMetrics, formatDistance, formatDuration } from '../../utils/geo';

interface LineThermometerProps {
  line: TransportLine;
  onBack: () => void;
}

const PRESET_COLORS = [
  '#0ea5e9', // Bleu ciel
  '#3b82f6', // Bleu
  '#10b981', // Vert émeraude
  '#f59e0b', // Ambre / Orange
  '#ef4444', // Rouge
  '#8b5cf6', // Violet
  '#ec4899', // Rose
  '#14b8a6', // Turquoise
];

const MODE_LABELS: Record<TransportMode, { label: string; icon: React.ReactNode }> = {
  metro: { label: 'Métro', icon: <Train size={14} /> },
  tram: { label: 'Tramway', icon: <Train size={14} /> },
  bus: { label: 'Bus', icon: <Bus size={14} /> },
  train: { label: 'Train', icon: <Train size={14} /> },
  cable_car: { label: 'Téléphérique', icon: <Layers size={14} /> },
};

export const LineThermometer: React.FC<LineThermometerProps> = ({ line, onBack }) => {
  const {
    stops,
    waypoints,
    lines,
    activeLineId,
    drawingEnd,
    setActiveLineId,
    setDrawingEnd,
    setActiveTool,
    setSelectedElement,
    setEditingStopId,
    toggleLineVisibility,
    updateLine,
    deleteLine,
    removeNodeFromLine,
    reverseLinePath,
  } = useTransportStore();

  const [showSettings, setShowSettings] = useState(false);
  const [hoveredStationId, setHoveredStationId] = useState<string | null>(null);

  const metrics = calculateLineMetrics(line, stops, waypoints);
  const isCurrentlyDrawing = activeLineId === line.id;
  const isVisible = line.isActive !== false;

  return (
    <div className="line-thermometer-view">
      {/* 1. Barre de navigation supérieure et actions */}
      <div className="thermometer-header">
        <button
          type="button"
          className="btn-back-lines"
          onClick={onBack}
          title="Retourner à la liste de toutes les lignes"
        >
          <ArrowLeft size={15} />
          <span>Toutes les Lignes</span>
        </button>

        <div className="thermometer-header-actions">
          {/* Bascule visibilité */}
          <button
            type="button"
            className={`btn-header-action ${isVisible ? 'active' : 'muted'}`}
            onClick={() => toggleLineVisibility(line.id)}
            title={isVisible ? 'Masquer la ligne sur la carte' : 'Afficher la ligne sur la carte'}
          >
            {isVisible ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>

          {/* Tracer / Continuer */}
          <button
            type="button"
            className={`btn-header-action ${isCurrentlyDrawing ? 'active-drawing' : ''}`}
            onClick={() => {
              setActiveLineId(line.id);
              setActiveTool('draw_line');
              setDrawingEnd('end');
            }}
            title="Tracer ou continuer cette ligne sur la carte"
          >
            <PenTool size={14} />
            <span>{isCurrentlyDrawing ? 'En Tracé' : 'Tracer'}</span>
          </button>

          {/* Inverser le sens du tracé (Départ ↔ Terminus) */}
          <button
            type="button"
            className="btn-header-action"
            onClick={() => reverseLinePath(line.id)}
            title="Inverser le sens de la ligne (Départ ↔ Terminus)"
          >
            <ArrowUpDown size={14} />
          </button>

          {/* Réglages */}
          <button
            type="button"
            className={`btn-header-action ${showSettings ? 'active' : ''}`}
            onClick={() => setShowSettings(!showSettings)}
            title="Modifier les réglages et propriétés de la ligne"
          >
            <Sliders size={14} />
          </button>

          {/* Supprimer */}
          <button
            type="button"
            className="btn-header-action danger"
            onClick={() => {
              if (window.confirm(`Supprimer définitivement la ligne ${line.name} ?`)) {
                deleteLine(line.id);
                onBack();
              }
            }}
            title="Supprimer la ligne"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* 2. Hero Card stylisée avec lueur aux couleurs de la ligne */}
      <div
        className="line-hero-card"
        style={{
          borderLeftColor: line.color,
          boxShadow: `0 8px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)`,
        }}
      >
        <div className="line-hero-top">
          <label
            className="line-hero-badge-glow"
            style={{
              backgroundColor: line.color,
              boxShadow: `0 0 16px ${line.color}88`,
              cursor: 'pointer',
            }}
            title="Cliquer pour changer la couleur de la ligne"
          >
            <span className="line-hero-badge-text">{line.shortName}</span>
            <input
              type="color"
              value={line.color}
              onChange={(e) => updateLine(line.id, { color: e.target.value })}
              className="hidden-color-input"
            />
          </label>

          <div className="line-hero-info">
            <h3 className="line-hero-title">{line.name}</h3>
            <div className="line-hero-tags-row">
              <span className="line-hero-mode-pill">
                {MODE_LABELS[line.mode].icon}
                <span>{MODE_LABELS[line.mode].label}</span>
              </span>
              <span className="line-hero-freq-pill">
                <Clock size={11} />
                <span>Toutes les {line.frequencyMinutes || 6} min</span>
              </span>
              <span className="line-hero-speed-pill">
                <Gauge size={11} />
                <span>~{line.averageSpeedKmh} km/h</span>
              </span>
            </div>
          </div>
        </div>

        {/* Barre de changement rapide de couleur (1 clic) */}
        <div className="line-quick-color-bar">
          <span className="quick-color-label">Couleur :</span>
          <div className="quick-color-dots">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`quick-color-dot-btn ${line.color === c ? 'selected' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => updateLine(line.id, { color: c })}
                title={`Appliquer ${c}`}
              />
            ))}
            <label className="quick-custom-picker-label" title="Couleur personnalisée">
              <Palette size={11} />
              <input
                type="color"
                value={line.color}
                onChange={(e) => updateLine(line.id, { color: e.target.value })}
                className="hidden-color-input"
              />
            </label>
          </div>
        </div>

        {/* Bannière active lorsque le mode tracé est enclenché */}
        {isCurrentlyDrawing && (
          <div className="thermometer-drawing-active-bar">
            <span className="drawing-active-hint">Extrémité active :</span>
            <div className="drawing-end-pills">
              <button
                type="button"
                className={`btn-end-pill ${drawingEnd === 'start' ? 'active start' : ''}`}
                onClick={() => setDrawingEnd('start')}
                title="Ajouter les prochains arrêts au DÉBUT de la ligne"
              >
                <ArrowUp size={11} />
                <span>◀ Départ (Début)</span>
              </button>
              <button
                type="button"
                className={`btn-end-pill ${drawingEnd === 'end' ? 'active end' : ''}`}
                onClick={() => setDrawingEnd('end')}
                title="Ajouter les prochains arrêts à la FIN de la ligne"
              >
                <ArrowDown size={11} />
                <span>Terminus (Fin) ▶</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Grille des 4 indicateurs clés (KPI) */}
        <div className="line-kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon-wrapper" style={{ color: line.color }}>
              <Route size={13} />
            </div>
            <span className="kpi-value">{formatDistance(metrics.totalDistanceKm)}</span>
            <span className="kpi-label">Longueur</span>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-wrapper" style={{ color: '#38bdf8' }}>
              <MapPin size={13} />
            </div>
            <span className="kpi-value">{metrics.stopsCount}</span>
            <span className="kpi-label">Stations</span>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-wrapper" style={{ color: '#34d399' }}>
              <Clock size={13} />
            </div>
            <span className="kpi-value">~{formatDuration(metrics.totalDurationMinutes)}</span>
            <span className="kpi-label">Durée totale</span>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-wrapper" style={{ color: '#fbbf24' }}>
              <ArrowRightLeft size={13} />
            </div>
            <span className="kpi-value">
              {metrics.stopsCount > 1
                ? formatDistance(metrics.averageInterStationDistanceKm)
                : '—'}
            </span>
            <span className="kpi-label">Inter-station</span>
          </div>
        </div>
      </div>

      {/* 4. Panneau des paramètres éditables de la ligne */}
      {showSettings && (
        <div className="line-edit-panel">
          <div className="edit-panel-header">
            <h4>Paramètres de la Ligne</h4>
            <span className="edit-panel-hint">Modifications appliquées en temps réel</span>
          </div>

          <div className="form-group">
            <label>Nom de la ligne</label>
            <input
              type="text"
              value={line.name}
              onChange={(e) => updateLine(line.id, { name: e.target.value })}
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Code court</label>
              <input
                type="text"
                value={line.shortName}
                onChange={(e) => updateLine(line.id, { shortName: e.target.value })}
                maxLength={5}
              />
            </div>
            <div className="form-group flex-1">
              <label>Mode de transport</label>
              <select
                value={line.mode}
                onChange={(e) => updateLine(line.id, { mode: e.target.value as TransportMode })}
              >
                <option value="tram">Tramway</option>
                <option value="metro">Métro</option>
                <option value="bus">Bus</option>
                <option value="train">Train</option>
                <option value="cable_car">Téléphérique</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Vitesse commerciale (km/h)</label>
              <input
                type="number"
                value={line.averageSpeedKmh}
                onChange={(e) =>
                  updateLine(line.id, { averageSpeedKmh: Math.max(1, Number(e.target.value) || 20) })
                }
                min={1}
                max={300}
              />
            </div>
            <div className="form-group flex-1">
              <label>Fréquence de passage (min)</label>
              <input
                type="number"
                value={line.frequencyMinutes}
                onChange={(e) =>
                  updateLine(line.id, { frequencyMinutes: Math.max(1, Number(e.target.value) || 5) })
                }
                min={1}
                max={120}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Palette de couleur</label>
            <div className="color-presets-row">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-dot-btn ${line.color === c ? 'selected' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => updateLine(line.id, { color: c })}
                />
              ))}
              <input
                type="color"
                value={line.color}
                onChange={(e) => updateLine(line.id, { color: e.target.value })}
                className="custom-color-input"
                title="Couleur personnalisée"
              />
            </div>
          </div>
        </div>
      )}

      {/* 5. LE THERMOMÈTRE GRAPHIQUE VERTICAL HAUT DE GAMME */}
      <div className="thermometer-timeline-section">
        <div className="thermometer-section-header">
          <div className="section-title-with-pill">
            <span className="section-dot-indicator" style={{ backgroundColor: line.color }} />
            <h4>Thermomètre & Schéma de Ligne</h4>
          </div>
          {metrics.stopsCount > 0 && (
            <span className="section-count-badge">
              {metrics.stopsCount} station{metrics.stopsCount > 1 ? 's' : ''}
              {metrics.waypointsCount > 0 && ` • ${metrics.waypointsCount} virage${metrics.waypointsCount > 1 ? 's' : ''}`}
            </span>
          )}
        </div>

        {metrics.thermometerStops.length === 0 ? (
          <div className="thermometer-empty-card">
            <div className="empty-icon-circle">
              <Route size={24} style={{ color: line.color }} />
            </div>
            <h5>Aucune station reliée</h5>
            <p>Tracez votre premier tronçon en cliquant sur les arrêts de la carte.</p>
            <button
              type="button"
              className="btn-start-drawing-cta"
              onClick={() => {
                setActiveLineId(line.id);
                setActiveTool('draw_line');
                setDrawingEnd('end');
              }}
            >
              <PenTool size={14} />
              <span>Démarrer le tracé sur la carte</span>
            </button>
          </div>
        ) : (
          <div className="thermometer-timeline-track">
            {/* Bouton pour PROLONGER EN TÊTE DE LIGNE (avant le premier arrêt / départ) */}
            <div className="thermometer-prepend-action">
              <button
                type="button"
                className={`btn-prepend-start-cta ${isCurrentlyDrawing && drawingEnd === 'start' ? 'active' : ''}`}
                onClick={() => {
                  setActiveLineId(line.id);
                  setActiveTool('draw_line');
                  setDrawingEnd('start');
                }}
                title="Ajouter des arrêts ou virages AVANT le premier arrêt (Départ)"
              >
                <ArrowUp size={13} />
                <span>+ Prolonger avant le départ...</span>
              </button>
            </div>

            {metrics.thermometerStops.map((item, index) => {
              const {
                stop,
                nodeIndex,
                isTerminusStart,
                isTerminusEnd,
                segmentDistanceKm,
                intermediateWaypointsCount,
                cumulativeDistanceKm,
                cumulativeDurationMinutes,
                otherLinesServed,
              } = item;

              const isHovered = hoveredStationId === stop.id;

              return (
                <div key={`${stop.id}-${nodeIndex}`} className="thermometer-step-node">
                  {/* Segment intermédiaire reliant l'arrêt précédent à celui-ci */}
                  {index > 0 && (
                    <div className="thermometer-segment-link">
                      {/* Rail vertical coloré */}
                      <div
                        className="segment-rail-line"
                        style={{
                          backgroundColor: line.color,
                          boxShadow: `0 0 8px ${line.color}66`,
                        }}
                      />

                      {/* Badge flottant avec la distance inter-stations exacte */}
                      <div className="segment-info-pill">
                        <span className="segment-dist-val">
                          📏 {formatDistance(segmentDistanceKm)}
                        </span>
                        {intermediateWaypointsCount > 0 && (
                          <span
                            className="segment-waypoint-chip"
                            title={`${intermediateWaypointsCount} point(s) de courbure`}
                          >
                            <CornerDownRight size={10} />
                            <span>{intermediateWaypointsCount} virage{intermediateWaypointsCount > 1 ? 's' : ''}</span>
                          </span>
                        )}
                        <span className="segment-speed-chip">
                          ~{formatDuration((segmentDistanceKm / (line.averageSpeedKmh || 20)) * 60)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Carte interactive de la station */}
                  <div
                    className={`thermometer-station-row ${isTerminusStart ? 'is-start' : ''} ${isTerminusEnd ? 'is-end' : ''} ${isHovered ? 'is-hovered' : ''}`}
                    onClick={() => {
                      setSelectedElement({ type: 'stop', id: stop.id });
                      setEditingStopId(stop.id);
                    }}
                    onMouseEnter={() => setHoveredStationId(stop.id)}
                    onMouseLeave={() => setHoveredStationId(null)}
                    style={{
                      borderLeftColor: isTerminusStart
                        ? '#10b981'
                        : isTerminusEnd
                        ? '#ef4444'
                        : isHovered
                        ? line.color
                        : 'var(--border-color)',
                    }}
                  >
                    {/* Puce visuelle de la station sur le rail */}
                    <div className="thermometer-station-bullet-anchor">
                      <div
                        className={`thermometer-bullet-disc ${isTerminusStart ? 'start-bullet' : isTerminusEnd ? 'end-bullet' : 'mid-bullet'} ${stop.isTransfer ? 'transfer-bullet' : ''}`}
                        style={{
                          borderColor: isTerminusStart
                            ? '#10b981'
                            : isTerminusEnd
                            ? '#ef4444'
                            : line.color,
                        }}
                      >
                        <div className="bullet-core-dot" />
                      </div>
                    </div>

                    {/* Contenu et métadonnées de la station */}
                    <div className="thermometer-station-body">
                      <div className="station-header-line">
                        <span className="station-name-text">{stop.name}</span>
                        {isTerminusStart && (
                          <span className="terminus-pill start">
                            <Sparkles size={10} />
                            <span>Départ</span>
                          </span>
                        )}
                        {isTerminusEnd && (
                          <span className="terminus-pill end">
                            <span>Terminus</span>
                          </span>
                        )}
                      </div>

                      <div className="station-sub-details">
                        {/* Cumul distance & temps */}
                        <div className="station-progression-tags">
                          <span className="progression-item distance">
                            <Navigation size={10} />
                            <span>{formatDistance(cumulativeDistanceKm)}</span>
                          </span>
                          <span className="progression-item time">
                            <Clock size={10} />
                            <span>+{formatDuration(cumulativeDurationMinutes)}</span>
                          </span>
                        </div>

                        {/* Badges de correspondances avec d'autres lignes */}
                        {otherLinesServed.length > 0 && (
                          <div className="station-transfers-group">
                            <span className="transfer-label">Corr. :</span>
                            {otherLinesServed.map((otherLineId) => {
                              const otherLine = lines[otherLineId];
                              if (!otherLine) return null;
                              return (
                                <button
                                  key={otherLineId}
                                  type="button"
                                  className="transfer-line-pill"
                                  style={{ backgroundColor: otherLine.color }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedElement({ type: 'line', id: otherLineId });
                                  }}
                                  title={`Voir la ligne ${otherLine.name}`}
                                >
                                  {otherLine.shortName}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bouton de détachement d'arrêt */}
                    <button
                      type="button"
                      className="btn-detach-station"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNodeFromLine(line.id, nodeIndex);
                      }}
                      title="Retirer cette station de la ligne"
                    >
                      <XCircle size={15} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Bouton pour PROLONGER EN FIN DE LIGNE (après le terminus) */}
            <div className="thermometer-bottom-action">
              <button
                type="button"
                className={`btn-append-more-cta ${isCurrentlyDrawing && drawingEnd === 'end' ? 'active' : ''}`}
                onClick={() => {
                  setActiveLineId(line.id);
                  setActiveTool('draw_line');
                  setDrawingEnd('end');
                }}
                style={{ borderColor: `${line.color}55`, color: line.color }}
                title="Ajouter des arrêts ou virages APRÈS le dernier arrêt (Terminus)"
              >
                <PlusCircle size={14} />
                <span>+ Prolonger après le terminus...</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
