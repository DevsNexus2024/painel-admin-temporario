import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, authService, LoginCredentials, RegisterData } from '@/services/auth';
import { userTypeService } from '@/services/userType';
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
   * Verifica tipo de usuário (apenas verificação, sem redirecionamento automático)
   */
  const checkUserType = async (userData: User) => {
    try {
      console.log('🔍 AuthProvider: Verificando tipo de usuário...');
      const isOTC = await userTypeService.isOTCUser(userData);
      
      if (isOTC) {
        console.log('ℹ️ AuthProvider: Usuário identificado como OTC');
      } else {
        console.log('ℹ️ AuthProvider: Usuário identificado como Admin');
      }
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
        console.log('🚀 AuthProvider: Inicializando autenticação...');
        
        // Verificar se há usuário no storage
        const storedUser = authService.getCurrentUser();
        const token = authService.getCurrentToken();

        console.log('🔍 AuthProvider: Verificando dados no storage:', {
          hasStoredUser: !!storedUser,
          hasToken: !!token
        });

        if (storedUser && token) {
          console.log('✅ AuthProvider: Dados encontrados no storage, buscando perfil atualizado...');
          
          // Tentar buscar perfil atualizado
          const profileResult = await authService.getProfile();
          
          console.log('🔍 AuthProvider: Resultado do perfil:', profileResult);
          
          if (profileResult.sucesso && profileResult.data) {
            console.log('✅ AuthProvider: Perfil atualizado com sucesso, definindo usuário:', profileResult.data);
            setUser(profileResult.data);
            
            // Apenas verificar tipo de usuário (sem redirecionamento automático)
            await checkUserType(profileResult.data);
          } else {
            console.log('❌ AuthProvider: Token inválido, limpando dados');
            // Token inválido, limpar dados
            authService.logout();
            setUser(null);
          }
        } else {
          console.log('ℹ️ AuthProvider: Nenhum dado no storage, usuário não logado');
        }
      } catch (error) {
        console.error('❌ AuthProvider: Erro ao inicializar autenticação:', error);
        authService.logout();
        setUser(null);
      } finally {
        console.log('🏁 AuthProvider: Inicialização concluída');
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
      console.log('🔐 AuthProvider: Iniciando login para:', credentials.email);
      setIsLoading(true);
      
      const result = await authService.login(credentials);
      
      console.log('🔐 AuthProvider: Resposta do serviço:', result);
      
      if (result.sucesso && result.data) {
        console.log('✅ AuthProvider: Login bem-sucedido, definindo usuário:', result.data.user);
        setUser(result.data.user);
        toast.success('Login realizado com sucesso!');
        
        // Apenas verificar tipo de usuário (redirecionamento fica por conta das rotas)
        await checkUserType(result.data.user);
        
        // Aguardar um pouco para garantir que o estado foi atualizado
        setTimeout(() => {
          console.log('🔄 AuthProvider: Estado do usuário após login:', result.data.user);
        }, 50);
        
        return true;
      } else {
        console.log('❌ AuthProvider: Login falhou:', result.mensagem);
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