import React, { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { userTypeService } from '@/services/userType';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
  requireAdmin?: boolean; // Nova prop para rotas que requerem admin
}

/**
 * Componente para proteger rotas que requerem autenticação
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  redirectTo = '/login',
  requireAdmin = false 
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  const [userTypeCheck, setUserTypeCheck] = useState<{ loading: boolean; isOTC: boolean }>({
    loading: true,
    isOTC: false
  });

    // Verificar tipo de usuário quando autenticado
  useEffect(() => {
    const checkUserType = async () => {
      // Se não requer admin ou usuário não está autenticado, não verificar
      if (!requireAdmin || !isAuthenticated || !user) {
        setUserTypeCheck({ loading: false, isOTC: false });
        return;
      }

      // Se já estamos na rota OTC, não verificar novamente
      if (location.pathname === '/client-statement') {
        setUserTypeCheck({ loading: false, isOTC: false });
        return;
      }

      console.log('🔍 ProtectedRoute: Verificando tipo de usuário para rota admin...');
      try {
        const userTypeResult = await userTypeService.checkUserType(user);
        const isOTC = userTypeResult.isOTC;
        
        setUserTypeCheck({ loading: false, isOTC });
        
        console.log('🔍 ProtectedRoute: Resultado da verificação:', {
          isOTC,
          isAdmin: userTypeResult.isAdmin,
          type: userTypeResult.type,
          hasOTCClient: !!userTypeResult.otcClient
        });
        
        if (isOTC) {
          console.log('⚠️ ProtectedRoute: Usuário OTC tentando acessar área admin - redirecionando');
        }
      } catch (error) {
        console.error('❌ ProtectedRoute: Erro ao verificar tipo de usuário:', error);
        setUserTypeCheck({ loading: false, isOTC: false });
      }
    };

    checkUserType();
  }, [isAuthenticated, user, requireAdmin, location.pathname]);

  console.log('🛡️ ProtectedRoute:', {
    pathname: location.pathname,
    isAuthenticated,
    isLoading,
    redirectTo,
    state: location.state
  });

  // Mostrar loading enquanto verifica autenticação ou tipo de usuário
  if (isLoading || userTypeCheck.loading) {
    console.log('⏳ ProtectedRoute: Verificando autenticação...');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Se não estiver autenticado, redirecionar para login
  if (!isAuthenticated) {
    console.log('🔒 ProtectedRoute: Usuário não autenticado, redirecionando para:', redirectTo);
    console.log('💾 Salvando rota atual para redirecionamento:', location.pathname);
    // Salvar a rota atual para redirecionar após login
    return (
      <Navigate 
        to={redirectTo} 
        state={{ from: location.pathname }} 
        replace 
      />
    );
  }

  // Verificar se é usuário OTC tentando acessar área admin
  if (isAuthenticated && requireAdmin && userTypeCheck.isOTC) {
    console.log('🚫 ProtectedRoute: Usuário OTC tentando acessar área admin, redirecionando para /client-statement');
    return <Navigate to="/client-statement" replace />;
  }

  console.log('✅ ProtectedRoute: Usuário autenticado, renderizando conteúdo');
  // Se estiver autenticado, renderizar filhos
  return <>{children}</>;
};

export default ProtectedRoute; 