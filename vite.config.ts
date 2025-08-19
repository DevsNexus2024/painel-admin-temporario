import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Configuração para produção no cPanel
  base: mode === 'production' ? './' : '/',
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
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // 🔒 Plugin temporariamente desabilitado para debug
    // mode === 'production' && removeSensitiveDataPlugin(),
  ].filter(Boolean),
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
