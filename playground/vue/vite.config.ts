import vue from '@vitejs/plugin-vue'
import { vueVitePlugin } from 'vite-plugin-dom-source'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue(),
    vueVitePlugin({
      prefix: 'playground/vue/',
    }),
  ],
  server: { port: 5174 },
})
