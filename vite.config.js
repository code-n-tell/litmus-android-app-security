import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createApiApp } from './server/createApiApp.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-api-routes',
      configureServer(server) {
        server.middlewares.use(createApiApp())
      },
    },
  ],
})
