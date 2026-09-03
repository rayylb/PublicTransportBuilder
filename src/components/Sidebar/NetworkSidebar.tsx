import React, { useState } from 'react';
import {
  Route,
  MapPin,
  Plus,
  Trash2,
  PenTool,
  Bus,
  Train,
  Layers,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useTransportStore } from '../../store/useTransportStore';
import type { TransportMode } from '../../types/transport';

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

export const NetworkSidebar: React.FC = () => {
  const {
    lines,
    stops,
    waypoints,
    activeLineId,
    selectedElement,
    showStationLabels,
    setActiveLineId,
    setActiveTool,
    setSelectedElement,
    toggleShowStationLabels,
    toggleLineVisibility,
    createLine,
    updateLine,
    deleteLine,
    updateStop,
    deleteStop,
  } = useTransportStore();

  const [activeTab, setActiveTab] = useState<'lines' | 'stops'>('lines');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Formulaire de nouvelle ligne
  const [newLineName, setNewLineName] = useState('');
  const [newLineShortName, setNewLineShortName] = useState('T1');
  const [newLineColor, setNewLineColor] = useState('#0ea5e9');
  const [newLineMode, setNewLineMode] = useState<TransportMode>('tram');

  const handleCreateLineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLineName.trim()) return;

    createLine({
      name: newLineName.trim(),
      shortName: newLineShortName.trim() || 'L1',
      color: newLineColor,
      mode: newLineMode,
    });

    // Reset du formulaire
    setNewLineName('');
    setNewLineShortName(`L${Object.keys(lines).length + 2}`);
    setShowCreateModal(false);
  };

  const lineList = Object.values(lines);
  const stopList = Object.values(stops);

  return (
    <aside className="network-sidebar">
      {/* Onglets de navigation dans la sidebar */}
      <div className="sidebar-tabs">
        <button
          type="button"
          className={`sidebar-tab ${activeTab === 'lines' ? 'active' : ''}`}
          onClick={() => setActiveTab('lines')}
        >
          <Route size={15} />
          <span>Lignes ({lineList.length})</span>
        </button>
        <button
          type="button"
          className={`sidebar-tab ${activeTab === 'stops' ? 'active' : ''}`}
          onClick={() => setActiveTab('stops')}
        >
          <MapPin size={15} />
          <span>Arrêts ({stopList.length})</span>
        </button>
      </div>

      <div className="sidebar-content">
        {/* ================= ONGLET LIGNES ================= */}
        {activeTab === 'lines' && (
          <div className="tab-pane">
            <div className="pane-header">
              <h3>Réseau de Lignes</h3>
              <button
                type="button"
                className="add-element-btn"
                onClick={() => setShowCreateModal(!showCreateModal)}
              >
                <Plus size={15} />
                <span>Nouvelle Ligne</span>
              </button>
            </div>

            {/* Formulaire de création rapide de ligne */}
            {showCreateModal && (
              <form className="create-line-form" onSubmit={handleCreateLineSubmit}>
                <h4>Créer une nouvelle ligne</h4>
                <div className="form-group">
                  <label>Nom de la ligne</label>
                  <input
                    type="text"
                    placeholder="Ex: Ligne 1 - Universités <-> Gare"
                    value={newLineName}
                    onChange={(e) => setNewLineName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Code court</label>
                    <input
                      type="text"
                      placeholder="T1, M1, 42..."
                      value={newLineShortName}
                      onChange={(e) => setNewLineShortName(e.target.value)}
                      maxLength={5}
                    />
                  </div>

                  <div className="form-group flex-1">
                    <label>Mode</label>
                    <select
                      value={newLineMode}
                      onChange={(e) => setNewLineMode(e.target.value as TransportMode)}
                    >
                      <option value="tram">Tramway</option>
                      <option value="metro">Métro</option>
                      <option value="bus">Bus</option>
                      <option value="train">Train</option>
                      <option value="cable_car">Téléphérique</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Couleur</label>
                  <div className="color-presets-row">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`color-dot-btn ${newLineColor === c ? 'selected' : ''}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setNewLineColor(c)}
                      />
                    ))}
                    <input
                      type="color"
                      value={newLineColor}
                      onChange={(e) => setNewLineColor(e.target.value)}
                      className="custom-color-input"
                      title="Couleur personnalisée"
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Annuler
                  </button>
                  <button type="submit" className="btn-submit">
                    Créer et tracer
                  </button>
                </div>
              </form>
            )}

            {/* Liste des lignes existantes */}
            {lineList.length === 0 ? (
              <div className="empty-state">
                <Route size={32} className="empty-icon" />
                <p>Aucune ligne créée pour le moment.</p>
                <span>Créez une première ligne pour commencer à relier vos arrêts.</span>
              </div>
            ) : (
              <div className="lines-list">
                {lineList.map((line) => {
                  const isCurrentActive = activeLineId === line.id;
                  const isSelected = selectedElement?.type === 'line' && selectedElement.id === line.id;
                  const isVisible = line.isActive !== false;

                  // Calculer le nombre d'arrêts et de waypoints dans la ligne
                  const stopCount = line.pathNodeIds.filter((id) => stops[id]).length;
                  const wpCount = line.pathNodeIds.filter((id) => waypoints[id]).length;

                  return (
                    <div
                      key={line.id}
                      className={`line-card ${isSelected ? 'selected' : ''} ${isCurrentActive ? 'drawing-active' : ''} ${!isVisible ? 'line-hidden' : ''}`}
                      onClick={() => setSelectedElement({ type: 'line', id: line.id })}
                    >
                      <div className="line-card-header">
                        <span
                          className="line-badge"
                          style={{ backgroundColor: line.color, opacity: isVisible ? 1 : 0.4 }}
                        >
                          {line.shortName}
                        </span>
                        <div className="line-title-group">
                          <span className="line-name">{line.name}</span>
                          <span className="line-mode-tag">
                            {MODE_LABELS[line.mode].icon}
                            {MODE_LABELS[line.mode].label}
                          </span>
                        </div>

                        {/* Bouton pour afficher / masquer individuellement cette ligne */}
                        <button
                          type="button"
                          className={`btn-line-visibility ${isVisible ? 'visible' : 'hidden'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLineVisibility(line.id);
                          }}
                          title={isVisible ? 'Masquer la ligne sur la carte' : 'Afficher la ligne sur la carte'}
                        >
                          {isVisible ? <Eye size={15} /> : <EyeOff size={15} />}
                        </button>
                      </div>

                      <div className="line-stats-row">
                        <span>{stopCount} arrêts</span>
                        {wpCount > 0 && <span>• {wpCount} virages</span>}
                        <span>• ~{line.averageSpeedKmh} km/h</span>
                        {!isVisible && <span className="hidden-badge">• Masquée</span>}
                      </div>

                      <div className="line-card-actions">
                        <button
                          type="button"
                          className={`btn-trace ${isCurrentActive ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveLineId(line.id);
                            setActiveTool('draw_line');
                          }}
                          title="Tracer ou continuer cette ligne"
                        >
                          <PenTool size={13} />
                          <span>{isCurrentActive ? 'En cours de tracé' : 'Tracer'}</span>
                        </button>

                        <button
                          type="button"
                          className="btn-icon-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Supprimer la ligne ${line.name} ?`)) {
                              deleteLine(line.id);
                            }
                          }}
                          title="Supprimer la ligne"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= ONGLET ARRÊTS ================= */}
        {activeTab === 'stops' && (
          <div className="tab-pane">
            <div className="pane-header">
              <div className="header-title-group">
                <h3>Arrêts & Stations ({stopList.length})</h3>
              </div>
              <div className="header-actions-group">
                {/* Bouton pour afficher / masquer le nom des stations */}
                <button
                  type="button"
                  className={`toggle-labels-btn ${showStationLabels ? 'active' : ''}`}
                  onClick={toggleShowStationLabels}
                  title={showStationLabels ? 'Masquer les noms des stations' : 'Afficher les noms des stations'}
                >
                  {showStationLabels ? <Eye size={13} /> : <EyeOff size={13} />}
                  <span>{showStationLabels ? 'Noms ON' : 'Noms OFF'}</span>
                </button>

                <button
                  type="button"
                  className="add-element-btn"
                  onClick={() => setActiveTool('add_stop')}
                >
                  <Plus size={14} />
                  <span>Poser</span>
                </button>
              </div>
            </div>

            {stopList.length === 0 ? (
              <div className="empty-state">
                <MapPin size={32} className="empty-icon" />
                <p>Aucun arrêt placé.</p>
                <span>Utilisez l'outil "Ajouter un Arrêt" et cliquez sur la carte.</span>
              </div>
            ) : (
              <div className="stops-list">
                {stopList.map((stop) => {
                  const isSelected = selectedElement?.type === 'stop' && selectedElement.id === stop.id;

                  return (
                    <div
                      key={stop.id}
                      className={`stop-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedElement({ type: 'stop', id: stop.id })}
                    >
                      <div className="stop-card-main">
                        <div className="stop-icon-wrapper">
                          <MapPin size={16} />
                        </div>
                        <div className="stop-info">
                          <span className="stop-name">{stop.name}</span>
                          <span className="stop-code">
                            {stop.code} {stop.isTransfer && '• Pôle Correspondance'}
                          </span>
                        </div>
                      </div>

                      {/* Badges des lignes desservant cet arrêt */}
                      {stop.linesServed.length > 0 && (
                        <div className="stop-lines-badges">
                          {stop.linesServed.map((lineId) => {
                            const line = lines[lineId];
                            if (!line) return null;
                            return (
                              <span
                                key={lineId}
                                className="stop-mini-badge"
                                style={{ backgroundColor: line.color }}
                              >
                                {line.shortName}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      <button
                        type="button"
                        className="btn-icon-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteStop(stop.id);
                        }}
                        title="Supprimer cet arrêt"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================= INSPECTEUR DE SÉLECTION EN BAS DE SIDEBAR ================= */}
      {selectedElement && (
        <div className="sidebar-inspector">
          {selectedElement.type === 'stop' && stops[selectedElement.id] && (
            <div className="inspector-card">
              <div className="inspector-header">
                <h4>Propriétés de la Station</h4>
                <button
                  type="button"
                  className="close-inspector"
                  onClick={() => setSelectedElement(null)}
                >
                  ✕
                </button>
              </div>
              <div className="form-group">
                <label>Nom de la station</label>
                <input
                  type="text"
                  value={stops[selectedElement.id].name}
                  onChange={(e) => updateStop(selectedElement.id, { name: e.target.value })}
                />
              </div>
              <div className="inspector-meta">
                <span>Lat: {stops[selectedElement.id].coordinates.lat.toFixed(5)}</span>
                <span>Lng: {stops[selectedElement.id].coordinates.lng.toFixed(5)}</span>
              </div>
            </div>
          )}

          {selectedElement.type === 'line' && lines[selectedElement.id] && (
            <div className="inspector-card">
              <div className="inspector-header">
                <h4>Propriétés de la Ligne</h4>
                <button
                  type="button"
                  className="close-inspector"
                  onClick={() => setSelectedElement(null)}
                >
                  ✕
                </button>
              </div>
              <div className="form-group">
                <label>Nom</label>
                <input
                  type="text"
                  value={lines[selectedElement.id].name}
                  onChange={(e) => updateLine(selectedElement.id, { name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Vitesse commerciale (km/h)</label>
                <input
                  type="number"
                  value={lines[selectedElement.id].averageSpeedKmh}
                  onChange={(e) =>
                    updateLine(selectedElement.id, { averageSpeedKmh: Number(e.target.value) || 20 })
                  }
                />
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
