/**
 * 🔐 HOOKS DE AUTENTICAÇÃO E PERMISSÕES
 * Sistema completo de verificação de acesso
 */

import { useContext } from 'react';
import AuthContext from '@/contexts/AuthContext';
import { Permission, UserRole, hasPermission, hasAnyPermission, hasAllPermissions, ROUTE_PERMISSIONS } from '@/types/auth';

// Re-exportar o hook básico do contexto
export { useAuth } from '@/contexts/AuthContext';

/**
 * Hook avançado para verificações de permissões
 */
export const usePermissions = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('usePermissions deve ser usado dentro de um AuthProvider');
  }

  const { user, userType, isAuthenticated } = context;

  /**
   * Verifica se usuário tem permissão específica
   */
  const checkPermission = (permission: Permission): boolean => {
    if (!isAuthenticated || !user || !userType) return false;
    
    return hasPermission(userType.permissions, permission);
  };

  /**
   * Verifica se usuário tem pelo menos uma das permissões
   */
  const checkAnyPermission = (permissions: Permission[]): boolean => {
    if (!isAuthenticated || !user || !userType) return false;
    
    return hasAnyPermission(userType.permissions, permissions);
  };

  /**
   * Verifica se usuário tem todas as permissões
   */
  const checkAllPermissions = (permissions: Permission[]): boolean => {
    if (!isAuthenticated || !user || !userType) return false;
    
    return hasAllPermissions(userType.permissions, permissions);
  };

  /**
   * Verifica se usuário tem role específico
   */
  const hasRole = (role: UserRole): boolean => {
    if (!isAuthenticated || !user || !userType) return false;
    
    return userType.type === role;
  };

  /**
   * Verifica se usuário tem um dos roles
   */
  const hasAnyRole = (roles: UserRole[]): boolean => {
    if (!isAuthenticated || !user || !userType) return false;
    
    return roles.includes(userType.type);
  };

  /**
   * Verifica se é admin
   */
  const isAdmin = (): boolean => {
    return hasRole('admin') || hasRole('super_admin') || checkPermission('admin.full_access');
  };

  /**
   * Verifica se é cliente OTC
   */
  const isOTCClient = (): boolean => {
    return hasRole('otc_client') || (userType?.isOTC && !userType?.isEmployee);
  };

  /**
   * Verifica se é funcionário OTC
   */
  const isOTCEmployee = (): boolean => {
    return hasRole('otc_employee') || (userType?.isEmployee === true);
  };

  /**
   * Verifica se é gerente
   */
  const isManager = (): boolean => {
    return hasRole('manager');
  };

  return {
    // Verificações de permissão
    checkPermission,
    checkAnyPermission,
    checkAllPermissions,
    
    // Verificações de role
    hasRole,
    hasAnyRole,
    isAdmin,
    isOTCClient,
    isOTCEmployee,
    isManager,
    
    // Dados do usuário
    user,
    userType,
    isAuthenticated,
    permissions: userType?.permissions || []
  };
};

/**
 * Hook para proteção de rotas
 */
export const useRouteGuard = () => {
  const { isAuthenticated, isLoading } = useContext(AuthContext) || {};
  const { checkPermission, hasRole, hasAnyRole } = usePermissions();

  const findRouteConfig = (currentPath: string) => {
    // 1) Match exato
    if (ROUTE_PERMISSIONS[currentPath]) {
      return ROUTE_PERMISSIONS[currentPath];
    }

    // 2) Match por pattern com params (ex: /analise-usuario/:id)
    for (const [pattern, config] of Object.entries(ROUTE_PERMISSIONS)) {
      if (!pattern.includes(':')) continue;

      // Construção de regex robusta:
      // 1) Marca params (":id") antes de escapar
      // 2) Escapa o restante do pattern
      // 3) Substitui os marcadores por "[^/]+"
      const PARAM_MARKER = '__ROUTE_PARAM__';
      const withMarkers = pattern.replace(/:([^/]+)/g, PARAM_MARKER);
      const escaped = withMarkers.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regexStr = '^' + escaped.split(PARAM_MARKER).join('[^/]+') + '$';

      const regex = new RegExp(regexStr);
      if (regex.test(currentPath)) {
        return config;
      }
    }

    return undefined;
  };

  /**
   * Verifica se usuário pode acessar rota específica
   */
  const canAccessRoute = (routePath: string): boolean => {
    if (isLoading) return false;
    if (!isAuthenticated) return false;

    const routeConfig = findRouteConfig(routePath);
    if (!routeConfig) return true; // Rota sem restrições

    // Verificar role específico
    if (routeConfig.requiredRole) {
      return hasRole(routeConfig.requiredRole);
    }

    // Verificar roles permitidos
    if (routeConfig.allowedRoles && routeConfig.allowedRoles.length > 0) {
      return hasAnyRole(routeConfig.allowedRoles);
    }

    // Verificar permissões necessárias
    if (routeConfig.requiredPermissions && routeConfig.requiredPermissions.length > 0) {
      return routeConfig.requiredPermissions.every(permission => checkPermission(permission));
    }

    // Verificar flags específicas
    if (routeConfig.requireAdmin && !(hasRole('admin') || hasRole('super_admin'))) {
      return false;
    }

    if (routeConfig.requireEmployee && !hasRole('otc_employee')) {
      return false;
    }

    return true;
  };

  /**
   * Verifica acesso genérico com opções
   */
  const canAccess = (options: {
    requireAuth?: boolean;
    requiredRole?: UserRole;
    requiredPermissions?: Permission[];
    allowedRoles?: UserRole[];
  } = {}): boolean => {
    const { 
      requireAuth = true, 
      requiredRole, 
      requiredPermissions, 
      allowedRoles 
    } = options;

    if (isLoading) return false;
    
    if (requireAuth && !isAuthenticated) return false;
    if (!requireAuth) return true;

    if (requiredRole && !hasRole(requiredRole)) return false;
    if (allowedRoles && allowedRoles.length > 0 && !hasAnyRole(allowedRoles)) return false;
    if (requiredPermissions && requiredPermissions.length > 0) {
      return requiredPermissions.every(permission => checkPermission(permission));
    }

    return true;
  };

  return {
    canAccessRoute,
    canAccess,
    isLoading: isLoading || false,
    isAuthenticated: isAuthenticated || false
  };
};

/**
 * Hook para componentes condicionais baseados em permissões
 */
export const useConditionalRender = () => {
  const { checkPermission, hasRole, hasAnyRole, isAuthenticated } = usePermissions();

  /**
   * Renderiza componente se usuário tem permissão
   */
  const renderIfPermission = (permission: Permission, component: React.ReactNode): React.ReactNode => {
    return checkPermission(permission) ? component : null;
  };

  /**
   * Renderiza componente se usuário tem role
   */
  const renderIfRole = (role: UserRole, component: React.ReactNode): React.ReactNode => {
    return hasRole(role) ? component : null;
  };

  /**
   * Renderiza componente se usuário tem um dos roles
   */
  const renderIfAnyRole = (roles: UserRole[], component: React.ReactNode): React.ReactNode => {
    return hasAnyRole(roles) ? component : null;
  };

  /**
   * Renderiza componente se autenticado
   */
  const renderIfAuthenticated = (component: React.ReactNode): React.ReactNode => {
    return isAuthenticated ? component : null;
  };

  /**
   * Renderiza componente se NÃO autenticado
   */
  const renderIfNotAuthenticated = (component: React.ReactNode): React.ReactNode => {
    return !isAuthenticated ? component : null;
  };

  return {
    renderIfPermission,
    renderIfRole,
    renderIfAnyRole,
    renderIfAuthenticated,
    renderIfNotAuthenticated
  };
}; 