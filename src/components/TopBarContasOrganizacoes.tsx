import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Building2, CreditCard, DollarSign, Users, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { ledgerApi } from "@/services/ledger-api";
import AnimatedBalance from "@/components/AnimatedBalance";

interface SummaryData {
  totalOrganizations: number;
  totalAccounts: number;
  totalBalance: string;
  totalUsers: number;
}

export default function TopBarContasOrganizacoes() {
  const [summary, setSummary] = useState<SummaryData>({
    totalOrganizations: 0,
    totalAccounts: 0,
    totalBalance: '0',
    totalUsers: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Buscar total de organizações
      const tenantsResponse = await ledgerApi.listTenants({ limit: 1 });
      const totalOrganizations = tenantsResponse.pagination?.total || 0;

      // Buscar total de contas
      const accountsResponse = await ledgerApi.listAccounts({ limit: 1 });
      const totalAccounts = accountsResponse.pagination?.total || 0;

      // Calcular saldo total (simplificado - pode ser melhorado)
      // Por enquanto, vamos usar 0 e atualizar quando houver tenant selecionado
      const totalBalance = '0';

      // Total de usuários (simplificado - pode ser melhorado)
      const totalUsers = 0;

      setSummary({
        totalOrganizations,
        totalAccounts,
        totalBalance,
        totalUsers,
      });
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar resumo');
    } finally {
      setIsLoading(false);
    }
  };

  const parseValue = (value: string | number): number => {
    if (typeof value === 'number') return value;
    const parsed = parseFloat(String(value).replace(/[^\d.-]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatCurrency = (value: string | number): string => {
    const num = parseValue(value);
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <div className="sticky top-0 z-30 bg-background border-b border-border h-auto p-6">
      {/* Header principal */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[#0069d1] shadow-xl">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-[#0069d1]" />
              <h1 className="text-2xl font-bold text-foreground">
                Contas e Organizações
              </h1>
              <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-medium">
                Organizations
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Gestão de tenants, contas e saldos
            </p>
          </div>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {/* Card: Total de Organizações */}
        <Card className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-[18px] w-[18px] text-[#0069d1] group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">
              Total de Organizações
            </span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-[#0069d1] mt-1 overflow-hidden">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : error ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">{summary.totalOrganizations}</div>
            )}
          </div>
        </Card>

        {/* Card: Total de Contas */}
        <Card className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="h-[18px] w-[18px] text-green-500 group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">
              Total de Contas
            </span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-green-500 mt-1 overflow-hidden">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : error ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">{summary.totalAccounts}</div>
            )}
          </div>
        </Card>

        {/* Card: Saldo Total */}
        <Card className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-[18px] w-[18px] text-yellow-500 group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">
              Saldo Total
            </span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-yellow-500 mt-1 overflow-hidden">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : error ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">
                R$ <AnimatedBalance value={parseValue(summary.totalBalance)} />
              </div>
            )}
          </div>
        </Card>

        {/* Card: Total de Usuários */}
        <Card className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-[18px] w-[18px] text-purple-500 group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">
              Total de Usuários
            </span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-purple-500 mt-1 overflow-hidden">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : error ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">{summary.totalUsers}</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

