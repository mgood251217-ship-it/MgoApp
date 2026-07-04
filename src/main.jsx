import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import "./styles/reset.css";
import "./styles/variables.css";
import "./styles/theme.css";
import "./styles/layout.css";
import "./styles/scrollbar.css";
import "./styles/animation.css";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
