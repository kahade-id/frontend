import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import compression from 'vite-plugin-compression'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    compression({ algorithm: 'brotliCompress', ext: '.br', threshold: 512 }),
    compression({ algorithm: 'gzip', ext: '.gz', threshold: 512 }),
  ],

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@kahade/config': resolve(__dirname, '../../packages/config/src/index.ts'),
      '@kahade/utils': resolve(__dirname, '../../packages/utils/src/index.ts'),
      '@kahade/ui': resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@kahade/types': resolve(__dirname, '../../packages/types/src/index.ts'),
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: process.env.VITE_SOURCEMAP === 'true',
    target: 'es2020',
    cssMinify: true,
    assetsInlineLimit: 4096,

    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',

        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/wouter')) {
            return 'vendor-router'
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-motion'
          }
          if (id.includes('@phosphor-icons')) {
            return 'vendor-icons'
          }
          if (id.includes('@kahade/ui')) {
            return 'kahade-ui'
          }
          if (id.includes('@kahade/utils')) {
            return 'kahade-utils'
          }
        },
      },
    },
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion', 'sonner'],
  },
})
