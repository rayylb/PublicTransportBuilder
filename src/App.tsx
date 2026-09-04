import { useState } from 'react';
import { MapView } from './components/MapView';
import { Toolbar } from './components/Toolbar';
import { NetworkSidebar } from './components/Sidebar/NetworkSidebar';
import { BasemapSelector } from './components/BasemapSelector';
import { Network } from 'lucide-react';
import type { BasemapId } from './types/transport';
import './App.css';

export function App() {
  const [activeBasemap, setActiveBasemap] = useState<BasemapId>('osm');

  return (
    <div className="app-split-container">
      {/* ================= PANNEAU DE GAUCHE (50% DE L'ÉCRAN) ================= */}
      <aside className="app-left-sidebar">
        {/* En-tête de marque sobre et épuré */}
        <header className="panel-header-section">
          <div className="app-brand">
            <div className="brand-icon-wrapper">
              <Network size={18} />
            </div>
            <div className="brand-text-block">
              <h1 className="brand-title">Public Transport Builder</h1>
              <span className="brand-subtitle">Éditeur de lignes & géométrie de réseau</span>
            </div>
          </div>
        </header>

        {/* Barre d'outils et commandes de tracé */}
        <section className="panel-toolbar-section">
          <Toolbar />
        </section>

        {/* Espace de travail : Lignes et Arrêts */}
        <section className="panel-network-section">
          <NetworkSidebar />
        </section>

        {/* Pied de panneau : Sélecteur de Fond de Carte */}
        <footer className="panel-footer-section">
          <BasemapSelector
            activeBasemap={activeBasemap}
            onSelectBasemap={setActiveBasemap}
          />
        </footer>
      </aside>

      {/* ================= CARTE PLEIN CADRE (50% DE L'ÉCRAN À DROITE) ================= */}
      <main className="app-right-map-container">
        <MapView
          activeBasemap={activeBasemap}
          initialCenter={[2.3522, 48.8566]}
          initialZoom={12}
        />
      </main>
    </div>
  );
}

export default App;
