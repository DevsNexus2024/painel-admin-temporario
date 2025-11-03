import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, DollarSign, TrendingUp, TrendingDown, RefreshCcw } from "lucide-react";
import { ledgerApi } from "@/services/ledger-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SaldoContaTabProps {
  accountId: number | string;
  tenantId: number | string;
}

interface BalanceSummary {
  accountId: string;
  tenantId: string;
  accountType: string;
  currency: string;
  currentBalance: string;
  totalPayIn: string;
  totalPayOut: string;
  transactionCount: number;
  lastTransactionAt: string;
}

export default function SaldoContaTab({ accountId, tenantId }: SaldoContaTabProps) {
  const [summary, setSummary] = useState<BalanceSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, [accountId, tenantId]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const accountIdNum = typeof accountId === 'string' ? parseInt(accountId) : accountId;
      const tenantIdNum = typeof tenantId === 'string' ? parseInt(tenantId) : tenantId;
      
      const response = await ledgerApi.getBalanceSummary(tenantIdNum, {
        accountId: accountIdNum,
        currency: 'BRL', // Moeda padrão conforme documentação
      });
      
      setSummary(response.data);
    } catch (error: any) {
      toast.error("Erro ao carregar resumo de saldo");
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

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('pt-BR');
    } catch {
      return dateString;
    }
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
          Nenhum dado disponível para esta conta
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
            <DollarSign className="h-5 w-5 text-[#0069d1]" />
            <span className="text-sm text-muted-foreground">Saldo Atual</span>
          </div>
          <div className={cn(
            "text-2xl font-bold",
            parseFloat(summary.currentBalance) >= 0 ? "text-green-500" : "text-red-500"
          )}>
            {formatCurrency(summary.currentBalance)}
          </div>
        </Card>

        <Card className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)]">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            <span className="text-sm text-muted-foreground">Total Entradas</span>
          </div>
          <div className="text-2xl font-bold text-green-500">
            {formatCurrency(summary.totalPayIn)}
          </div>
        </Card>

        <Card className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)]">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-5 w-5 text-red-500" />
            <span className="text-sm text-muted-foreground">Total Saídas</span>
          </div>
          <div className="text-2xl font-bold text-red-500">
            {formatCurrency(summary.totalPayOut)}
          </div>
        </Card>

        <Card className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-muted-foreground">Total Transações</span>
          </div>
          <div className="text-2xl font-bold text-blue-500">
            {summary.transactionCount}
          </div>
        </Card>
      </div>

      {/* Informações Adicionais */}
      <Card className="p-4 lg:p-6 bg-background border border-[rgba(255,255,255,0.1)]">
        <h3 className="text-lg font-semibold mb-4">Informações da Conta</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Tipo de Conta</p>
            <p className="text-sm font-semibold">{summary.accountType}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Moeda</p>
            <p className="text-sm font-semibold font-mono">{summary.currency}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Última Transação</p>
            <p className="text-sm">{summary.lastTransactionAt ? formatDate(summary.lastTransactionAt) : "N/A"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">ID da Conta</p>
            <p className="text-sm font-mono">{summary.accountId}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

