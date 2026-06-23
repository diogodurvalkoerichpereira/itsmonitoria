import { defineConfig } from 'vite';

// Frontend (SPA em JS puro) empacotado pelo Vite.
// - Codigo-fonte fica em client/ (root do Vite).
// - O build vai para dist/client/ e e servido pelo Express em producao.
// - Em desenvolvimento, o Vite sobe na porta 5173 e faz proxy de /api e
//   /uploads para o backend Express (porta 3000), evitando CORS.
export default defineConfig({
  root: 'client',
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
