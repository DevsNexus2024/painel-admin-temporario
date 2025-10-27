/**
 * 💰 Trade Confirmation Modal
 * Modal para confirmar trade antes de executar na Binance
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Pencil, Check, X, Loader2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import type { BinanceQuoteData } from '@/types/binance';
import type { OTCClient } from '@/types/otc';

interface TradeConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (finalPrice: number, notes: string) => void;
  loading?: boolean;
  quote: BinanceQuoteData | null;
  selectedClient: OTCClient | null;
  operationType: 'buy' | 'sell';
  binanceFee: number; // Taxa da Binance em %
}

export const TradeConfirmationModal: React.FC<TradeConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  quote,
  selectedClient,
  operationType,
  binanceFee = 0.039, // Default 0.039%
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrice, setEditedPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [hasBeenEdited, setHasBeenEdited] = useState(false);

  // Resetar flag de edição quando modal abrir ou cotação mudar
  useEffect(() => {
    if (isOpen) {
      setHasBeenEdited(false);
      setIsEditing(false);
      setNotes(`Cliente: ${selectedClient?.name || ''}`);
      setOriginalPrice('');
      setEditedPrice('');
    }
  }, [isOpen, quote, selectedClient]);

  // Calcular preço final
  const calculateFinalPrice = () => {
    if (!quote) return 0;

    const avgPrice = quote.averagePrice;
    const clientFee = selectedClient?.fee || 0; // Já vem em formato decimal (0.005 = 0.5%)

    if (operationType === 'buy') {
      // Comprar: somar taxas
      const binanceFeeAmount = avgPrice * (binanceFee / 100);
      const afterBinanceFee = avgPrice + binanceFeeAmount;
      const clientFeeAmount = afterBinanceFee * clientFee; // clientFee já é decimal (0.005)
      const finalPrice = afterBinanceFee + clientFeeAmount;
      return finalPrice;
    } else {
      // Vender: subtrair taxas
      const binanceFeeAmount = avgPrice * (binanceFee / 100);
      const afterBinanceFee = avgPrice - binanceFeeAmount;
      const clientFeeAmount = afterBinanceFee * clientFee; // clientFee já é decimal (0.005)
      const finalPrice = afterBinanceFee - clientFeeAmount;
      return finalPrice;
    }
  };

  const finalPrice = calculateFinalPrice();

  // Salvar preço original ao montar
  useEffect(() => {
    if (finalPrice > 0 && isOpen) {
      setOriginalPrice(finalPrice.toFixed(4));
      setEditedPrice(finalPrice.toFixed(4));
    }
  }, [finalPrice, isOpen]);

  // Atualizar preço editado quando finalPrice mudar (APENAS se nunca foi editado)
  useEffect(() => {
    if (!hasBeenEdited && !isEditing) {
      setEditedPrice(finalPrice.toFixed(4));
    }
  }, [finalPrice, hasBeenEdited, isEditing]);

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedPrice(originalPrice);
    setHasBeenEdited(false); // Resetar flag de edição
  };

  const handleSaveEdit = () => {
    setIsEditing(false);
    setHasBeenEdited(true); // Marcar que o valor foi editado
    // O preço já está em editedPrice
  };

  const handleConfirm = () => {
    const priceToUse = parseFloat(editedPrice);
    if (priceToUse > 0) {
      onConfirm(priceToUse, notes);
    }
  };

  if (!quote || !selectedClient) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Confirmar Trade
          </DialogTitle>
          <DialogDescription className="text-sm">
            Revise os detalhes antes de executar o trade na Binance
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informações do Cliente */}
          <Card className="bg-muted/30 border-border/50">
            <CardContent className="pt-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-semibold">{selectedClient.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Documento:</span>
                  <span className="font-mono">{selectedClient.document}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxa do Cliente:</span>
                  <span className="font-semibold">{((selectedClient.fee || 0) * 100).toFixed(2)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Informações do Trade */}
          <Card className="bg-muted/30 border-border/50">
            <CardContent className="pt-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Operação:</span>
                  <span className={`font-semibold ${operationType === 'buy' ? 'text-blue-600' : 'text-orange-600'}`}>
                    {operationType === 'buy' ? 'COMPRA' : 'VENDA'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Quantidade Entrada:</span>
                  <span className="font-mono">{quote.inputAmount.toFixed(4)} {quote.inputCurrency}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Quantidade Saída:</span>
                  <span className="font-mono">{quote.outputAmount.toFixed(4)} {quote.outputCurrency}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Preço Médio Binance:</span>
                  <span className="font-mono">R$ {quote.averagePrice.toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxa Binance:</span>
                  <span className="font-mono">{binanceFee}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preço Final */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Preço Final (com taxas)
            </label>
            <div className="relative">
              <Input
                type="text"
                value={editedPrice}
                onChange={(e) => setEditedPrice(e.target.value)}
                disabled={!isEditing}
                className="bg-muted/50 text-lg font-semibold pr-16"
              />
              {isEditing ? (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    className="h-7 w-7 p-0 hover:bg-red-500/10"
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSaveEdit}
                    className="h-7 w-7 p-0 hover:bg-green-500/10"
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditing(true)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                >
                  <Pencil className="h-4 w-4 text-blue-600" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {operationType === 'buy' 
                ? 'Preço aplicado ao cliente (com taxas adicionadas)' 
                : 'Preço aplicado ao cliente (com taxas descontadas)'}
            </p>
          </div>

          {/* Campo de Descrição */}
          <div>
            <Label htmlFor="notes" className="text-sm font-medium text-foreground mb-2 block">
              Descrição da Operação
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione detalhes adicionais..."
              className="bg-muted/50 text-sm min-h-[80px]"
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Esta descrição será salva junto com os detalhes da transação
            </p>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-yellow-700 dark:text-yellow-400">
              <p className="font-medium mb-0.5">Atenção</p>
              <p>
                O trade será executado na Binance com o preço médio ({quote.averagePrice.toFixed(4)}). 
                O preço final editado será usado apenas para registro interno.
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
            disabled={loading || !editedPrice || parseFloat(editedPrice) <= 0 || !notes.trim()}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Executando...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Confirmar Trade
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

