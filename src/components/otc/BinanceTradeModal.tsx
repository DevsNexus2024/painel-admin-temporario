/**
 * 🪙 Binance Trade Modal
 * Modal para confirmação de trade na Binance
 */

import React from 'react';
import { AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { BinanceQuoteData } from '@/types/binance';

interface BinanceTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  quote: BinanceQuoteData | null;
  loading?: boolean;
}

export const BinanceTradeModal: React.FC<BinanceTradeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  quote,
  loading = false,
}) => {
  if (!quote) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Confirmar Trade
          </DialogTitle>
          <DialogDescription>
            Confirme os detalhes antes de executar o trade
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quote Info */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">
                    R$ {quote.averagePrice.toFixed(4)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Preço Médio</p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Quantidade (USDT)</p>
                    <p className="font-mono text-sm font-medium">
                      {quote.totalQuantity.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 8,
                      })}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Total (BRL)</p>
                    <p className="font-mono text-sm font-medium">
                      R$ {quote.totalCost.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Ordens Usadas</p>
                    <p className="font-mono text-sm font-medium">{quote.ordersUsed}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Orderbook Depth</p>
                    <p className="font-mono text-sm font-medium">{quote.orderBookDepth}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Warning */}
          <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-700 dark:text-yellow-400">
              <p className="font-medium mb-1">Atenção</p>
              <p>
                Esta operação executará uma ordem de compra na Binance. 
                Após a confirmação, a ordem será processada imediatamente.
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
            onClick={onConfirm}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Executando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirmar e Executar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

