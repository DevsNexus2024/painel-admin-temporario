import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, usePermissions, useRouteGuard } from '@/hooks/useAuth';
import { Permission, UserRole, ROUTE_PERMISSIONS } from '@/types/auth';
import { Loader2 } from 'lucide-react';
import { AccessDenied } from './PermissionGuard';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
  
  // Opções de proteção por role
  requireAdmin?: boolean;
  requireEmployee?: boolean;
  requiredRole?: UserRole;
  allowedRoles?: UserRole[];
  
  // Opções de proteção por permissão
  requiredPermissions?: Permission[];
  anyPermissions?: Permission[];
  
  // Customização
  showAccessDenied?: boolean;
  customFallback?: ReactNode;
}

/**
 * 🔐 COMPONENTE MELHORADO PARA PROTEÇÃO DE ROTAS
 * Sistema completo de verificação de acesso com roles e permissões
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  redirectTo = '/login',
  requireAdmin = false,
  requireEmployee = false,
  requiredRole,
  allowedRoles,
  requiredPermissions,
  anyPermissions,
  showAccessDenied = true,
  customFallback
}) => {
  const { isAuthenticated, isLoading, user, userType } = useAuth();
  const { 
    checkPermission, 
    checkAllPermissions, 
    checkAnyPermission,
    hasRole, 
    hasAnyRole,
    isAdmin,
    isOTCClient,
    isOTCEmployee 
  } = usePermissions();
  const { canAccessRoute } = useRouteGuard();
  const location = useLocation();

  /**
   * Verificar acesso baseado na configuração automática de rotas
   */
  const checkRouteAccess = (): boolean => {
    if (!isAuthenticated) return false;



    // Verificar props manuais do componente PRIMEIRO (prioridade alta)
    if (requireAdmin && !isAdmin()) {

      return false;
    }
    
    if (requireEmployee && !isOTCEmployee()) {

      return false;
    }
    
    if (requiredRole && !hasRole(requiredRole)) {

      return false;
    }
    
    if (allowedRoles && allowedRoles.length > 0 && !hasAnyRole(allowedRoles)) {

      return false;
    }
    
    if (requiredPermissions && requiredPermissions.length > 0 && !checkAllPermissions(requiredPermissions)) {

      return false;
    }
    
    if (anyPermissions && anyPermissions.length > 0 && !checkAnyPermission(anyPermissions)) {

      return false;
    }

    // Se passou nas verificações manuais, verificar configuração de rotas
    const currentPath = location.pathname;
    const routeAccess = canAccessRoute(currentPath);
    

    return true;
  };

  /**
   * Determinar rota de redirecionamento baseada no tipo de usuário
   */
  const getRedirectRoute = (): string => {
    if (!userType) {

      return redirectTo;
    }



    // 1ª Prioridade: Funcionário OTC
    if (userType.isEmployee || userType.type === 'otc_employee') {

      return '/employee-statement';
    }
    
    // 2ª Prioridade: Cliente OTC (mas não funcionário)
    if (userType.isOTC && !userType.isEmployee) {

      return '/client-statement';
    }
    
    // 3ª Prioridade: Admin
    if (userType.isAdmin || userType.type === 'admin') {

      return '/';
    }


    return redirectTo;
  };

  // ===== VERIFICAÇÕES DE ACESSO =====

  // Mostrar loading enquanto verifica autenticação
  if (isLoading) {
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
    return (
      <Navigate 
        to={redirectTo} 
        state={{ from: location.pathname }} 
        replace 
      />
    );
  }

  // Verificar se usuário tem acesso à rota
  const hasAccess = checkRouteAccess();
  
  if (!hasAccess) {
    // Se deve mostrar página de acesso negado
    if (showAccessDenied) {
      if (customFallback) {
        return <>{customFallback}</>;
      }

      return (
        <AccessDenied
          title="Acesso Restrito"
          message="Você não tem permissão para acessar esta página."
          showDetails={true}
          requiredRole={requiredRole}
          requiredPermissions={requiredPermissions}
          className="mt-8 mx-4"
        />
      );
    }

    // Caso contrário, redirecionar para rota apropriada
    const redirectRoute = getRedirectRoute();
    return <Navigate to={redirectRoute} replace />;
  }

  // Se estiver autenticado e autorizado, renderizar filhos
  return <>{children}</>;
};

export default ProtectedRoute; 