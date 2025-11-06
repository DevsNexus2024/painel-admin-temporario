/**
 * 🔐 Modal de PIN de Saque
 * Modal para cadastrar ou alterar PIN de saque (6 dígitos)
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, Lock, Eye, EyeOff, Check, XCircle } from 'lucide-react';
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

interface WithdrawalPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasExistingPin?: boolean; // Se o PIN já está configurado
}

export const WithdrawalPinModal: React.FC<WithdrawalPinModalProps> = ({
  isOpen,
  onClose,
  hasExistingPin = false,
}) => {
  // Importar hook de PIN (PIN está vinculado ao usuário, não ao cliente)
  const { status, createPin, verifyPin, updatePin, isCreatingPin, isVerifyingPin, isUpdatingPin } = useOTCPin();
  
  // Usar hasExistingPin do prop ou do status
  const pinConfigured = hasExistingPin || status.pinConfigured;
  
  // Estado para validação do PIN antigo
  const [oldPinVerified, setOldPinVerified] = useState<boolean | null>(null);
  const [isVerifyingOldPin, setIsVerifyingOldPin] = useState(false);
  // Estado para primeira vez
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Estado para alteração - usando arrays de dígitos separados
  const [oldPinDigits, setOldPinDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [newPinDigits, setNewPinDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [confirmPinDigits, setConfirmPinDigits] = useState<string[]>(['', '', '', '', '', '']);
  
  // Refs para cada campo de PIN
  const oldPinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const newPinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmPinRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resetar ao abrir/fechar
  useEffect(() => {
    if (isOpen) {
      setPinDigits(['', '', '', '', '', '']);
      setOldPinDigits(['', '', '', '', '', '']);
      setNewPinDigits(['', '', '', '', '', '']);
      setConfirmPinDigits(['', '', '', '', '', '']);
      setOldPinVerified(null);
      setIsVerifyingOldPin(false);
      
      // Focar no primeiro campo apropriado após um pequeno delay
      setTimeout(() => {
        if (pinConfigured) {
          oldPinRefs.current[0]?.focus();
        } else {
          inputRefs.current[0]?.focus();
        }
      }, 100);
    }
  }, [isOpen, pinConfigured]);

  // Função para primeira vez - gerenciar dígitos individuais
  const handleDigitChange = (index: number, value: string) => {
    if (value.length > 1) return; // Aceitar apenas 1 dígito
    if (!/^\d*$/.test(value)) return; // Apenas números

    const newDigits = [...pinDigits];
    newDigits[index] = value;
    setPinDigits(newDigits);

    // Avançar para próximo campo
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Voltar se apagar
    if (!value && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newDigits = pasted.split('').concat(Array(6 - pasted.length).fill(''));
    
    // Determinar qual campo está recebendo o paste
    const target = e.currentTarget;
    if (target === oldPinRefs.current[0]) {
      setOldPinDigits(newDigits);
      const nextIndex = Math.min(pasted.length, 5);
      oldPinRefs.current[nextIndex]?.focus();
    } else if (target === newPinRefs.current[0]) {
      setNewPinDigits(newDigits);
      const nextIndex = Math.min(pasted.length, 5);
      newPinRefs.current[nextIndex]?.focus();
    } else if (target === confirmPinRefs.current[0]) {
      setConfirmPinDigits(newDigits);
      const nextIndex = Math.min(pasted.length, 5);
      confirmPinRefs.current[nextIndex]?.focus();
    } else {
      // Primeira vez (cadastro)
      setPinDigits(newDigits);
      const nextIndex = Math.min(pasted.length, 5);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  // Função genérica para gerenciar dígitos (reutilizável)
  const handleGenericDigitChange = (
    index: number,
    value: string,
    digits: string[],
    setDigits: React.Dispatch<React.SetStateAction<string[]>>,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    if (value.length > 1) return;
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);

    // Avançar para próximo campo
    if (value && index < 5) {
      refs.current[index + 1]?.focus();
    }

    // Voltar se apagar
    if (!value && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handleGenericKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
    digits: string[],
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  // Verificar se PIN está completo (primeira vez)
  const isPinComplete = pinDigits.every(d => d !== '');

  // Verificar validação (alteração)
  const oldPin = oldPinDigits.join('');
  const newPin = newPinDigits.join('');
  const confirmPin = confirmPinDigits.join('');
  
  const isOldPinComplete = oldPinDigits.every(d => d !== '');
  const isNewPinComplete = newPinDigits.every(d => d !== '');
  const isConfirmPinComplete = confirmPinDigits.every(d => d !== '');
  
  const doPinsMatch = newPin === confirmPin && newPin.length === 6;

  const canSubmitCreate = isPinComplete;
  const canSubmitChange = isOldPinComplete && isNewPinComplete && isConfirmPinComplete && doPinsMatch;

  // Verificar PIN antigo quando completar
  useEffect(() => {
    const verifyOldPinWhenComplete = async () => {
      if (!pinConfigured) return;
      
      const oldPinValue = oldPinDigits.join('');
      if (oldPinValue.length === 6 && oldPinVerified === null && !isVerifyingOldPin) {
        setIsVerifyingOldPin(true);
        try {
          const result = await verifyPin({ pin: oldPinValue });
          setOldPinVerified(result.data.verified);
          
          if (!result.data.verified) {
            // Limpar PIN antigo se estiver incorreto
            setTimeout(() => {
              setOldPinDigits(['', '', '', '', '', '']);
              setOldPinVerified(null);
              oldPinRefs.current[0]?.focus();
            }, 1500);
          }
        } catch (error) {
          setOldPinVerified(false);
          setTimeout(() => {
            setOldPinDigits(['', '', '', '', '', '']);
            setOldPinVerified(null);
            oldPinRefs.current[0]?.focus();
          }, 1500);
        } finally {
          setIsVerifyingOldPin(false);
        }
      }
    };

    verifyOldPinWhenComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oldPinDigits, pinConfigured, oldPinVerified, isVerifyingOldPin]);

  const handleSubmit = async () => {
    if (!pinConfigured) {
      // Primeira vez - cadastrar
      const pin = pinDigits.join('');
      
      if (!/^\d{6}$/.test(pin)) {
        toast.error('PIN inválido');
        return;
      }

      try {
        await createPin({ pin });
        onClose();
      } catch (error) {
        // Erro já é tratado no hook
        console.error('Erro ao criar PIN:', error);
      }
    } else {
      // Alteração - verificar PIN antigo primeiro
      const currentPin = oldPinDigits.join('');
      const newPinValue = newPinDigits.join('');
      
      if (!oldPinVerified) {
        toast.error('Por favor, verifique o PIN atual antes de continuar');
        return;
      }

      if (currentPin === newPinValue) {
        toast.error('O novo PIN deve ser diferente do PIN atual');
        return;
      }

      if (!/^\d{6}$/.test(newPinValue)) {
        toast.error('Novo PIN inválido');
        return;
      }

      try {
        await updatePin({ currentPin, newPin: newPinValue });
        onClose();
      } catch (error) {
        // Erro já é tratado no hook
        console.error('Erro ao atualizar PIN:', error);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            {pinConfigured ? 'Alterar PIN de Saque' : 'Cadastrar PIN de Saque'}
          </DialogTitle>
          <DialogDescription>
            {pinConfigured 
              ? 'Digite seu PIN atual e defina um novo PIN de 6 dígitos'
              : 'Crie um PIN de 6 dígitos para autorizar saques'}
          </DialogDescription>
        </DialogHeader>

        {!pinConfigured ? (
          // ========== TELA 1: PRIMEIRA VEZ ==========
          <div className="space-y-6 py-4">
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
                    className="w-14 h-14 text-center text-2xl font-bold border-2 focus:border-primary"
                    autoFocus={index === 0}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Use apenas números de 0 a 9
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmitCreate || isCreatingPin}
                className="flex-1 bg-primary"
              >
                {isCreatingPin ? 'Cadastrando...' : 'Cadastrar PIN'}
              </Button>
            </div>
          </div>
        ) : (
          // ========== TELA 2: ALTERAÇÃO ==========
          <div className="space-y-6 py-4">
            {/* PIN Antigo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">PIN Atual</Label>
                {isOldPinComplete && (
                  <div className="flex items-center gap-1 text-green-600">
                    <Check className="h-4 w-4" />
                    <span className="text-xs font-medium">PIN válido</span>
                  </div>
                )}
                {oldPinDigits.some(d => d !== '') && !isOldPinComplete && (
                  <div className="flex items-center gap-1 text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span className="text-xs font-medium">Incompleto</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 justify-center">
                {oldPinDigits.map((digit, index) => (
                  <div key={index} className="relative">
                    <Input
                      ref={(el) => (oldPinRefs.current[index] = el)}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => {
                        handleGenericDigitChange(index, e.target.value, oldPinDigits, setOldPinDigits, oldPinRefs);
                        // Resetar verificação quando mudar
                        if (oldPinVerified !== null) {
                          setOldPinVerified(null);
                        }
                      }}
                      onKeyDown={(e) => handleGenericKeyDown(index, e, oldPinDigits, oldPinRefs)}
                      onPaste={index === 0 ? handlePaste : undefined}
                      disabled={isVerifyingOldPin}
                      className={`w-14 h-14 text-center text-2xl font-bold border-2 transition-colors ${
                        oldPinVerified === true
                          ? 'border-green-500 focus:border-green-600 bg-green-50'
                          : oldPinVerified === false
                          ? 'border-red-500 focus:border-red-600 bg-red-50 animate-shake'
                          : isOldPinComplete 
                          ? 'border-yellow-500 focus:border-yellow-600' 
                          : digit !== ''
                          ? 'border-yellow-500 focus:border-yellow-600'
                          : 'focus:border-primary'
                      }`}
                      autoFocus={false}
                    />
                    {index === 5 && isOldPinComplete && (
                      <>
                        {isVerifyingOldPin ? (
                          <div className="absolute -right-6 top-1/2 -translate-y-1/2 h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        ) : oldPinVerified === true ? (
                          <Check className="absolute -right-6 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                        ) : oldPinVerified === false ? (
                          <XCircle className="absolute -right-6 top-1/2 -translate-y-1/2 h-5 w-5 text-red-500" />
                        ) : null}
                      </>
                    )}
                  </div>
                ))}
              </div>
              {oldPinVerified === false && (
                <p className="text-xs text-red-600 text-center animate-pulse">
                  PIN incorreto. Digite novamente.
                </p>
              )}
              {oldPinVerified === true && (
                <p className="text-xs text-green-600 text-center">
                  ✓ PIN verificado com sucesso
                </p>
              )}
            </div>

            {/* PIN Novo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Novo PIN</Label>
                {isNewPinComplete && (
                  <div className="flex items-center gap-1 text-green-600">
                    <Check className="h-4 w-4" />
                    <span className="text-xs font-medium">PIN válido</span>
                  </div>
                )}
                {newPinDigits.some(d => d !== '') && !isNewPinComplete && (
                  <div className="flex items-center gap-1 text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span className="text-xs font-medium">Incompleto</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 justify-center">
                {newPinDigits.map((digit, index) => (
                  <div key={index} className="relative">
                    <Input
                      ref={(el) => (newPinRefs.current[index] = el)}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => {
                        handleGenericDigitChange(index, e.target.value, newPinDigits, setNewPinDigits, newPinRefs);
                        // Limpar confirmação quando novo PIN muda
                        if (confirmPinDigits.some(d => d !== '')) {
                          setConfirmPinDigits(['', '', '', '', '', '']);
                          confirmPinRefs.current[0]?.focus();
                        }
                      }}
                      onKeyDown={(e) => handleGenericKeyDown(index, e, newPinDigits, newPinRefs)}
                      onPaste={index === 0 ? handlePaste : undefined}
                      className={`w-14 h-14 text-center text-2xl font-bold border-2 transition-colors ${
                        isNewPinComplete 
                          ? 'border-green-500 focus:border-green-600' 
                          : digit !== ''
                          ? 'border-yellow-500 focus:border-yellow-600'
                          : 'focus:border-primary'
                      }`}
                    />
                    {index === 5 && isNewPinComplete && (
                      <Check className="absolute -right-6 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Confirmar PIN Novo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Confirmar Novo PIN</Label>
                {isConfirmPinComplete && (
                  <div className="flex items-center gap-1">
                    {doPinsMatch ? (
                      <>
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-xs font-medium text-green-600">PINs coincidem</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="text-xs font-medium text-red-600">PINs não coincidem</span>
                      </>
                    )}
                  </div>
                )}
                {confirmPinDigits.some(d => d !== '') && !isConfirmPinComplete && (
                  <div className="flex items-center gap-1 text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span className="text-xs font-medium">Incompleto</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 justify-center">
                {confirmPinDigits.map((digit, index) => (
                  <div key={index} className="relative">
                    <Input
                      ref={(el) => (confirmPinRefs.current[index] = el)}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleGenericDigitChange(index, e.target.value, confirmPinDigits, setConfirmPinDigits, confirmPinRefs)}
                      onKeyDown={(e) => handleGenericKeyDown(index, e, confirmPinDigits, confirmPinRefs)}
                      onPaste={index === 0 ? handlePaste : undefined}
                      className={`w-14 h-14 text-center text-2xl font-bold border-2 transition-colors ${
                        isConfirmPinComplete
                          ? doPinsMatch
                            ? 'border-green-500 focus:border-green-600'
                            : 'border-red-500 focus:border-red-600'
                          : digit !== ''
                          ? 'border-yellow-500 focus:border-yellow-600'
                          : 'focus:border-primary'
                      }`}
                    />
                    {index === 5 && isConfirmPinComplete && (
                      doPinsMatch ? (
                        <Check className="absolute -right-6 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="absolute -right-6 top-1/2 -translate-y-1/2 h-5 w-5 text-red-500" />
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmitChange || oldPinVerified !== true || isUpdatingPin || isVerifyingOldPin}
                className="flex-1 bg-primary"
              >
                {isUpdatingPin ? 'Alterando...' : 'Alterar PIN'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

