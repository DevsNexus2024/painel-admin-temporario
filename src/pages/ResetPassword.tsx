/**
 * 🔐 Página Temporária de Reset de Senha (BaaS v2)
 * 
 * TEMPORÁRIO - Será removido após migração completa
 * 
 * Fluxo:
 * 1. Se não tiver token na URL: mostrar formulário para solicitar reset (email)
 * 2. Se tiver token na URL: mostrar formulário para resetar senha (nova senha)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Mail, Lock, CheckCircle, AlertCircle, ArrowLeft, Copy, ExternalLink } from 'lucide-react';
import { authService } from '@/services/auth';
import { toast } from 'sonner';

// Schema para solicitar reset
const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido').min(1, 'Email é obrigatório'),
});

// Schema para resetar senha
const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  confirmPassword: z.string().min(8, 'Confirmação de senha é obrigatória'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(token);
  const [resetLink, setResetLink] = useState<string | null>(null);

  // Se tiver token na URL, estamos na etapa de resetar senha
  const isResetStep = !!resetToken;

  // Formulário para solicitar reset
  const forgotPasswordForm = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  // Formulário para resetar senha
  const resetPasswordForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  // Handler para solicitar reset
  const onForgotPasswordSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      const result = await authService.forgotPassword(data.email);

      if (result.sucesso) {
        toast.success('Token de reset gerado com sucesso!');

        // Se recebeu token, construir link de reset
        if (result.token) {
          const link = `${window.location.origin}/reset-password?token=${result.token}`;
          setResetLink(link);
          setResetToken(result.token);
          // Limpar formulário de email ao mudar para etapa de reset
          forgotPasswordForm.reset();
        } else {
          toast.info('Verifique seu email para o link de reset de senha.');
        }
      } else {
        toast.error(result.mensagem || 'Erro ao solicitar reset de senha');
      }
    } catch (error) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler para resetar senha
  const onResetPasswordSubmit = async (data: ResetPasswordFormData) => {
    if (!resetToken) {
      toast.error('Token de reset não encontrado');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authService.resetPassword(resetToken, data.newPassword);

      if (result.sucesso) {
        toast.success(result.mensagem || 'Senha resetada com sucesso!');
        
        // Redirecionar para login após 2 segundos
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
      } else {
        toast.error(result.mensagem || 'Erro ao resetar senha');
      }
    } catch (error) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Copiar link para clipboard
  const copyResetLink = () => {
    if (resetLink) {
      navigator.clipboard.writeText(resetLink);
      toast.success('Link copiado para a área de transferência!');
    }
  };

  return (
    <div className="min-h-screen bg-black flex">
      {/* LADO ESQUERDO - 60% - Design e Branding */}
      <div className="hidden lg:flex lg:w-3/5 bg-black relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,165,0,0.1),transparent_50%)]"></div>
        </div>
        
        <div className="relative z-10 flex flex-col justify-center px-12 py-12 text-white">
          <div className="mb-8">
            <h2 className="text-4xl font-bold leading-tight mb-4 text-white">
              Reset de Senha
            </h2>
            <p className="text-lg text-gray-300 leading-relaxed">
              {isResetStep 
                ? 'Digite sua nova senha para concluir o reset'
                : 'Digite seu email para receber o link de reset de senha'
              }
            </p>
          </div>
        </div>
      </div>

      {/* LADO DIREITO - 40% - Formulário */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-6 bg-black">
        <Card className="w-full max-w-md border-orange-500/20 bg-black/50 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-white text-center">
              {isResetStep ? 'Nova Senha' : 'Reset de Senha'}
            </CardTitle>
            <CardDescription className="text-center text-gray-400">
              {isResetStep 
                ? 'Digite sua nova senha abaixo'
                : 'Digite seu email para receber o link de reset'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isResetStep ? (
              // Formulário para solicitar reset
              <form onSubmit={forgotPasswordForm.handleSubmit(onForgotPasswordSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      className="pl-10 bg-black/50 border-gray-700 text-white"
                      {...forgotPasswordForm.register('email')}
                    />
                  </div>
                  {forgotPasswordForm.formState.errors.email && (
                    <p className="text-sm text-red-500">
                      {forgotPasswordForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                {resetLink && (
                  <Alert className="bg-orange-500/10 border-orange-500/20">
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    <AlertDescription className="text-white">
                      <div className="space-y-2">
                        <p className="text-sm">Link de reset gerado:</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-black/50 px-2 py-1 rounded flex-1 break-all text-orange-300">
                            {resetLink}
                          </code>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={copyResetLink}
                            className="border-orange-500/20 text-orange-500 hover:bg-orange-500/10"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setResetToken(resetLink.split('token=')[1] || null);
                          }}
                          className="w-full border-orange-500/20 text-orange-500 hover:bg-orange-500/10"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Usar este link para resetar senha
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
                  disabled={isLoading}
                >
                  {isLoading ? 'Enviando...' : 'Enviar Link de Reset'}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-gray-400 hover:text-white"
                  onClick={() => navigate('/login')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar para Login
                </Button>
              </form>
            ) : (
              // Formulário para resetar senha
              <form onSubmit={resetPasswordForm.handleSubmit(onResetPasswordSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-white">Nova Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 8 caracteres"
                      className="pl-10 pr-10 bg-black/50 border-gray-700 text-white"
                      autoComplete="new-password"
                      {...resetPasswordForm.register('newPassword')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {resetPasswordForm.formState.errors.newPassword && (
                    <p className="text-sm text-red-500">
                      {resetPasswordForm.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-white">Confirmar Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Digite a senha novamente"
                      className="pl-10 pr-10 bg-black/50 border-gray-700 text-white"
                      autoComplete="new-password"
                      {...resetPasswordForm.register('confirmPassword')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-white"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {resetPasswordForm.formState.errors.confirmPassword && (
                    <p className="text-sm text-red-500">
                      {resetPasswordForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
                  disabled={isLoading}
                >
                  {isLoading ? 'Resetando...' : 'Resetar Senha'}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-gray-400 hover:text-white"
                  onClick={() => {
                    setResetToken(null);
                    setResetLink(null);
                    resetPasswordForm.reset(); // Limpar formulário ao voltar
                    navigate('/reset-password');
                  }}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;

