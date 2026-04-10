import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'
import { readFileSync } from 'fs'

// Read package.json to get version
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))

// Inject React DevTools bridge when running `npm run profiler`.
// Retries loading http://localhost:8097 so we don't lose the connection if Electron loads before react-devtools binds the port (common with concurrently).
const reactDevToolsPlugin = () => ({
  name: 'react-devtools-inject',
  transformIndexHtml(html: string) {
    if (process.env.VITE_REACT_DEVTOOLS !== 'true') return html
    const port = process.env.REACT_DEVTOOLS_PORT || '8097'
    const loader = `<script>(function(){var p="${port}",n=0,N=90;function c(){if(++n>N){console.warn("[profiler] React DevTools not reachable at http://localhost:"+p+" — start react-devtools first or run: npm run profiler");return;}var s=document.createElement("script");s.async=true;s.src="http://localhost:"+p;s.onerror=function(){s.remove();setTimeout(c,400)};document.head.appendChild(s)}c()})();</script>`
    return html.replace('</head>', `  ${loader}\n</head>`)
  },
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    reactDevToolsPlugin(),
    electron([
      {
        // Main process entry file of the Electron App.
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            emptyOutDir: false, // Don't empty - would delete preload.js
            rollupOptions: {
              external: [
                'electron',
                'get-windows', // Native module - must not be bundled
                'uiohook-napi' // Native module - must not be bundled
              ]
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            emptyOutDir: false, // Don't empty - would delete main.js
            rollupOptions: {
              external: [
                'electron',
                'get-windows', // Native module - must not be bundled
                'uiohook-napi' // Native module - must not be bundled
              ]
            }
          }
        },
        onstart(options) {
          // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete, 
          // instead of restarting the entire Electron App.
          options.reload();
        },
      },
    ]),
    renderer({
      resolve: {
        electron: {
          type: 'esm'
        }
      }
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    'globalThis.__APP_VERSION__': JSON.stringify(packageJson.version),
    'window.__APP_VERSION__': JSON.stringify(packageJson.version),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  server: {
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
