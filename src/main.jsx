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
    const settings = await window.electron.getSettings();
    applyTheme(settings);
  } catch (error) {
    console.error("Gagal memuat pengaturan tema awal:", error);
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

initApp();