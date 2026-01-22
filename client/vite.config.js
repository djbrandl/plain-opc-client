import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Read the server config from the root directory
const configPath = path.resolve(__dirname, '../server_config.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/socket.io': {
        target: `http://localhost:${config.port}`,
        ws: true,
        changeOrigin: true
      }
    }
  }
})