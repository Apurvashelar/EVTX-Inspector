import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

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
  plugins: [react(), tailwindcss(), patchEvtxProcessEnv],
  define: {
    'process.env': JSON.stringify({}),
  },
  resolve: {
    alias: {
      fs: path.resolve(__dirname, 'src/fs-stub.js'),
      '@ts-evtx/messages': path.resolve(__dirname, 'src/ts-evtx-messages-stub.js'),
    },
  },
  // @ts-evtx/core branches on `node.constructor.name === 'OpenStartElementNode'`
  // (and many other class-name string comparisons) when rendering EVTX templates.
  // Without keepNames, the bundler mangles class names to single letters and every
  // comparison fails — every record renders as `<Event/>` and rows look empty.
  build: {
    rollupOptions: {
      output: { keepNames: true },
    },
  },
  worker: {
    format: 'es',
    plugins: () => [patchEvtxProcessEnv],
    rollupOptions: {
      output: { keepNames: true },
    },
  },
})