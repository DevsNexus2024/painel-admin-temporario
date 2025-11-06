/**
 * 🪙 Binance Withdrawal Modal
 * Modal para criação de saque na Binance
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Wallet, ArrowDown, Check } from 'lucide-react';
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
import { formatMonetaryInput, convertBrazilianToUS, getNumericValue } from '@/utils/monetaryInput';
import { consultarTaxaRedeBinance } from '@/services/binance';
import type { OTCClient } from '@/types/otc';
import type { BinanceQuoteData, BinanceNetworkFeeData } from '@/types/binance';

interface BinanceWithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    coin: string;
    amount: string; // Valor total (valor informado + taxa)
    originalAmount: string; // Valor que o cliente deve receber (sem taxa)
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
  client?: OTCClient | null;
  quote?: BinanceQuoteData | null;
  onRequestQuote?: () => Promise<void>;
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
  client = null,
  quote = null,
  onRequestQuote,
}) => {
  const [coin, setCoin] = useState('USDT');
  const [amount, setAmount] = useState('0,00');
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState('TRX');
  const [addressTag, setAddressTag] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [networkFee, setNetworkFee] = useState<BinanceNetworkFeeData | null>(null);
  const [networkFeeLoading, setNetworkFeeLoading] = useState(false);

  const networks = NETWORKS[coin as keyof typeof NETWORKS] || [{ value: 'TRX', label: 'TRX' }];

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
      setShowConfirmation(false);
    }
  }, [isOpen]);

  // Solicitar cotação automaticamente quando o modal abrir
  useEffect(() => {
    if (isOpen && !quote && onRequestQuote) {
      onRequestQuote();
    }
  }, [isOpen, quote, onRequestQuote]);

  // Buscar taxa de rede quando coin ou network mudarem
  useEffect(() => {
    const buscarTaxaRede = async () => {
      if (!isOpen || !coin || !network) return;
      
      setNetworkFeeLoading(true);
      try {
        const response = await consultarTaxaRedeBinance(coin, network);
        if (response && response.success && response.data) {
          setNetworkFee(response.data);
        } else {
          setNetworkFee(null);
        }
      } catch (error) {
        console.error('Erro ao buscar taxa de rede:', error);
        setNetworkFee(null);
      } finally {
        setNetworkFeeLoading(false);
      }
    };

    buscarTaxaRede();
  }, [isOpen, coin, network]);

  // Calcular valores
  const valorInformado = getNumericValue(amount);
  const taxaRede = networkFee ? parseFloat(networkFee.withdrawFee) : 0;
  const valorTotal = valorInformado + taxaRede; // Valor a solicitar na Binance
  const clienteReceberá = valorInformado; // Valor que o cliente deve receber (sem taxa)

  // Calcular BRL aproximado baseado na cotação
  const calculateBrlApproximate = () => {
    if (!quote || valorInformado <= 0) return 0;
    
    const brlPrice = quote.averagePrice; // Cotação USDT/BRL
    
    return clienteReceberá * brlPrice;
  };

  const handleContinue = () => {
    if (!amount || !address) {
      return;
    }
    setShowConfirmation(true);
  };

  const handleConfirm = () => {
    if (!amount || !address) {
      return;
    }

    // Converte valores para formato americano antes de enviar
    const convertedOriginalAmount = convertBrazilianToUS(amount); // Valor que o cliente deve receber
    const convertedTotalAmount = (valorTotal).toFixed(8); // Valor total (valor + taxa)

    onConfirm({
      coin,
      amount: convertedTotalAmount, // Valor total a solicitar na Binance
      originalAmount: convertedOriginalAmount, // Valor original (sem taxa) para registrar no débito
      address,
      network,
      addressTag: addressTag || undefined,
    });
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
  };

  const handleMaxAmount = () => {
    // Buscar saldo disponível para a moeda selecionada
    const coinBalance = balances.find((b) => b.coin === coin);
    
    if (coinBalance && parseFloat(coinBalance.free) > 0) {
      // Definir valor máximo descontando a taxa de rede
      const taxa = networkFee ? parseFloat(networkFee.withdrawFee) : 1.0; // Fallback para 1.0 se não houver taxa
      const maxAmount = parseFloat(coinBalance.free) - taxa;
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

  const isValid = amount && address && getNumericValue(amount) > 0;
  const brlApproximate = calculateBrlApproximate();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Wallet className="w-4 h-4 text-orange-500" />
            {!showConfirmation ? 'Solicitar Saque' : 'Confirmar Saque'}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {!showConfirmation 
              ? 'Preencha os dados para solicitar um saque'
              : 'Revise os dados antes de confirmar'}
          </DialogDescription>
        </DialogHeader>

        {!showConfirmation ? (
          // Formulário principal
          <>
          {/* Informações do Cliente */}
          {client && (
            <Card className="bg-muted/30 border-border/50">
              <CardContent className="py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-semibold">{client.name}</span>
                </div>
              </CardContent>
            </Card>
          )}

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
                <span className="text-muted-foreground">Valor informado</span>
                <span className="font-semibold text-foreground">
                  {valorInformado > 0 ? valorInformado.toFixed(2).replace('.', ',') : '0,00'} {coin}
                </span>
              </div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">
                  Taxa de rede
                  {networkFeeLoading && <span className="ml-1 text-xs">(carregando...)</span>}
                </span>
                <span className="font-medium">
                  {networkFee ? `${taxaRede.toFixed(4).replace('.', ',')} ${coin}` : '-'}
                </span>
              </div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Total a sacar</span>
                <span className="font-semibold text-orange-600">
                  {valorTotal > 0 ? valorTotal.toFixed(4).replace('.', ',') : '0,0000'} {coin}
                </span>
              </div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Cliente receberá</span>
                <span className="font-semibold text-green-600">
                  {clienteReceberá > 0 ? clienteReceberá.toFixed(2).replace('.', ',') : '0,00'} {coin}
                </span>
              </div>
              <div className="flex justify-between text-xs pt-1 border-t border-border/50">
                <span className="text-muted-foreground">BRL Aproximado</span>
                <span className="font-semibold text-green-600">
                  {brlApproximate > 0 
                    ? `R$ ${brlApproximate.toFixed(2).replace('.', ',')}`
                    : 'R$ 0,00'}
                </span>
              </div>
            </CardContent>
          </Card>

        </div>
        </>
        ) : (
          // Tela de Confirmação
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-yellow-700 dark:text-yellow-400">
                <p className="font-medium mb-0.5">Confirmação</p>
                <p>Revise os dados antes de confirmar o saque</p>
              </div>
            </div>

            {/* Resumo */}
            <Card className="bg-muted/30 border-border/50">
              <CardContent className="pt-3">
                <div className="space-y-2 text-sm">
                  {client && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cliente:</span>
                      <span className="font-semibold">{client.name}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Moeda:</span>
                    <span className="font-semibold">{coin}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor informado:</span>
                    <span className="font-semibold">{valorInformado > 0 ? valorInformado.toFixed(2).replace('.', ',') : '0,00'} {coin}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Taxa de rede:</span>
                    <span className="font-semibold">
                      {networkFee ? `${taxaRede.toFixed(4).replace('.', ',')} ${coin}` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total a sacar:</span>
                    <span className="font-semibold text-orange-600">
                      {valorTotal > 0 ? valorTotal.toFixed(4).replace('.', ',') : '0,0000'} {coin}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cliente receberá:</span>
                    <span className="font-semibold text-green-600">
                      {clienteReceberá > 0 ? clienteReceberá.toFixed(2).replace('.', ',') : '0,00'} {coin}
                    </span>
                  </div>
                  {brlApproximate > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">BRL Aproximado:</span>
                      <span className="font-semibold text-green-600">
                        R$ {brlApproximate.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rede:</span>
                    <span className="font-semibold">{network}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Endereço:</span>
                    <span className="font-mono text-xs break-all">{address}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter className="gap-2">
          {!showConfirmation ? (
            <>
              <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleContinue}
                disabled={loading || !isValid}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <ArrowDown className="w-4 h-4 mr-2" />
                Continuar
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleCancelConfirmation}
                disabled={loading}
              >
                Voltar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Confirmar Saque
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

