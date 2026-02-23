import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import compression from 'vite-plugin-compression'
import { resolve } from 'path'

// FIXES:
// - Added Brotli + Gzip compression (Issue #19) — install: pnpm add -D vite-plugin-compression
// - Removed chunkSizeWarningLimit override (Issue #18) — warnings are useful
// - Added proper manual chunk splitting
// - Added assetsInlineLimit (Issue #20)
// - Improved tree shaking for icons

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Brotli compression — S3 stores pre-compressed files, CloudFront serves them
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 512,
    }),
    // Gzip fallback for older clients
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 512,
    }),
  ],

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },

  build: {
    outDir: 'dist',

    // FIX: Enable sourcemaps only for staging, not production
    // Set VITE_SOURCEMAP=true in staging env to enable
    sourcemap: process.env.VITE_SOURCEMAP === 'true',

    // Target modern browsers for smaller bundles
    target: 'es2020',

    // Minify CSS
    cssMinify: true,

    // FIX (Issue #20): Don't inline assets > 4KB — keeps asset hashing intact
    assetsInlineLimit: 4096,

    rollupOptions: {
      output: {
        // Chunk naming with content hash for long-term cache busting
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',

        manualChunks(id) {
          // Core React runtime
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react'
          }
          // Router
          if (id.includes('node_modules/wouter')) {
            return 'vendor-router'
          }
          // Animation library
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-motion'
          }
          // Icon library — FIX: split from UI to allow better tree-shaking
          if (id.includes('@phosphor-icons')) {
            return 'vendor-icons'
          }
          // Charting
          if (id.includes('node_modules/recharts')) {
            return 'vendor-charts'
          }
          // Form handling
          if (id.includes('react-hook-form') || id.includes('@hookform')) {
            return 'vendor-forms'
          }
          // Internal workspace packages
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

  // Pre-bundle commonly used deps to speed up cold dev starts
  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion', 'axios', 'sonner'],
  },
})
