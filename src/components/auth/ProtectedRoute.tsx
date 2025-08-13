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

      // Verificando tipo de usuário
      
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
        
        // Resultado da verificação obtido
        
        if (requireAdmin && (isOTC || isEmployee)) {

        }
        
        if (requireEmployee && !isEmployee) {

        }
        
      } catch (error) {
        console.error('❌ ProtectedRoute: Erro ao verificar tipo de usuário:', error);
        setUserTypeCheck({ loading: false, isOTC: false, isEmployee: false, type: '' });
      }
    };

    checkUserType();
  }, [isAuthenticated, user, requireAdmin, requireEmployee, location.pathname]);

  // Verificação de acesso

  // Mostrar loading enquanto verifica autenticação ou tipo de usuário
  if (isLoading || userTypeCheck.loading) {

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
    // Usuário não autenticado, redirecionando
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

    return <Navigate to="/client-statement" replace />;
  }

  // Verificar se é usuário funcionário tentando acessar área admin
  if (isAuthenticated && requireAdmin && userTypeCheck.isEmployee) {

    return <Navigate to="/employee-statement" replace />;
  }

  // Verificar se é usuário não-funcionário tentando acessar área de funcionário
  if (isAuthenticated && requireEmployee && !userTypeCheck.isEmployee) {

    
    // Redirecionar baseado no tipo de usuário
    if (userTypeCheck.isOTC) {
      return <Navigate to="/client-statement" replace />;
    } else {
      return <Navigate to="/" replace />; // Admin vai para dashboard
    }
  }


  // Se estiver autenticado e autorizado, renderizar filhos
  return <>{children}</>;
};

export default ProtectedRoute; 