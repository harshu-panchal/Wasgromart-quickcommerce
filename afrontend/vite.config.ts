import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env so we can derive a proxy target without forcing every
  // dev-mode page to hardcode http://localhost:5000.
  const env = loadEnv(mode, process.cwd(), '')
  const devApiTarget =
    env.VITE_DEV_API_PROXY_TARGET ||
    (env.VITE_API_URL as string | undefined) ||
    (env.VITE_API_BASE_URL
      ? (env.VITE_API_BASE_URL as string).replace(/\/api\/v\d+\/?$|\/api\/?$|\/$/, '')
      : 'http://localhost:5000')

  return {
    plugins: [
      react(),
    ],
    assetsInclude: ['**/*.jpg', '**/*.jpeg', '**/*.png', '**/*.webp'],
    server: {
      fs: {
        strict: false,
      },
      middlewareMode: false,
      // Safety net: even if .env.development is missing, dev mode can still
      // reach the backend by calling relative /api/v1/... and /socket.io.
      proxy: {
        '/api': {
          target: devApiTarget,
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: devApiTarget,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@assets': path.resolve(__dirname, './src/assets'),
      },
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-apexcharts', 'apexcharts'],
      exclude: [],
    },
    build: {
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
      },
      rollupOptions: {
        // Lower parallelism to reduce peak RAM during build on shared hosting.
        maxParallelFileOps: 2,
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['framer-motion', 'gsap'],
            'chart-vendor': ['apexcharts', 'react-apexcharts', 'recharts'],
            'map-vendor': ['@react-google-maps/api'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
      sourcemap: false,
      minify: 'esbuild',
    },
  }
})
