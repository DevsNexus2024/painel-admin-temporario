/**
 * 🔐 Modal de Verificação de PIN
 * Modal para verificar PIN antes de operações sensíveis (ex: saque)
 */

import React, { useState, useRef, useEffect } from 'react';
import { Lock, X } from 'lucide-react';
import { useOTCPin } from '@/hooks/useOTCPin';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PinVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void; // Callback quando PIN for verificado corretamente
  title?: string;
  description?: string;
}

export const PinVerificationModal: React.FC<PinVerificationModalProps> = ({
  isOpen,
  onClose,
  onVerified,
  title = 'Verificação de PIN',
  description = 'Digite seu PIN de 6 dígitos para autorizar esta operação',
}) => {
  const { verifyPin, isVerifyingPin, status } = useOTCPin();
  
  // Estado para PIN (6 dígitos separados)
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resetar ao abrir/fechar
  useEffect(() => {
    if (isOpen) {
      setPinDigits(['', '', '', '', '', '']);
      // Focar no primeiro input após um pequeno delay
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Verificar se PIN está completo
  const isPinComplete = pinDigits.every(d => d !== '') && pinDigits.join('').length === 6;

  // Função para gerenciar dígitos individuais
  const handleDigitChange = (index: number, value: string) => {
    if (value.length > 1) return; // Aceitar apenas 1 dígito
    if (!/^\d*$/.test(value)) return; // Apenas números

    const newDigits = [...pinDigits];
    newDigits[index] = value;
    setPinDigits(newDigits);

    // Mover para o próximo campo automaticamente
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Função para lidar com teclas especiais
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      // Se o campo atual está vazio e pressionou backspace, voltar para o anterior
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Função para colar PIN completo
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text').trim();
    
    // Verificar se é um PIN válido (6 dígitos)
    if (/^\d{6}$/.test(pastedText)) {
      const digits = pastedText.split('');
      setPinDigits(digits);
      
      // Focar no último campo
      inputRefs.current[5]?.focus();
    }
  };

  // Verificar PIN quando estiver completo
  const handleVerify = async () => {
    if (!isPinComplete) {
      toast.error('Por favor, digite o PIN completo');
      return;
    }

    const pin = pinDigits.join('');
    
    if (!/^\d{6}$/.test(pin)) {
      toast.error('PIN inválido');
      return;
    }

    try {
      const result = await verifyPin({ pin });
      
      if (result.data.verified) {
        toast.success('PIN verificado com sucesso');
        onVerified(); // Chama o callback de sucesso
        onClose(); // Fecha o modal
      } else {
        toast.error('PIN incorreto. Tente novamente.');
        // Limpar PIN para nova tentativa
        setPinDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Erro ao verificar PIN';
      toast.error(message);
      // Limpar PIN para nova tentativa
      setPinDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  // Verificar se usuário não tem PIN configurado
  if (!status.pinConfigured && !status.loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              PIN não configurado
            </DialogTitle>
            <DialogDescription>
              Você precisa configurar um PIN de saque antes de realizar operações.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground text-center">
              Configure seu PIN através do menu do usuário.
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose} variant="outline">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Digite seu PIN (6 dígitos)</Label>
            <div className="flex gap-2 justify-center">
              {pinDigits.map((digit, index) => (
                <Input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  className="w-12 h-12 text-center text-xl font-bold border-2 focus:border-primary"
                  autoFocus={index === 0 && isOpen}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Use apenas números de 0 a 9
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isVerifyingPin}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleVerify}
            disabled={!isPinComplete || isVerifyingPin}
            className="flex-1 bg-primary"
          >
            {isVerifyingPin ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Verificando...
              </>
            ) : (
              'Verificar PIN'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

