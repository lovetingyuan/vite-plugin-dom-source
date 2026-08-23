import react from '@vitejs/plugin-react'
import { reactVitePlugin } from 'vite-plugin-dom-source'
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
