// Re-exportar o hook do contexto para facilitar importações
export { useAuth } from '@/contexts/AuthContext';

// Hook adicional para verificações específicas
import { useAuth as useAuthContext } from '@/contexts/AuthContext';

/**
 * Hook para verificar se usuário tem permissão específica
 * (para futuras implementações de roles/permissões)
 */
export const useAuthPermissions = () => {
  const { user, isAuthenticated } = useAuthContext();

  const hasPermission = (permission: string): boolean => {
    if (!isAuthenticated || !user) return false;
    
    // Por enquanto, todos os usuários autenticados têm todas as permissões
    // Futuramente pode implementar sistema de roles
    return true;
  };

  const isAdmin = (): boolean => {
    if (!isAuthenticated || !user) return false;
    
    // Implementar lógica de admin quando necessário
    return false;
  };

  return {
    hasPermission,
    isAdmin,
    user,
    isAuthenticated
  };
};

/**
 * Hook para proteção de rotas
 */
export const useAuthGuard = () => {
  const { isAuthenticated, isLoading } = useAuthContext();

  const canAccess = (requireAuth: boolean = true): boolean => {
    if (isLoading) return false;
    
    return requireAuth ? isAuthenticated : true;
  };

  return {
    canAccess,
    isLoading,
    isAuthenticated
  };
}; 