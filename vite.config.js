import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: {
      input: './index.html' // Asegura que apunte directamente a tu HTML
    }
  }
});
