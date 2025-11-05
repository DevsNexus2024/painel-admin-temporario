import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, DollarSign, CreditCard, RefreshCcw } from "lucide-react";
import { ledgerApi } from "@/services/ledger-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SaldoOrganizacaoTabProps {
  tenantId: number;
}

interface BalanceSummary {
  tenantId: string;
  summary: {
    totalAccounts: number;
    totalBalance: string;
    currency: string;
    byAccountType: Array<{
      accountType: string;
      count: number;
      totalBalance: string;
    }>;
  };
  transactions: {
    total: number;
    byType: Array<{
      journalType: string;
      count: number;
    }>;
  };
}

export default function SaldoOrganizacaoTab({ tenantId }: SaldoOrganizacaoTabProps) {
  const [summary, setSummary] = useState<BalanceSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, [tenantId]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const response = await ledgerApi.getBalanceSummary(tenantId);
      setSummary(response.data);
    } catch (error: any) {
      // Erro já tratado pelo ledgerApi
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#0069d1]" />
      </div>
    );
  }

  if (!summary) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">
          Nenhum dado disponível para esta organização
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Botão de Atualizar */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={fetchSummary}
          disabled={loading}
        >
          <RefreshCcw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)]">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-5 w-5 text-[#0069d1]" />
            <span className="text-sm text-muted-foreground">Total de Contas</span>
          </div>
          <div className="text-2xl font-bold text-[#0069d1]">
            {summary.summary.totalAccounts}
          </div>
        </Card>

        <Card className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)]">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-5 w-5 text-yellow-500" />
            <span className="text-sm text-muted-foreground">Saldo Total</span>
          </div>
          <div className="text-2xl font-bold text-yellow-500">
            {formatCurrency(summary.summary.totalBalance)}
          </div>
        </Card>

        <Card className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)]">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            <span className="text-sm text-muted-foreground">Total Transações</span>
          </div>
          <div className="text-2xl font-bold text-green-500">
            {summary.transactions.total}
          </div>
        </Card>

        <Card className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-muted-foreground">Moeda</span>
          </div>
          <div className="text-2xl font-bold text-blue-500">
            {summary.summary.currency}
          </div>
        </Card>
      </div>

      {/* Saldos por Tipo de Conta */}
      <Card className="p-4 lg:p-6 bg-background border border-[rgba(255,255,255,0.1)]">
        <h3 className="text-lg font-semibold mb-4">Saldos por Tipo de Conta</h3>
        <div className="space-y-3">
          {summary.summary.byAccountType.map((item) => (
            <div
              key={item.accountType}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
            >
              <span className="font-medium">{item.accountType}</span>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {item.count} conta{item.count !== 1 ? 's' : ''}
                </span>
                <span className={cn(
                  "font-bold",
                  parseFloat(item.totalBalance) >= 0 ? "text-green-500" : "text-red-500"
                )}>
                  {formatCurrency(item.totalBalance)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Transações por Tipo */}
      <Card className="p-4 lg:p-6 bg-background border border-[rgba(255,255,255,0.1)]">
        <h3 className="text-lg font-semibold mb-4">Transações por Tipo</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {summary.transactions.byType.map((item) => (
            <div
              key={item.journalType}
              className="p-4 rounded-lg bg-muted/30 flex flex-col items-center justify-center"
            >
              <span className="text-sm text-muted-foreground mb-1">{item.journalType}</span>
              <span className="text-2xl font-bold text-[#0069d1]">{item.count}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

