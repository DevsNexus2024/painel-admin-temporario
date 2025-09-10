/**
 * 🔐 COMPONENTES DE PROTEÇÃO POR PERMISSÕES
 * Componentes para mostrar/ocultar elementos baseado em permissões do usuário
 */

import React, { ReactNode } from 'react';
import { usePermissions } from '@/hooks/useAuth';
import { Permission, UserRole } from '@/types/auth';

// ===== GUARD POR PERMISSÃO =====

interface PermissionGuardProps {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
  showFallback?: boolean;
}

/**
 * Componente que renderiza filhos apenas se usuário tem a permissão
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({ 
  permission, 
  children, 
  fallback = null, 
  showFallback = false 
}) => {
  const { checkPermission } = usePermissions();

  if (checkPermission(permission)) {
    return <>{children}</>;
  }

  return showFallback ? <>{fallback}</> : null;
};

// ===== GUARD POR MÚLTIPLAS PERMISSÕES =====

interface MultiPermissionGuardProps {
  permissions: Permission[];
  children: ReactNode;
  fallback?: ReactNode;
  showFallback?: boolean;
  requireAll?: boolean; // true = precisa de todas, false = precisa de pelo menos uma
}

/**
 * Componente que renderiza filhos baseado em múltiplas permissões
 */
export const MultiPermissionGuard: React.FC<MultiPermissionGuardProps> = ({ 
  permissions, 
  children, 
  fallback = null, 
  showFallback = false,
  requireAll = false 
}) => {
  const { checkAllPermissions, checkAnyPermission } = usePermissions();

  const hasAccess = requireAll 
    ? checkAllPermissions(permissions)
    : checkAnyPermission(permissions);

  if (hasAccess) {
    return <>{children}</>;
  }

  return showFallback ? <>{fallback}</> : null;
};

// ===== GUARD POR ROLE =====

interface RoleGuardProps {
  role: UserRole;
  children: ReactNode;
  fallback?: ReactNode;
  showFallback?: boolean;
}

/**
 * Componente que renderiza filhos apenas se usuário tem o role
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({ 
  role, 
  children, 
  fallback = null, 
  showFallback = false 
}) => {
  const { hasRole } = usePermissions();

  if (hasRole(role)) {
    return <>{children}</>;
  }

  return showFallback ? <>{fallback}</> : null;
};

// ===== GUARD POR MÚLTIPLOS ROLES =====

interface MultiRoleGuardProps {
  roles: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
  showFallback?: boolean;
}

/**
 * Componente que renderiza filhos se usuário tem um dos roles
 */
export const MultiRoleGuard: React.FC<MultiRoleGuardProps> = ({ 
  roles, 
  children, 
  fallback = null, 
  showFallback = false 
}) => {
  const { hasAnyRole } = usePermissions();

  if (hasAnyRole(roles)) {
    return <>{children}</>;
  }

  return showFallback ? <>{fallback}</> : null;
};

// ===== GUARD DE AUTENTICAÇÃO =====

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  showFallback?: boolean;
  requireAuth?: boolean;
}

/**
 * Componente que renderiza filhos apenas se usuário está autenticado
 */
export const AuthGuard: React.FC<AuthGuardProps> = ({ 
  children, 
  fallback = null, 
  showFallback = false,
  requireAuth = true 
}) => {
  const { isAuthenticated } = usePermissions();

  if (requireAuth && !isAuthenticated) {
    return showFallback ? <>{fallback}</> : null;
  }

  if (!requireAuth && isAuthenticated) {
    return showFallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
};

// ===== GUARD ADMINISTRATIVO =====

interface AdminGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  showFallback?: boolean;
}

/**
 * Componente que renderiza filhos apenas para administradores
 */
export const AdminGuard: React.FC<AdminGuardProps> = ({ 
  children, 
  fallback = null, 
  showFallback = false 
}) => {
  const { isAdmin } = usePermissions();

  if (isAdmin()) {
    return <>{children}</>;
  }

  return showFallback ? <>{fallback}</> : null;
};

// ===== GUARD OTC =====

interface OTCGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  showFallback?: boolean;
  clientOnly?: boolean; // true = apenas clientes, false = clientes + funcionários
}

/**
 * Componente que renderiza filhos para usuários OTC
 */
export const OTCGuard: React.FC<OTCGuardProps> = ({ 
  children, 
  fallback = null, 
  showFallback = false,
  clientOnly = false 
}) => {
  const { isOTCClient, isOTCEmployee } = usePermissions();

  const hasAccess = clientOnly 
    ? isOTCClient() 
    : (isOTCClient() || isOTCEmployee());

  if (hasAccess) {
    return <>{children}</>;
  }

  return showFallback ? <>{fallback}</> : null;
};

// ===== GUARD CONDICIONAL AVANÇADO =====

interface ConditionalGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  showFallback?: boolean;
  condition?: () => boolean;
  requiredRole?: UserRole;
  allowedRoles?: UserRole[];
  requiredPermissions?: Permission[];
  anyPermissions?: Permission[];
  requireAuth?: boolean;
}

/**
 * Componente avançado com múltiplas condições de acesso
 */
export const ConditionalGuard: React.FC<ConditionalGuardProps> = ({ 
  children, 
  fallback = null, 
  showFallback = false,
  condition,
  requiredRole,
  allowedRoles,
  requiredPermissions,
  anyPermissions,
  requireAuth = true
}) => {
  const { 
    isAuthenticated, 
    hasRole, 
    hasAnyRole, 
    checkAllPermissions, 
    checkAnyPermission 
  } = usePermissions();

  // Verificar autenticação
  if (requireAuth && !isAuthenticated) {
    return showFallback ? <>{fallback}</> : null;
  }

  // Verificar condição personalizada
  if (condition && !condition()) {
    return showFallback ? <>{fallback}</> : null;
  }

  // Verificar role específico
  if (requiredRole && !hasRole(requiredRole)) {
    return showFallback ? <>{fallback}</> : null;
  }

  // Verificar roles permitidos
  if (allowedRoles && allowedRoles.length > 0 && !hasAnyRole(allowedRoles)) {
    return showFallback ? <>{fallback}</> : null;
  }

  // Verificar permissões obrigatórias (todas)
  if (requiredPermissions && requiredPermissions.length > 0 && !checkAllPermissions(requiredPermissions)) {
    return showFallback ? <>{fallback}</> : null;
  }

  // Verificar permissões alternativas (pelo menos uma)
  if (anyPermissions && anyPermissions.length > 0 && !checkAnyPermission(anyPermissions)) {
    return showFallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
};

// ===== COMPONENTE DE ACESSO NEGADO =====

interface AccessDeniedProps {
  title?: string;
  message?: string;
  showDetails?: boolean;
  requiredRole?: UserRole;
  requiredPermissions?: Permission[];
  className?: string;
}

/**
 * Componente para exibir mensagem de acesso negado
 */
export const AccessDenied: React.FC<AccessDeniedProps> = ({
  title = "Acesso Negado",
  message = "Você não tem permissão para acessar este recurso.",
  showDetails = false,
  requiredRole,
  requiredPermissions,
  className = ""
}) => {
  return (
    <div className={`text-center p-8 bg-red-50 border border-red-200 rounded-lg ${className}`}>
      <div className="text-red-600 mb-4">
        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      
      <h3 className="text-lg font-semibold text-red-800 mb-2">{title}</h3>
      <p className="text-red-600 mb-4">{message}</p>
      
      {showDetails && (requiredRole || requiredPermissions) && (
        <div className="text-sm text-red-500 border-t border-red-200 pt-4">
          {requiredRole && (
            <p><strong>Role necessário:</strong> {requiredRole}</p>
          )}
          {requiredPermissions && requiredPermissions.length > 0 && (
            <div>
              <p><strong>Permissões necessárias:</strong></p>
              <ul className="list-disc list-inside mt-1">
                {requiredPermissions.map(permission => (
                  <li key={permission}>{permission}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      
      <div className="mt-4 flex gap-3 justify-center">
        <button 
          onClick={() => window.history.back()} 
          className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
        >
          Voltar
        </button>
        <button 
          onClick={() => {
            // Limpar localStorage e redirecionar para login
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }} 
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
        >
          Fazer Logout
        </button>
      </div>
    </div>
  );
};

// ===== EXPORTS =====
export default {
  PermissionGuard,
  MultiPermissionGuard,
  RoleGuard,
  MultiRoleGuard,
  AuthGuard,
  AdminGuard,
  OTCGuard,
  ConditionalGuard,
  AccessDenied
};
