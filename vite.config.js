import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vite.dev/config/
export default defineConfig({
  base: '/-/',
  plugins: [vue()],
  build: {
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/vue')) return 'vue';
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/d3') || id.includes('node_modules/topojson-client')) return 'd3';
          if (id.includes('node_modules/gsap')) return 'animation';
          return null;
        }
      }
    }
  }
});
