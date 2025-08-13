// src/components/PixTransferSecure.tsx
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CheckCircle, AlertCircle, CreditCard, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { pixSecureService, PixTransferData } from '@/services/pix.secure';
import { handleApiError, showErrorToast } from '@/utils/error.handler';
import { logger } from '@/utils/logger';

// Schema de validação com as mesmas regras do PixService
const pixTransferSchema = z.object({
  chave: z.string()
    .min(1, 'Chave PIX é obrigatória')
    .refine((val) => {
      // Validações de formato
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^\+55\d{10,11}$/;
      const cpfRegex = /^\d{11}$/;
      const cnpjRegex = /^\d{14}$/;
      const randomKeyRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
      
      return emailRegex.test(val) || phoneRegex.test(val) || cpfRegex.test(val) || cnpjRegex.test(val) || randomKeyRegex.test(val);
    }, 'Formato de chave PIX inválido'),
  
  valor: z.string()
    .min(1, 'Valor é obrigatório')
    .refine((val) => {
      const num = parseFloat(val.replace(',', '.'));
      return !isNaN(num) && num > 0;
    }, 'Valor deve ser maior que zero')
    .refine((val) => {
      const num = parseFloat(val.replace(',', '.'));
      return num <= 100000;
    }, 'Valor não pode exceder R$ 100.000'),
    
  descricao: z.string().optional()
});

type PixTransferFormData = z.infer<typeof pixTransferSchema>;

/**
 * Componente de transferência PIX segura demonstrando as implementações da documentação JWT
 */
const PixTransferSecure: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [transactionResult, setTransactionResult] = useState<any>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch
  } = useForm<PixTransferFormData>({
    resolver: zodResolver(pixTransferSchema)
  });

  // Monitorar valor para formatação
  const valorValue = watch('valor');

  const onSubmit = async (data: PixTransferFormData) => {
    try {
      setIsLoading(true);
      setTransactionResult(null);

      // Converter valor para número
      const valor = parseFloat(data.valor.replace(',', '.'));
      
      const pixData: PixTransferData = {
        chave: data.chave,
        valor,
        descricao: data.descricao
      };

      logger.info('[COMPONENT] Iniciando transferência PIX segura', {
        chaveDestino: data.chave.includes('@') ? 
          `${data.chave.charAt(0)}***@${data.chave.split('@')[1]}` : 
          `${data.chave.substring(0, 3)}***${data.chave.substring(data.chave.length - 3)}`
      });

      const result = await pixSecureService.enviarPix(pixData);
      
      setTransactionResult(result);

      if (result.sucesso) {
        toast.success("PIX enviado com sucesso!", {
          description: `Código: ${result.codigoTransacao}`,
          duration: 4000,
          icon: <CheckCircle className="h-4 w-4" />
        });

        // Limpar formulário após sucesso
        reset();
      } else {
        toast.error("Falha ao enviar PIX", {
          description: result.mensagem || "Erro desconhecido",
          duration: 6000,
          icon: <AlertCircle className="h-4 w-4" />
        });
      }
    } catch (error) {
      logger.error('[COMPONENT] Erro na transferência PIX:', error);
      
      // Usar o sistema de tratamento de erros implementado
      const errorMessage = handleApiError(error as any, 'Transferência PIX');
      
      setTransactionResult({
        sucesso: false,
        mensagem: errorMessage
      });

      // Mostrar toast de erro usando o sistema implementado
      showErrorToast(error as any, 'Transferência PIX');
    } finally {
      setIsLoading(false);
    }
  };

  const formatarValor = (valor: string): string => {
    if (!valor) return '';
    
    // Remove caracteres não numéricos exceto vírgula e ponto
    const cleaned = valor.replace(/[^\d,.-]/g, '');
    
    // Converte para formato numérico brasileiro
    return cleaned.replace('.', ',');
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Transferência PIX Segura
        </CardTitle>
        <CardDescription>
          Sistema implementado conforme documentação JWT
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="chave">Chave PIX de Destino</Label>
            <Input
              id="chave"
              type="text"
              placeholder="Email, telefone, CPF ou chave aleatória"
              {...register('chave')}
              className={errors.chave ? 'border-red-500' : ''}
            />
            {errors.chave && (
              <p className="text-sm text-red-500 mt-1">{errors.chave.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="valor">Valor (R$)</Label>
            <Input
              id="valor"
              type="text"
              placeholder="0,00"
              {...register('valor')}
              className={errors.valor ? 'border-red-500' : ''}
              onChange={(e) => {
                const formatted = formatarValor(e.target.value);
                e.target.value = formatted;
              }}
            />
            {errors.valor && (
              <p className="text-sm text-red-500 mt-1">{errors.valor.message}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Limite máximo: R$ 100.000,00
            </p>
          </div>

          <div>
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Input
              id="descricao"
              type="text"
              placeholder="Descrição da transferência"
              {...register('descricao')}
              maxLength={140}
            />
          </div>

          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar PIX
              </>
            )}
          </Button>
        </form>

        {/* Resultado da transação */}
        {transactionResult && (
          <Alert className={`mt-4 ${transactionResult.sucesso ? 'border-green-500' : 'border-red-500'}`}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">
                  {transactionResult.sucesso ? 'Sucesso!' : 'Erro na transação'}
                </p>
                <p className="text-sm">{transactionResult.mensagem}</p>
                {transactionResult.codigoTransacao && (
                  <p className="text-xs font-mono bg-gray-100 p-2 rounded">
                    Código: {transactionResult.codigoTransacao}
                  </p>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Informações de segurança */}
        <div className="mt-6 p-3 bg-blue-50 rounded-lg">
          <h4 className="text-sm font-medium text-blue-800 mb-2">
            🔒 Recursos de Segurança Implementados
          </h4>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>✅ Validação JWT automática</li>
            <li>✅ Tratamento de códigos de erro padronizados</li>
            <li>✅ Rate limiting com headers X-RateLimit-*</li>
            <li>✅ Logs estruturados para auditoria</li>
            <li>✅ Retry automático com backoff exponencial</li>
            <li>✅ Mascaramento de dados sensíveis</li>
            <li>✅ Validação dupla (frontend + backend)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default PixTransferSecure;
