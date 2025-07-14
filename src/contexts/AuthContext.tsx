import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, authService, LoginCredentials, RegisterData } from '@/services/auth';
import { toast } from 'sonner';

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
   * Inicializar contexto - verificar se já está logado
   */
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Verificar se há usuário no storage
        const storedUser = authService.getCurrentUser();
        const token = authService.getCurrentToken();

        if (storedUser && token) {
          // Tentar buscar perfil atualizado
          const profileResult = await authService.getProfile();
          
          if (profileResult.sucesso && profileResult.data) {
            setUser(profileResult.data);
          } else {
            // Token inválido, limpar dados
            authService.logout();
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Erro ao inicializar autenticação:', error);
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
        return true;
      } else {
        toast.error(result.mensagem || 'Erro no login');
        return false;
      }
    } catch (error) {
      console.error('Erro no login:', error);
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
   * Logout de usuário
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