import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

import { cloudflare } from "@cloudflare/vite-plugin";

// Replace process.env in @ts-evtx/* at transform time so it works even when
// the package is not pre-bundled by optimizeDeps (dev mode serves it raw).
const patchEvtxProcessEnv: Plugin = {
  name: 'patch-evtx-process-env',
  transform(code, id) {
    if (id.includes('@ts-evtx') && code.includes('process.env')) {
      return { code: code.replace(/process\.env/g, '({})'), map: null };
    }
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), patchEvtxProcessEnv, cloudflare()],
  define: {
    'process.env': JSON.stringify({}),
  },
  resolve: {
    alias: {
      fs: path.resolve(__dirname, 'src/fs-stub.js'),
      '@ts-evtx/messages': path.resolve(__dirname, 'src/ts-evtx-messages-stub.js'),
    },
  },
  worker: {
    format: 'es',
    plugins: () => [patchEvtxProcessEnv],
  },
})