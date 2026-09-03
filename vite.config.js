import { defineConfig } from 'vite';
import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

function copyRuntimeAssets() {
  return {
    name: 'copy-runtime-assets',
    closeBundle() {
      const outputAssets = resolve('dist/assets');
      mkdirSync(resolve(outputAssets, 'images'), { recursive: true });
      mkdirSync(resolve(outputAssets, 'js'), { recursive: true });
      cpSync(
        resolve('assets/images/kv-random'),
        resolve(outputAssets, 'images/kv-random'),
        { recursive: true }
      );
      cpSync(
        resolve('assets/js/gsap.min.js'),
        resolve(outputAssets, 'js/gsap.min.js')
      );
      cpSync(
        resolve('assets/js/ScrollTrigger.min.js'),
        resolve(outputAssets, 'js/ScrollTrigger.min.js')
      );
      cpSync(resolve('assets/shader'), resolve(outputAssets, 'shader'), {
        recursive: true,
      });
    },
  };
}

export default defineConfig({
  // Keep built asset URLs relative so the site also works when deployed under
  // a subdirectory (and when previewing dist/index.html directly).
  base: './',
  plugins: [copyRuntimeAssets()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
  },
});
