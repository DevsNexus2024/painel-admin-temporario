import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService } from '@/services/auth';
import { userTypeService } from '@/services/userType';
import { toast } from 'sonner';
import { useLoginTimeout } from '@/hooks/useLoginTimeout';
import { LAST_ACTIVITY_STORAGE } from '@/config/api';
import {
  User,
  UserTypeResult,
  AuthContextType,
  LoginCredentials,
  Permission,
  UserRole,
  getUserPermissions
} from '@/types/auth';

// Criar o contexto
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider props
interface AuthProviderProps {
  children: ReactNode;
}

// Provider do contexto
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<UserTypeResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Computed state
  const isAuthenticated = !!user;

  /**
   * Logout de usuário (função separada para reutilizar)
   */
  const performLogout = () => {
    authService.logout();
    setUser(null);
    setUserType(null);
    toast.info('Sua sessão expirou. Faça login novamente.');
  };

  /**
   * Hook de timeout de login
   */
  const { updateActivity } = useLoginTimeout({
    enabled: isAuthenticated,
    onTimeout: performLogout,
    onWarning: (minutesRemaining) => {
      toast.warning(
        `Sua sessão expirará em ${minutesRemaining} minuto${minutesRemaining > 1 ? 's' : ''}. ` +
        'Mova o mouse ou clique em qualquer lugar para manter a sessão ativa.',
        {
          duration: 10000, // 10 segundos
          description: 'Atividade detectada automaticamente'
        }
      );
    }
  });

  /**
   * Verifica tipo de usuário e carrega permissões
   */
  const checkUserType = async (userData: User): Promise<UserTypeResult | null> => {
    try {

      
      const userTypeResult = await userTypeService.checkUserType(userData);
      

      
      // Adicionar permissões baseadas no role
      const permissions = getUserPermissions(userTypeResult.type);
      const completeUserType: UserTypeResult = {
        ...userTypeResult,
        permissions
      };
      

      
      setUserType(completeUserType);
      return completeUserType;
    } catch (error) {

      
      // Fallback para admin em caso de erro
      const fallbackUserType: UserTypeResult = {
        type: 'admin' as UserRole,
        isOTC: false,
        isAdmin: true,
        permissions: getUserPermissions('admin')
      };
      

      
      setUserType(fallbackUserType);
      return fallbackUserType;
    }
  };

  /**
   * Inicializar contexto - verificar se já está logado
   */
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Verificar se há usuário no storage
        const storedUser = authService.getCurrentUser();
        const token = authService.getCurrentToken();

        if (storedUser && token) {
          // Verificar se a sessão não expirou por inatividade
          if (LAST_ACTIVITY_STORAGE.isInactive()) {
            authService.logout();
            setUser(null);
            toast.info('Sua sessão expirou por inatividade. Faça login novamente.');
            return;
          }
          
          // [REFRESH] Se o access está expirado/expirando e há refresh válido, renova
          // ANTES de buscar o perfil — evita 401→logout ao reabrir o painel com o
          // access curto (1h) já vencido.
          if (authService.isTokenExpiringSoon()) {
            await authService.refreshAccessToken();
          }

          // Tentar buscar perfil atualizado
          const profileResult = await authService.getProfile();
          
          if (profileResult.sucesso && profileResult.data) {
            setUser(profileResult.data);
            
            // Verificar tipo de usuário e carregar permissões
            await checkUserType(profileResult.data);
          } else {
            // Token inválido, limpar dados
            authService.logout();
            setUser(null);
            setUserType(null);
          }
        }
      } catch (error) {

        authService.logout();
        setUser(null);
        setUserType(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  /**
   * [REFRESH] Renovação proativa do access token.
   * Verifica a cada 60s; quando o access está perto de expirar (janela de 5min do
   * authService), renova via refresh rotativo. Serializado no authService (sem race).
   * Se o refresh falhar (revogado/troca de senha/logout-all) → logout limpo.
   * Proativo de propósito: evita a tempestade de 401 e o "deslogou sozinho" do access curto.
   */
  useEffect(() => {
    if (!isAuthenticated) return;

    const REFRESH_CHECK_INTERVAL_MS = 60 * 1000;
    const intervalId = setInterval(async () => {
      try {
        if (authService.isTokenExpiringSoon()) {
          const ok = await authService.refreshAccessToken();
          if (!ok) performLogout();
        }
      } catch {
        performLogout();
      }
    }, REFRESH_CHECK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isAuthenticated]);

  /**
   * Login de usuário
   */
  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      const result = await authService.login(credentials);
      
      if (result.sucesso && result.data) {
        setUser(result.data.user);
        
        // Verificar tipo de usuário e carregar permissões
        const userTypeResult = await checkUserType(result.data.user);
        

        
        toast.success('Login realizado com sucesso!');
        return true;
      } else {
        toast.error(result.mensagem || 'Erro no login');
        return false;
      }
    } catch (error) {

      toast.error('Erro de conexão. Tente novamente.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout de usuário (manual)
   */
  const logout = () => {
    authService.logout();
    setUser(null);
    setUserType(null);
    toast.info('Logout realizado com sucesso');
  };

  /**
   * Atualizar perfil do usuário
   */
  const refreshProfile = async (): Promise<void> => {
    try {
      const result = await authService.getProfile();
      
      if (result.sucesso && result.data) {
        setUser(result.data);
        
        // Recarregar tipo de usuário e permissões
        await checkUserType(result.data);
      } else {
        // Token inválido, fazer logout
        logout();
      }
    } catch (error) {

      logout();
    }
  };

  /**
   * Funções de verificação de permissões
   */
  const checkPermission = (permission: Permission): boolean => {
    if (!isAuthenticated || !user || !userType) return false;
    
    return userType.permissions.includes(permission) || userType.permissions.includes('admin.full_access');
  };

  const hasRole = (role: UserRole): boolean => {
    if (!isAuthenticated || !user || !userType) return false;
    
    return userType.type === role;
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    if (!isAuthenticated || !user || !userType) return false;
    
    return roles.includes(userType.type);
  };

  const hasAllPermissions = (permissions: Permission[]): boolean => {
    if (!isAuthenticated || !user || !userType) return false;
    
    return permissions.every(permission => checkPermission(permission));
  };

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    if (!isAuthenticated || !user || !userType) return false;
    
    return permissions.some(permission => checkPermission(permission));
  };

  // Valor do contexto
  const contextValue: AuthContextType = {
    // Estado
    user,
    userType,
    isAuthenticated,
    isLoading,

    // Ações
    login,
    logout,
    refreshProfile,
    
    // Verificações de permissão
    checkPermission,
    hasRole,
    hasAnyRole,
    hasAllPermissions,
    hasAnyPermission
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook para usar o contexto
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  
  return context;
};

export default AuthContext; 