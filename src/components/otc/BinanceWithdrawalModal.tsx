/**
 * 🪙 Binance Withdrawal Modal
 * Modal para criação de saque na Binance
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Wallet, ArrowDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';

interface BinanceWithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    coin: string;
    amount: string;
    address: string;
    network?: string;
    addressTag?: string;
  }) => void;
  loading?: boolean;
  balances?: Array<{
    coin: string;
    free: string;
    locked: string;
  }>;
}

const NETWORKS = {
  USDT: [
    { value: 'TRX', label: 'TRX (Tron)' },
    { value: 'MATIC', label: 'MATIC (Polygon)' },
    { value: 'ETH', label: 'ETH (Ethereum)' },
  ],
  BTC: [{ value: 'BTC', label: 'BTC' }],
  ETH: [{ value: 'ETH', label: 'ETH' }],
};

export const BinanceWithdrawalModal: React.FC<BinanceWithdrawalModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  balances = [],
}) => {
  const [coin, setCoin] = useState('USDT');
  const [amount, setAmount] = useState('0,00');
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState('TRX');
  const [addressTag, setAddressTag] = useState('');

  const networks = NETWORKS[coin as keyof typeof NETWORKS] || [{ value: 'TRX', label: 'TRX' }];

  /**
   * Converte formato brasileiro para formato americano
   * Ex: "1.000,50" -> "1000.50"
   */
  const convertBrazilianToUS = (value: string): string => {
    // Remove separadores de milhar (pontos)
    // Substitui vírgula por ponto decimal
    return value
      .replace(/\./g, '')      // Remove pontos (separadores de milhar)
      .replace(',', '.');      // Substitui vírgula por ponto
  };

  /**
   * Formata número monetário preenchendo da direita para esquerda
   * Mantém sempre 2 casas decimais
   * Ex: digita "1" → "0,01", digita "1000" → "10,00"
   */
  const formatMonetaryInput = (value: string): string => {
    // Remove tudo que não é número
    const numbersOnly = value.replace(/\D/g, '');
    
    // Se vazio, retorna formato inicial
    if (!numbersOnly) return '0,00';
    
    // Converte para número e divide por 100 para ter decimais
    const numValue = parseInt(numbersOnly, 10) / 100;
    
    // Formata com 2 casas decimais sempre
    const formatted = numValue.toFixed(2);
    
    // Separa parte inteira e decimal
    const [integerPart, decimalPart] = formatted.split('.');
    
    // Adiciona separador de milhar na parte inteira
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    // Retorna no formato brasileiro
    return `${formattedInteger},${decimalPart}`;
  };

  /**
   * Handler para mudança do input de valor
   */
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Formata como input monetário
    const formatted = formatMonetaryInput(inputValue);
    setAmount(formatted);
  };

  // Atualizar rede quando moeda mudar
  useEffect(() => {
    const defaultNetwork = networks[0]?.value || 'TRX';
    setNetwork(defaultNetwork);
  }, [coin]);

  // Resetar campos quando o modal fechar
  useEffect(() => {
    if (!isOpen) {
      setCoin('USDT');
      setAmount('0,00');
      setAddress('');
      setNetwork('TRX');
      setAddressTag('');
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (!amount || !address) {
      return;
    }

    // Converte valor brasileiro para formato americano antes de enviar
    const convertedAmount = convertBrazilianToUS(amount);

    onConfirm({
      coin,
      amount: convertedAmount,
      address,
      network,
      addressTag: addressTag || undefined,
    });
  };

  const handleMaxAmount = () => {
    // Buscar saldo disponível para a moeda selecionada
    const coinBalance = balances.find((b) => b.coin === coin);
    
    if (coinBalance && parseFloat(coinBalance.free) > 0) {
      // Definir valor máximo descontando a taxa de rede (0.0001)
      const maxAmount = parseFloat(coinBalance.free) - 0.0001;
      if (maxAmount > 0) {
        // Converte para string e formata como monetário
        const brazilianFormat = formatMonetaryInput(maxAmount.toFixed(2).replace('.', ''));
        setAmount(brazilianFormat);
      } else {
        setAmount('0,00');
      }
    } else {
      setAmount('0,00');
    }
  };

  // Valida se o valor é válido (converte brasileiro para número)
  const getNumericValue = (value: string): number => {
    if (!value) return 0;
    const converted = convertBrazilianToUS(value);
    return parseFloat(converted) || 0;
  };

  const isValid = amount && address && getNumericValue(amount) > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Wallet className="w-4 h-4 text-orange-500" />
            Solicitar Saque
          </DialogTitle>
          <DialogDescription className="text-sm">
            Preencha os dados para solicitar um saque
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Coin Selection */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Moeda
            </label>
            <Select value={coin} onValueChange={setCoin}>
              <SelectTrigger className="w-full bg-muted/50 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USDT">
                  <div className="flex items-center gap-2">
                    <img src="/usdt_logo.png" alt="USDT" className="w-6 h-6" />
                    USDT
                  </div>
                </SelectItem>
                <SelectItem value="BTC">
                  <div className="flex items-center gap-2">
                    <img src="/btc_logo.png" alt="BTC" className="w-6 h-6" />
                    BTC
                  </div>
                </SelectItem>
                <SelectItem value="ETH">
                  <div className="flex items-center gap-2">
                    <img src="/eth_logo.png" alt="ETH" className="w-6 h-6" />
                    ETH
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Network Selection */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Rede
            </label>
            <Select value={network} onValueChange={setNetwork}>
              <SelectTrigger className="w-full bg-muted/50 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {networks.map((net) => (
                  <SelectItem key={net.value} value={net.value}>
                    {net.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Address */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Endereço da Wallet
            </label>
            <Input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x..."
              className="bg-muted/50 font-mono text-sm h-10"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Valor
            </label>
            <div className="relative">
              <Input
                type="text"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0,00"
                className="bg-muted/50 text-sm pr-16 h-10"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={handleMaxAmount}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-600"
              >
                MAX
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Digite o valor normalmente: digite 100 para R$ 1,00
            </p>
          </div>

          {/* Fee Info */}
          <Card className="bg-muted/30 border-border/50">
            <CardContent className="pt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Taxa de rede</span>
                <span className="font-medium">0,0001 {coin}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Você receberá</span>
                <span className="font-semibold text-foreground">
                  {amount && getNumericValue(amount) > 0
                    ? (getNumericValue(amount) - 0.0001).toFixed(8).replace('.', ',')
                    : '0,0000'}{' '}
                  {coin}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Warning */}
          <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-red-700 dark:text-red-400">
              <p className="font-medium mb-0.5">Atenção</p>
              <p>
                Saques são operações irreversíveis. Verifique cuidadosamente o endereço de destino antes de confirmar.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !isValid}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Processando...
              </>
            ) : (
              <>
                <ArrowDown className="w-4 h-4 mr-2" />
                Solicitar Saque
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

