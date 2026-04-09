import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        content: 'src/content/index.js',
        popup: 'src/popup/index.js'
      },
      output: {
        entryFileNames: '[name].js'
      }
    },
    outDir: 'dist'
  }
});