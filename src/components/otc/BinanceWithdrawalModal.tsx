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
}

const NETWORKS = {
  USDT: [
    { value: 'TRX', label: 'TRX (Tron)' },
    { value: 'ETH', label: 'ETH (Ethereum)' },
    { value: 'BSC', label: 'BSC (Binance Smart Chain)' },
    { value: 'MATIC', label: 'MATIC (Polygon)' },
    { value: 'ARBITRUM', label: 'ARBITRUM' },
    { value: 'OPTIMISM', label: 'OPTIMISM' },
  ],
  BTC: [{ value: 'BTC', label: 'BTC' }],
  ETH: [{ value: 'ETH', label: 'ETH' }],
};

export const BinanceWithdrawalModal: React.FC<BinanceWithdrawalModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}) => {
  const [coin, setCoin] = useState('USDT');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState('TRX');
  const [addressTag, setAddressTag] = useState('');

  const networks = NETWORKS[coin as keyof typeof NETWORKS] || [{ value: 'TRX', label: 'TRX' }];

  // Atualizar rede quando moeda mudar
  useEffect(() => {
    const defaultNetwork = networks[0]?.value || 'TRX';
    setNetwork(defaultNetwork);
  }, [coin]);

  const handleConfirm = () => {
    if (!amount || !address) {
      return;
    }

    onConfirm({
      coin,
      amount,
      address,
      network,
      addressTag: addressTag || undefined,
    });
  };

  const handleMaxAmount = () => {
    // TODO: Implementar lógica de MAX baseado no saldo disponível
    setAmount('');
  };

  const isValid = amount && address && parseFloat(amount) > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-orange-500" />
            Solicitar Saque
          </DialogTitle>
          <DialogDescription>
            Preencha os dados para solicitar um saque
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Coin Selection */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Moeda
            </label>
            <Select value={coin} onValueChange={setCoin}>
              <SelectTrigger className="w-full bg-muted/50 h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USDT">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-green-500">₮</span>
                    </div>
                    USDT
                  </div>
                </SelectItem>
                <SelectItem value="BTC">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-orange-500">₿</span>
                    </div>
                    BTC
                  </div>
                </SelectItem>
                <SelectItem value="ETH">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-500">Ξ</span>
                    </div>
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
              <SelectTrigger className="w-full bg-muted/50 h-12">
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
              className="bg-muted/50 font-mono text-sm"
            />
          </div>

          {/* Address Tag (optional) */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Tag/Memo (opcional)
            </label>
            <Input
              type="text"
              value={addressTag}
              onChange={(e) => setAddressTag(e.target.value)}
              placeholder="Apenas para moedas que requerem"
              className="bg-muted/50 text-sm"
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
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="bg-muted/50 text-base pr-16"
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
          </div>

          {/* Fee Info */}
          <Card className="bg-muted/30 border-border/50">
            <CardContent className="pt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Taxa de rede</span>
                <span className="font-medium">0.0001 {coin}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Você receberá</span>
                <span className="font-semibold text-foreground">
                  {amount && parseFloat(amount) > 0
                    ? (parseFloat(amount) - 0.0001).toFixed(8)
                    : '0.0000'}{' '}
                  {coin}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Warning */}
          <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-700 dark:text-red-400">
              <p className="font-medium mb-1">Atenção</p>
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

