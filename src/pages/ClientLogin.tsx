import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, User, Lock, CreditCard, Settings } from 'lucide-react';

// Schema de validação
const loginSchema = z.object({
  email: z.string().email('Email inválido').min(1, 'Email é obrigatório'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres')
});

type LoginFormData = z.infer<typeof loginSchema>;

const ClientLogin: React.FC = () => {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);

  // Estado para onde redirecionar após login
  const from = (location.state as any)?.from || '/client-statement';

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
    console.log('🔐 Iniciando login OTC para:', data.email);
    console.log('🎯 Redirecionamento configurado para:', from);
    
    const success = await login({ 
      email: data.email, 
      password: data.password 
    });
    
    console.log('✅ Login resultado:', success);
    
    if (success) {
      console.log('🚀 Redirecionando para:', from);
      console.log('🔄 Estado da localização:', location.state);
      
      // Redirecionamento direto para /client-statement (usuários OTC sempre vão para lá)
      const targetRoute = from === '/' ? '/client-statement' : from;
      
      setTimeout(() => {
        console.log('🔄 Executando redirecionamento para:', targetRoute);
        navigate(targetRoute, { replace: true });
      }, 100);
    } else {
      console.log('❌ Login falhou, não redirecionando');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="banking-shadow-lg">
          <CardHeader className="space-y-4 pb-8">
            <div className="text-center">
              <div className="bg-primary rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <CreditCard className="h-8 w-8 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl font-bold text-foreground">
                Acesso Cliente OTC
              </CardTitle>
              <p className="text-muted-foreground text-sm">
                Faça login para acessar seu extrato
              </p>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Campo Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-muted-foreground">
                  Email
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    className="pl-10 focus:border-primary"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-red-500 text-sm">{errors.email.message}</p>
                )}
              </div>

              {/* Campo Senha */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-muted-foreground">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Digite sua senha"
                    className="pl-10 pr-10 focus:border-primary"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-sm">{errors.password.message}</p>
                )}
              </div>

              {/* Botão de Login */}
              <Button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                {isSubmitting || isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
                    <span>Entrando...</span>
                  </div>
                ) : (
                  'Acessar Extrato'
                )}
              </Button>
            </form>

            {/* Informações Adicionais */}
            <div className="space-y-4">
              <div className="border-t border-border pt-4">
                <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
                  <p className="text-primary text-sm font-medium mb-1">
                    💡 Acesso Exclusivo para Clientes OTC
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Esta área é restrita para clientes cadastrados no sistema OTC. 
                    Use suas credenciais de acesso fornecidas pela equipe.
                  </p>
                </div>
              </div>

              <div className="text-center">
                <p className="text-muted-foreground text-xs">
                  Problemas para acessar? Entre em contato com o suporte
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-muted-foreground/70 text-xs">
            © 2024 Sistema OTC - Acesso Cliente
          </p>
        </div>
      </div>
    </div>
  );
};

export default ClientLogin; 