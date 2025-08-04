import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import MainLayout from "./components/layout/MainLayout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ExtratoTcr from "./pages/ExtratoTcr";
import CompensacaoDepositos from "./pages/CompensacaoDepositos";
import PaymentsPage from "./pages/payments";
import Cotacoes from "./pages/Cotacoes";
import Login from "./pages/Login";
import Register from "./pages/Register"; // ✅ REGISTRO DESBLOQUEADO TEMPORARIAMENTE
import BotCotacao from "./pages/bot-cotacao/BotCotacao";
import OTCClients from "./pages/otc/OTCClients";
import AdminClientStatement from "./pages/otc/AdminClientStatement.tsx";
import ClientStatement from "./pages/ClientStatement";
import EmployeeStatement from "./pages/EmployeeStatement";

// 🚨 IMPORTAR NOVA ARQUITETURA MULTI-BANCO
import { initializeBankingSystem } from "@/services/banking";

// Página para informar que registro está bloqueado
const RegisterBlocked = () => (
  <div className="min-h-screen flex items-center justify-center p-4 bg-background">
    <div className="max-w-md w-full text-center space-y-6">
      <div className="space-y-4">
        <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Registro Indisponível</h1>
        <p className="text-muted-foreground">
          O registro de novos usuários foi temporariamente desativado.
        </p>
        <p className="text-sm text-muted-foreground">
          Entre em contato com o administrador do sistema para solicitar acesso.
        </p>
      </div>
      <div className="space-y-3">
        <a 
          href="/login" 
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
        >
          Fazer Login
        </a>
      </div>
    </div>
  </div>
);

// Configuração otimizada do React Query para cache
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos - dados ficam frescos
      gcTime: 10 * 60 * 1000, // 10 minutos - cache persiste
      refetchOnWindowFocus: false, // Não refetch ao focar
      refetchOnReconnect: true, // Refetch quando reconectar
      retry: 2, // Tentar 2 vezes em caso de erro
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

/**
 * 🚨 COMPONENTE DE INICIALIZAÇÃO DA ARQUITETURA MULTI-BANCO
 */
const BankingSystemInitializer = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    const initializeBanking = async () => {
      try {
        console.log('🏦 [APP] Inicializando sistema bancário...');
        await initializeBankingSystem();
        console.log('✅ [APP] Sistema bancário inicializado com sucesso!');
      } catch (error) {
        console.error('❌ [APP] Erro ao inicializar sistema bancário:', error);
        // Não bloquear a aplicação, mas alertar
        console.warn('⚠️ [APP] Aplicação funcionará em modo fallback');
      }
    };

    initializeBanking();
  }, []);

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BankingSystemInitializer>
        <AuthProvider>
          <Toaster />
          <Sonner position="top-right" theme="dark" />
          <BrowserRouter>
            <Routes>
              {/* Rota pública de autenticação UNIFICADA */}
              <Route path="/login" element={<Login />} />
              {/* Redirect da rota antiga para a nova (compatibilidade) */}
              <Route path="/login-cliente" element={<Navigate to="/login" replace />} />
              {/* REGISTRO DESBLOQUEADO TEMPORARIAMENTE */}
              <Route path="/register" element={<Register />} />
              
              {/* Rota específica para extrato do cliente (sem sidebar) */}
              <Route path="/client-statement" element={
                <ProtectedRoute redirectTo="/login">
                  <ClientStatement />
                </ProtectedRoute>
              } />
              
              {/* Rota específica para extrato de funcionário OTC (sem sidebar) */}
              <Route path="/employee-statement" element={
                <ProtectedRoute requireEmployee={true} redirectTo="/login">
                  <EmployeeStatement />
                </ProtectedRoute>
              } />
              
              {/* Rotas protegidas - ADMIN APENAS */}
              <Route element={
                <ProtectedRoute requireAdmin={true}>
                  <MainLayout />
                </ProtectedRoute>
              }>
                <Route path="/" element={<Index />} />
                <Route path="/extrato_tcr" element={<ExtratoTcr />} />
                <Route path="/compensacao-depositos" element={<CompensacaoDepositos />} />
                <Route path="/pagamentos" element={<PaymentsPage />} />
                <Route path="/cotacoes" element={<Cotacoes />} />
                <Route path="/bot-cotacao" element={<BotCotacao />} />
                <Route path="/otc" element={<OTCClients />} />
                <Route path="/otc/admin-statement/:clientId" element={<AdminClientStatement />} />
              </Route>
              
              {/* Rota 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </BankingSystemInitializer>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
