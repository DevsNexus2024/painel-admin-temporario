/**
 * 🪙 Binance Withdrawal Modal
 * Saque seguro em 2 etapas (Binance → escrow TCR → cliente)
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
import { Label } from '@/components/ui/label';
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
import { TotpField } from '@/components/totp/TotpField';
import { setManualTotpCode } from '@/services/totpBridge';
import { BinanceWithdrawalForwardProgress } from '@/components/otc/BinanceWithdrawalForwardProgress';
import type { OTCClient } from '@/types/otc';
import type { BinanceForwardStatusData, BinanceQuoteData } from '@/types/binance';

export interface BinanceWithdrawalConfirmData {
  coin: string;
  /** Valor que o cliente final recebe (backend faz gross-up) */
  amount: string;
  address: string;
  network: string;
  pin: string;
  addressTag?: string;
}

interface BinanceWithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: BinanceWithdrawalConfirmData) => void;
  loading?: boolean;
  balances?: Array<{
    coin: string;
    free: string;
    locked: string;
  }>;
  client?: OTCClient | null;
  quote?: BinanceQuoteData | null;
  onRequestQuote?: () => Promise<void>;
  /** Após saque criado — exibe stepper de repasse */
  showProgress?: boolean;
  forwardStatus?: BinanceForwardStatusData | null;
  withdrawId?: string | null;
  isPollingForward?: boolean;
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

type ModalStep = 'form' | 'confirm' | 'progress';

export const BinanceWithdrawalModal: React.FC<BinanceWithdrawalModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  balances = [],
  client = null,
  quote = null,
  onRequestQuote,
  showProgress = false,
  forwardStatus = null,
  withdrawId = null,
  isPollingForward = false,
}) => {
  const [step, setStep] = useState<ModalStep>('form');
  const [coin, setCoin] = useState('USDT');
  const [amount, setAmount] = useState('0,00');
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState('TRX');
  const [addressTag, setAddressTag] = useState('');
  const [pin, setPin] = useState('');
  const [networkFee, setNetworkFee] = useState<{ withdrawFee: string } | null>(null);
  const [networkFeeLoading, setNetworkFeeLoading] = useState(false);

  const networks = NETWORKS[coin as keyof typeof NETWORKS] || [{ value: 'TRX', label: 'TRX' }];

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(formatMonetaryInput(e.target.value));
  };

  useEffect(() => {
    const coinNetworks = NETWORKS[coin as keyof typeof NETWORKS] || [{ value: 'TRX', label: 'TRX' }];
    setNetwork(coinNetworks[0]?.value || 'TRX');
  }, [coin]);

  useEffect(() => {
    if (!isOpen) {
      setStep('form');
      setCoin('USDT');
      setAmount('0,00');
      setAddress('');
      setNetwork('TRX');
      setAddressTag('');
      setPin('');
      setManualTotpCode('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (showProgress && isOpen) {
      setStep('progress');
    }
  }, [showProgress, isOpen]);

  useEffect(() => {
    if (isOpen && !quote && onRequestQuote) {
      onRequestQuote();
    }
  }, [isOpen, quote, onRequestQuote]);

  useEffect(() => {
    const buscarTaxaRede = async () => {
      if (!isOpen || !coin || !network) return;

      setNetworkFeeLoading(true);
      try {
        const response = await consultarTaxaRedeBinance(coin, network);
        if (response?.success && response.data) {
          setNetworkFee(response.data);
        } else {
          setNetworkFee(null);
        }
      } catch {
        setNetworkFee(null);
      } finally {
        setNetworkFeeLoading(false);
      }
    };

    buscarTaxaRede();
  }, [isOpen, coin, network]);

  const valorInformado = getNumericValue(amount);
  const taxaRede = networkFee ? parseFloat(networkFee.withdrawFee) : 0;
  const estimativaDebitoBinance = valorInformado + taxaRede;

  const calculateBrlApproximate = () => {
    if (!quote || valorInformado <= 0) return 0;
    return valorInformado * quote.averagePrice;
  };

  const handleContinue = () => {
    if (!amount || !address || valorInformado <= 0) return;
    setStep('confirm');
  };

  const handleConfirm = () => {
    if (!/^\d{6}$/.test(pin)) return;
    if (!amount || !address || valorInformado <= 0) return;

    onConfirm({
      coin,
      amount: convertBrazilianToUS(amount),
      address,
      network,
      pin,
      addressTag: addressTag || undefined,
    });
  };

  const handleCancelConfirmation = () => {
    setStep('form');
    setPin('');
    setManualTotpCode('');
  };

  const handleMaxAmount = () => {
    const coinBalance = balances.find((b) => b.coin === coin);

    if (coinBalance && parseFloat(coinBalance.free) > 0) {
      const taxa = networkFee ? parseFloat(networkFee.withdrawFee) : 1.0;
      const maxAmount = parseFloat(coinBalance.free) - taxa;
      if (maxAmount > 0) {
        setAmount(formatMonetaryInput(maxAmount.toFixed(2).replace('.', '')));
      } else {
        setAmount('0,00');
      }
    } else {
      setAmount('0,00');
    }
  };

  const isValid = amount && address && valorInformado > 0;
  const canConfirm = isValid && /^\d{6}$/.test(pin) && !loading;
  const brlApproximate = calculateBrlApproximate();

  const handleClose = () => {
    if (loading || isPollingForward) return;
    onClose();
  };

  const title =
    step === 'progress'
      ? 'Acompanhando repasse'
      : step === 'confirm'
        ? 'Confirmar Saque'
        : 'Solicitar Saque';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Wallet className="w-4 h-4 text-orange-500" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {step === 'progress'
              ? 'Fluxo em 2 etapas: Binance → wallet TCR → wallet do cliente'
              : step === 'confirm'
                ? 'Informe PIN e TOTP para autorizar o saque'
                : 'Preencha os dados para solicitar um saque'}
          </DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <>
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
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Moeda</label>
                <Select value={coin} onValueChange={setCoin}>
                  <SelectTrigger className="w-full bg-muted/50 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDT">USDT</SelectItem>
                    <SelectItem value="BTC">BTC</SelectItem>
                    <SelectItem value="ETH">ETH</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Rede</label>
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

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Endereço da Wallet (cliente final)
                </label>
                <Input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="0x... ou T..."
                  className="bg-muted/50 font-mono text-sm h-10"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Valor que o cliente receberá
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
              </div>

              <Card className="bg-muted/30 border-border/50">
                <CardContent className="pt-3 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Cliente receberá</span>
                    <span className="font-semibold text-green-600">
                      {valorInformado > 0 ? valorInformado.toFixed(2).replace('.', ',') : '0,00'}{' '}
                      {coin}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      Taxa Binance (estimada)
                      {networkFeeLoading && <span className="ml-1">(…)</span>}
                    </span>
                    <span className="font-medium">
                      {networkFee ? `${taxaRede.toFixed(4).replace('.', ',')} ${coin}` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-border/50">
                    <span className="text-muted-foreground">Estimativa debitada na Binance</span>
                    <span className="font-semibold text-orange-600">
                      {estimativaDebitoBinance > 0
                        ? estimativaDebitoBinance.toFixed(4).replace('.', ',')
                        : '0,0000'}{' '}
                      {coin}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground pt-1">
                    O gross-up é feito automaticamente pelo backend.
                  </p>
                  {brlApproximate > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">BRL aproximado</span>
                      <span className="font-semibold text-green-600">
                        R$ {brlApproximate.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-yellow-700 dark:text-yellow-400">
                <p className="font-medium mb-0.5">Saque em 2 etapas</p>
                <p>
                  Binance envia para a wallet escrow TCR; em seguida o repasse on-chain vai para o
                  endereço do cliente.
                </p>
              </div>
            </div>

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
                    <span className="text-muted-foreground">Cliente receberá:</span>
                    <span className="font-semibold text-green-600">
                      {valorInformado > 0 ? valorInformado.toFixed(2).replace('.', ',') : '0,00'}{' '}
                      {coin}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rede:</span>
                    <span className="font-semibold">{network}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Endereço:</span>
                    <span className="font-mono text-xs break-all text-right">{address}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-1">
              <Label htmlFor="binance-withdraw-pin">PIN do operador</Label>
              <Input
                id="binance-withdraw-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                autoComplete="off"
                placeholder="••••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>

            <TotpField className="mt-1" />
          </div>
        )}

        {step === 'progress' && (
          <div className="space-y-3">
            {withdrawId && (
              <p className="text-xs text-muted-foreground">
                ID Binance: <span className="font-mono">{withdrawId}</span>
              </p>
            )}
            <BinanceWithdrawalForwardProgress
              forwardStatus={forwardStatus?.forward_status ?? 'aguardando_escrow'}
              lastError={forwardStatus?.last_error}
              txidRecebimento={forwardStatus?.txid_recebimento}
              txidReenvioCliente={forwardStatus?.txid_reenvio_cliente}
            />
            {isPollingForward && (
              <p className="text-xs text-center text-muted-foreground animate-pulse">
                Atualizando status a cada ~7 segundos…
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 'form' && (
            <>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
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
          )}
          {step === 'confirm' && (
            <>
              <Button variant="outline" onClick={handleCancelConfirmation} disabled={loading}>
                Voltar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!canConfirm}
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
          {step === 'progress' && (
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isPollingForward}
            >
              {isPollingForward ? 'Aguardando repasse…' : 'Fechar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
