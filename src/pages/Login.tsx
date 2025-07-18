import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, User, Lock, Building2, TrendingUp, Shield, BarChart3 } from 'lucide-react';
import { userTypeService } from '@/services/userType';
import { authService } from '@/services/auth';

// Schema de validação
const loginSchema = z.object({
  email: z.string().email('Email inválido').min(1, 'Email é obrigatório'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres')
});

type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Página de Login Unificada
 */
const Login: React.FC = () => {
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

  // Handler do submit unificado
  const onSubmit = async (data: LoginFormData) => {
    console.log('🔐 Login unificado para:', data.email);
    
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
            console.log('🔍 Login: Verificando tipo do usuário:', storedUser.id);
            
            const userTypeResult = await userTypeService.checkUserType(storedUser);
            
            console.log('🔍 Login: Resultado da verificação de tipo:', userTypeResult);
            
            if (userTypeResult.isOTC) {
              // Se é usuário OTC, redirecionar para extrato OTC
              console.log('🔄 Usuário OTC logado, redirecionando para /client-statement');
              navigate('/client-statement', { replace: true });
            } else if (userTypeResult.isAdmin) {
              // Se é admin, redirecionar para dashboard principal
              console.log('🔄 Admin logado, redirecionando para dashboard');
              const targetRoute = from === '/' || from === '/login' ? '/' : from;
              navigate(targetRoute, { replace: true });
            } else {
              // Fallback - assumir admin
              console.log('🔄 Tipo não identificado, assumindo admin e redirecionando para dashboard');
              navigate('/', { replace: true });
            }
          } else {
            console.warn('⚠️ Login: Usuário não encontrado no storage após login');
            navigate('/', { replace: true });
          }
        } catch (error) {
          console.error('❌ Login: Erro ao verificar tipo de usuário:', error);
          // Em caso de erro, redirecionar para dashboard por segurança
          console.log('🔄 Erro na verificação, redirecionando para dashboard');
          navigate('/', { replace: true });
        }
      }, 300); // Aumentar timeout para garantir que a API responda
    }
  };

  return (
    <div className="min-h-screen bg-black flex">
      {/* LADO ESQUERDO - 60% - Design e Branding */}
      <div className="hidden lg:flex lg:w-3/5 bg-black relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,165,0,0.1),transparent_50%)]"></div>
          <div className="absolute top-0 -left-4 w-72 h-72 bg-orange-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-orange-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-orange-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-4000"></div>
        </div>
        
        {/* Conteúdo do lado esquerdo */}
        <div className="relative z-10 flex flex-col justify-center px-12 py-12 text-white">
          {/* Logo/Brand */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                <Building2 className="w-7 h-7 text-black" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">TCR - OTC</h1>
                <p className="text-orange-200 text-sm">Plataforma Financeira</p>
              </div>
            </div>
          </div>

          {/* Título principal */}
          <div className="mb-8">
            <h2 className="text-4xl font-bold leading-tight mb-4 text-white">
              Gerencie suas
              <span className="block bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent">
                Operações Financeiras
              </span>
            </h2>
            <p className="text-lg text-gray-300 leading-relaxed">
              Acesse seu painel de controle para visualizar extratos, 
              gerenciar transações e acompanhar cotações em tempo real.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-orange-400" />
              </div>
              <span className="text-gray-300">Relatórios em tempo real</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-orange-400" />
              </div>
              <span className="text-gray-300">Análise de transações</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-orange-400" />
              </div>
              <span className="text-gray-300">Segurança avançada</span>
            </div>
          </div>

          {/* Footer info */}
          <div className="mt-auto pt-8">
            <p className="text-gray-500 text-sm">
              © 2024 Sistema OTC. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>

      {/* LADO DIREITO - 40% - Formulário de Login */}
      <div className="w-full lg:w-2/5 bg-gray-900 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Card className="border-gray-800 shadow-2xl bg-gray-800">
            <CardContent className="p-8">
              {/* Header do formulário */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-black" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  Bem-vindo de volta
                </h3>
                <p className="text-gray-400">
                  Faça login para acessar sua conta
                </p>
              </div>

              {/* Formulário */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Campo Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-white">
                    Email
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      className="pl-10 h-12 border-2 border-gray-700 bg-gray-900 text-white placeholder-gray-500 focus:border-orange-500 transition-colors"
                      {...register('email')}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-red-400 text-sm">{errors.email.message}</p>
                  )}
                </div>

                {/* Campo Senha */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-white">
                    Senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Digite sua senha"
                      className="pl-10 pr-10 h-12 border-2 border-gray-700 bg-gray-900 text-white placeholder-gray-500 focus:border-orange-500 transition-colors"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-red-400 text-sm">{errors.password.message}</p>
                  )}
                </div>

                {/* Botão de Login */}
                <Button
                  type="submit"
                  disabled={isSubmitting || isLoading}
                  className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-black font-semibold text-base transition-all duration-200 disabled:opacity-50"
                >
                  {isSubmitting || isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                      <span>Entrando...</span>
                    </div>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </form>

              {/* Informações adicionais */}
              <div className="mt-8 space-y-4">

                <div className="text-center">
                  <p className="text-gray-500 text-xs">
                    Problemas para acessar? Entre em contato com o suporte
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logo mobile - só aparece em telas pequenas */}
          <div className="lg:hidden text-center mt-6">
            <div className="flex items-center justify-center gap-2 text-white">
              <Building2 className="w-5 h-5 text-orange-500" />
              <span className="font-semibold">Sistema OTC</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login; 