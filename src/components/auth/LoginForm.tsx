import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { userTypeService } from '@/services/userType';
import { authService } from '@/services/auth';
import { useState } from 'react';

// Schema de validação
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido'),
  password: z
    .string()
    .min(6, 'Senha deve ter pelo menos 6 caracteres')
});

type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Formulário de login
 */
const LoginForm: React.FC = () => {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);

  // Estado para onde redirecionar após login
  const from = (location.state as any)?.from || '/';

  // Configurar formulário com validação
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  });

  // Handler do submit
  const onSubmit = async (data: LoginFormData) => {
    const success = await login({
      email: data.email,
      password: data.password
    });
    
    if (success) {
      // Aguardar um pouco para o estado atualizar e então verificar tipo de usuário
      setTimeout(async () => {
        try {
          // Buscar usuário atualizado do storage
          const storedUser = authService.getCurrentUser();
          if (storedUser) {
            const isOTC = await userTypeService.isOTCUser(storedUser);
            
            if (isOTC) {
              // Se é usuário OTC, redirecionar para extrato OTC
              console.log('🔄 LoginForm: Usuário OTC logado via admin, redirecionando para /client-statement');
              navigate('/client-statement', { replace: true });
            } else {
              // Se é admin, redirecionar normalmente
              navigate(from, { replace: true });
            }
          } else {
            navigate(from, { replace: true });
          }
        } catch (error) {
          console.error('❌ LoginForm: Erro ao verificar tipo de usuário:', error);
          // Em caso de erro, redirecionar normalmente
          navigate(from, { replace: true });
        }
      }, 200);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            <LogIn className="h-6 w-6" />
            Entrar
          </CardTitle>
          <CardDescription>
            Entre com suas credenciais para acessar o sistema
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                {...register('email')}
                disabled={isSubmitting || isLoading}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* Senha */}
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Sua senha"
                  {...register('password')}
                  disabled={isSubmitting || isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isSubmitting || isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            {/* Botão de submit */}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || isLoading}
            >
              {(isSubmitting || isLoading) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Entrar
                </>
              )}
            </Button>

            {/* Link para registro - DESBLOQUEADO TEMPORARIAMENTE */}
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Não tem uma conta?{' '}
                <Link
                  to="/register"
                  className="text-primary hover:underline font-medium"
                >
                  Registre-se aqui
                </Link>
              </p>
              
              <div className="border-t pt-2">
                <p className="text-sm text-muted-foreground">
                  Você é cliente OTC?{' '}
                  <Link
                    to="/login-cliente"
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Acesse seu extrato
                  </Link>
                </p>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginForm; 