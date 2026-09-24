import { defineConfig, loadEnv } from 'vite';
import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

function copyRuntimeAssets() {
  return {
    name: 'copy-runtime-assets',
    closeBundle() {
      const outputAssets = resolve('dist/assets');
      mkdirSync(resolve(outputAssets, 'images'), { recursive: true });
      mkdirSync(resolve(outputAssets, 'js'), { recursive: true });
      cpSync(resolve('assets/images/OGP.jpg'), resolve(outputAssets, 'images/OGP.jpg'));
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

function socialMetadata(siteUrl) {
  const url = new URL(siteUrl);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('SITE_URL must be an http(s) public page URL without credentials, query or hash.');
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';

  return {
    name: 'social-metadata',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replaceAll('https://kamiiso-design.vercel.app/', url.href);
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'SITE_');
  const siteUrl = env.SITE_URL || 'https://kamiiso-design.vercel.app/';
  return {
    // Keep built asset URLs relative so the site also works when deployed under
    // a subdirectory (and when previewing dist/index.html directly).
    base: './',
    plugins: [socialMetadata(siteUrl), copyRuntimeAssets()],
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
    },
    build: {
      outDir: 'dist',
    },
  };
});
