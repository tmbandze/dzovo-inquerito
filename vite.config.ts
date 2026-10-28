import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' permite publicar em qualquer subpasta (ex.: utilizador.github.io/dzovo-inquerito/)
export default defineConfig({
  base: './',
  plugins: [react()],
})
