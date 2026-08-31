import "./lib/tauriApi.js";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { applyTheme } from './services/theme'

import "./styles/reset.css";
import "./styles/variables.css";
import "./styles/theme.css";
import "./styles/layout.css";
import "./styles/scrollbar.css";
import "./styles/animation.css";

async function initApp() {
  try {
    if (window.electron && window.electron.getSettings) {
      const settings = await window.electron.getSettings();
      applyTheme(settings || {});
    } else {
      console.warn("API Electron belum tersedia saat inisialisasi.");
    }
  } catch (error) {
    console.error("Gagal memuat pengaturan tema awal:", error);
  }

  const startReact = () => {
    const rootElement = document.getElementById('root');
    if (rootElement) {
      createRoot(rootElement).render(
        <StrictMode>
          <App />
        </StrictMode>
      );
    } else {
      console.error("Elemen root tidak ditemukan di DOM.");
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startReact);
  } else {
    startReact();
  }
}

initApp();