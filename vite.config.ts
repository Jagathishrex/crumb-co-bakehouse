import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { kalaiData } from './kalai.vite.ts'

// Kalai writes editor attributes into JSX (data-nid ids, data-name layer names, data-locked, data-mask); production builds drop them.
function stripKalaiIds(): Plugin {
  return {
    name: 'strip-kalai-ids',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!/\.[jt]sx$/.test(id)) return null
      return code
        .replace(/\s+data-nid="[A-Za-z0-9]+"/g, '')
        .replace(/\s+data-name="[^"{}]*"/g, '')
        .replace(/\s+data-locked(?:="[^"]*"|=\{(?:true|false)\})?(?=[\s/>])/g, '')
        .replace(/\s+data-mask="[^"]*"/g, '')
    },
  }
}

export default defineConfig({
  // kalaiData: the Database tab's record files (data/records), saved and reloaded while designing.
  plugins: [stripKalaiIds(), react(), tailwindcss(), kalaiData()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
