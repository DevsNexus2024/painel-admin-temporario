import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, authService, LoginCredentials, RegisterData } from '@/services/auth';
import { userTypeService } from '@/services/userType';
import { toast } from 'sonner';
import { useLoginTimeout } from '@/hooks/useLoginTimeout';
import { LAST_ACTIVITY_STORAGE } from '@/config/api';

// Tipos do contexto
interface AuthContextType {
  // Estado
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Ações
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (data: RegisterData) => Promise<boolean>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

// Criar o contexto
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider props
interface AuthProviderProps {
  children: ReactNode;
}

// Provider do contexto
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Computed state
  const isAuthenticated = !!user;

  /**
   * Logout de usuário (função separada para reutilizar)
   */
  const performLogout = () => {
    authService.logout();
    setUser(null);
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
   * Verifica tipo de usuário (apenas verificação, sem redirecionamento automático)
   */
  const checkUserType = async (userData: User) => {
    try {
      const isOTC = await userTypeService.isOTCUser(userData);
      return isOTC;
    } catch (error) {
      console.error('❌ AuthProvider: Erro ao verificar tipo de usuário:', error);
      return false;
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
          
          // Tentar buscar perfil atualizado
          const profileResult = await authService.getProfile();
          
          if (profileResult.sucesso && profileResult.data) {
            setUser(profileResult.data);
            
            // Apenas verificar tipo de usuário (sem redirecionamento automático)
            await checkUserType(profileResult.data);
          } else {
            // Token inválido, limpar dados
            authService.logout();
            setUser(null);
          }
        }
      } catch (error) {
        console.error('❌ AuthProvider: Erro ao inicializar autenticação:', error);
        authService.logout();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  /**
   * Login de usuário
   */
  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      const result = await authService.login(credentials);
      
      if (result.sucesso && result.data) {
        setUser(result.data.user);
        toast.success('Login realizado com sucesso!');
        
        // Apenas verificar tipo de usuário (redirecionamento fica por conta das rotas)
        await checkUserType(result.data.user);
        
        return true;
      } else {
        toast.error(result.mensagem || 'Erro no login');
        return false;
      }
    } catch (error) {
      console.error('❌ AuthProvider: Erro no login:', error);
      toast.error('Erro de conexão. Tente novamente.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Registro de usuário
   */
  const register = async (data: RegisterData): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      const result = await authService.register(data);
      
      if (result.sucesso && result.data) {
        setUser(result.data.user);
        toast.success('Registro realizado com sucesso!');
        return true;
      } else {
        toast.error(result.mensagem || 'Erro no registro');
        return false;
      }
    } catch (error) {
      console.error('Erro no registro:', error);
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
      } else {
        // Token inválido, fazer logout
        logout();
      }
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      logout();
    }
  };

  // Valor do contexto
  const contextValue: AuthContextType = {
    // Estado
    user,
    isAuthenticated,
    isLoading,

    // Ações
    login,
    register,
    logout,
    refreshProfile
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