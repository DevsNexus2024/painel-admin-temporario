import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react-swc";
import { excludeFilesPlugin } from "./vite-plugin-exclude-files";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Configuração base para produção - usar '/' para suportar rotas absolutas
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, // 🔒 NUNCA habilitar sourcemaps em produção
    minify: 'terser', // 🔒 Usar terser para melhor obfuscação
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu']
        }
      },
      // 🔒 Excluir arquivos de teste e desenvolvimento do build
      external: (id) => {
        // Não incluir arquivos de teste no bundle
        if (id.includes('test-') || id.includes('test/')) {
          return true;
        }
        // Excluir arquivos .md e .json do build
        if (id.endsWith('.md') || id.endsWith('.json')) {
          return true;
        }
        return false;
      }
    },
    // 🔒 Segurança básica: apenas remover console.logs
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs em produção
        drop_debugger: true,
      },
      mangle: false, // Manter nomes legíveis para debug
      format: {
        comments: false
      }
    }
  },
  server: {
    // localhost-only: com o proxy abaixo, expor em "::" daria à LAN um túnel CORS-free pro v2 de prod
    host: "localhost",
    port: 8080,
    // Dev-only (não afeta build/prod): CORS do v2 não permite localhost — o browser chama
    // same-origin e o Vite encaminha server-side. Ative com X_BAAS_V2_API_URL=http://localhost:8080 no .env.
    proxy: {
      // Backend v2 (W3Build) — login/refresh/perfil
      '/auth': {
        target: 'https://api-bank-v2.gruponexus.com.br',
        changeOrigin: true,
      },
      // Rotas NTX Pay (só existem no v2)
      '/api/ntxpay': {
        target: 'https://api-bank-v2.gruponexus.com.br',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(), // Plugin React necessário para processar JSX
    // 🔒 Excluir arquivos .md e .json do build
    excludeFilesPlugin(),
    // 🔒 Plugin temporariamente desabilitado para debug
    // mode === 'production' && removeSensitiveDataPlugin(),
  ].filter(Boolean),
  
  // Configuração para garantir que todos os assets sejam servidos corretamente
  preview: {
    port: 8080,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // ✅ Configurar Vite para aceitar variáveis com prefixo X_
  envPrefix: ['VITE_', 'X_'],
  
  // 🔒 PROTEÇÃO DE DADOS SENSÍVEIS NO CÓDIGO FONTE
  define: mode === 'production' ? {
    // Substituir variáveis sensíveis por strings vazias no build
    'import.meta.env.X_API_KEY_BMP_531_TCR': '""',
    'import.meta.env.X_API_SECRET_BMP_531_TCR': '""',
    'import.meta.env.X_API_KEY_BMP_TCR': '""',
    'import.meta.env.X_API_SECRET_BMP_TCR': '""',
    'import.meta.env.X_ADMIN_TOKEN': '""',
    'import.meta.env.X_EXTERNAL_API_KEY': '""',
    'import.meta.env.X_TOKEN_CRYP_ACCESS': '""',
    'import.meta.env.X_TOKEN_WHITELABEL': '""',
    'import.meta.env.X_CHAVE_BMP_531_TTF': '""',
    'import.meta.env.X_X_BMP531_SECRET_TOKEN': '""',
  } : {},
}));
