import react from '@vitejs/plugin-react'
import { reactVitePlugin } from 'dom-source-lens'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    react(),
    reactVitePlugin({
      prefix: 'playground/react/',
    }),
  ],
  server: { port: 5173 },
})
