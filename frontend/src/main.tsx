import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Aplica el tema guardado antes del primer render para evitar el "flash" claro
// (el botón del Header solo alterna a partir de aquí).
const temaGuardado = localStorage.getItem('tema')
const oscuro = temaGuardado === 'dark' || (!temaGuardado && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
document.documentElement.classList.toggle('dark', oscuro)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
