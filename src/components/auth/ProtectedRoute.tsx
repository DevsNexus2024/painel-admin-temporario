import React, { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { userTypeService } from '@/services/userType';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
  requireAdmin?: boolean; // Nova prop para rotas que requerem admin
  requireEmployee?: boolean; // Nova prop para rotas que requerem funcionário OTC
}

/**
 * Componente para proteger rotas que requerem autenticação
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  redirectTo = '/login',
  requireAdmin = false,
  requireEmployee = false 
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  const [userTypeCheck, setUserTypeCheck] = useState<{ 
    loading: boolean; 
    isOTC: boolean; 
    isEmployee: boolean; 
    type: string 
  }>({
    loading: true,
    isOTC: false,
    isEmployee: false,
    type: ''
  });

    // Verificar tipo de usuário quando autenticado
  useEffect(() => {
    const checkUserType = async () => {
      // Se não requer verificação de tipo ou usuário não está autenticado, não verificar
      if ((!requireAdmin && !requireEmployee) || !isAuthenticated || !user) {
        setUserTypeCheck({ loading: false, isOTC: false, isEmployee: false, type: '' });
        return;
      }

      // Se já estamos em rotas específicas, não verificar novamente
      const currentPath = location.pathname;
      if (currentPath === '/client-statement' || currentPath === '/employee-statement') {
        setUserTypeCheck({ loading: false, isOTC: false, isEmployee: false, type: '' });
        return;
      }

      console.log('🔍 ProtectedRoute: Verificando tipo de usuário...', {
        requireAdmin,
        requireEmployee,
        currentPath
      });
      
      try {
        const userTypeResult = await userTypeService.checkUserType(user);
        const isOTC = userTypeResult.isOTC;
        const isEmployee = userTypeResult.isEmployee || false;
        const type = userTypeResult.type;
        
        setUserTypeCheck({ 
          loading: false, 
          isOTC, 
          isEmployee, 
          type 
        });
        
        console.log('🔍 ProtectedRoute: Resultado da verificação:', {
          isOTC,
          isEmployee,
          isAdmin: userTypeResult.isAdmin,
          type: userTypeResult.type,
          hasOTCClient: !!userTypeResult.otcClient,
          hasOTCAccess: !!userTypeResult.otcAccess
        });
        
        if (requireAdmin && (isOTC || isEmployee)) {
          console.log('⚠️ ProtectedRoute: Usuário não-admin tentando acessar área admin - redirecionando');
        }
        
        if (requireEmployee && !isEmployee) {
          console.log('⚠️ ProtectedRoute: Usuário não-funcionário tentando acessar área de funcionário');
        }
        
      } catch (error) {
        console.error('❌ ProtectedRoute: Erro ao verificar tipo de usuário:', error);
        setUserTypeCheck({ loading: false, isOTC: false, isEmployee: false, type: '' });
      }
    };

    checkUserType();
  }, [isAuthenticated, user, requireAdmin, requireEmployee, location.pathname]);

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

  // Verificar se é usuário funcionário tentando acessar área admin
  if (isAuthenticated && requireAdmin && userTypeCheck.isEmployee) {
    console.log('🚫 ProtectedRoute: Funcionário OTC tentando acessar área admin, redirecionando para /employee-statement');
    return <Navigate to="/employee-statement" replace />;
  }

  // Verificar se é usuário não-funcionário tentando acessar área de funcionário
  if (isAuthenticated && requireEmployee && !userTypeCheck.isEmployee) {
    console.log('🚫 ProtectedRoute: Usuário não-funcionário tentando acessar área de funcionário, redirecionando baseado no tipo');
    
    // Redirecionar baseado no tipo de usuário
    if (userTypeCheck.isOTC) {
      return <Navigate to="/client-statement" replace />;
    } else {
      return <Navigate to="/" replace />; // Admin vai para dashboard
    }
  }

  console.log('✅ ProtectedRoute: Usuário autenticado e autorizado, renderizando conteúdo');
  // Se estiver autenticado e autorizado, renderizar filhos
  return <>{children}</>;
};

export default ProtectedRoute; 