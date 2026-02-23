import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['wouter'],
          motion: ['framer-motion'],
          icons: ['@phosphor-icons/react'],
          ui: ['@kahade/ui'],
          utils: ['@kahade/utils'],
        },
      },
    },
    // Target modern browsers
    target: 'es2020',
    // Minify CSS
    cssMinify: true,
    // Raise chunk size warning limit
    chunkSizeWarningLimit: 600,
  },
  // Performance: pre-bundle heavy deps
  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion', 'axios', 'sonner'],
  },
})
