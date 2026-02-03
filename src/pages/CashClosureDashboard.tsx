import { useState, useMemo } from 'react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Calendar,
  Building2,
  Loader2,
  Download,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  useCashClosures,
  useCashClosureSummary,
  useCashClosureAccounts,
} from '@/hooks/useCashClosure';
import { CORPX_ACCOUNTS } from '@/contexts/CorpXContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Formatar valores monetários (arredondado para K/M)
const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(2)}K`;
  }
  return `R$ ${value.toFixed(2)}`;
};

// Formatar valores monetários exatos (sem arredondamento)
const formatCurrencyExact = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// Presets de período
const PERIOD_PRESETS = {
  last7Days: {
    label: 'Últimos 7 dias',
    getDates: () => ({
      startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
    }),
  },
  last30Days: {
    label: 'Últimos 30 dias',
    getDates: () => ({
      startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
    }),
  },
  currentMonth: {
    label: 'Mês atual',
    getDates: () => ({
      startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    }),
  },
};

export default function CashClosureDashboard() {
  const queryClient = useQueryClient();
  
  // Estados de filtros - padrão: dia anterior ao atual
  const yesterday = subDays(new Date(), 1);
  const [startDate, setStartDate] = useState<string>(
    format(yesterday, 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState<string>(
    format(yesterday, 'yyyy-MM-dd')
  );
  const [selectedAccount, setSelectedAccount] = useState<string>('all');

  // Queries - usar limit=100 para ver todas as contas de uma vez
  const { data: closuresData, isLoading: isLoadingClosures, refetch: refetchClosures } = useCashClosures({
    startDate,
    endDate,
    taxDocument: selectedAccount !== 'all' ? selectedAccount : undefined,
    page: 1,
    limit: 100, // Máximo permitido pela API
  });

  const { data: summaryData, isLoading: isLoadingSummary } = useCashClosureSummary({
    startDate,
    endDate,
    taxDocument: selectedAccount !== 'all' ? selectedAccount : undefined,
  });

  const { data: accountsData } = useCashClosureAccounts();

  // Criar mapeamento CNPJ -> Nome correto usando CORPX_ACCOUNTS (fonte confiável)
  const accountNameMap = useMemo(() => {
    const map = new Map<string, string>();
    
    // Primeiro, usar CORPX_ACCOUNTS (fonte confiável do sistema)
    CORPX_ACCOUNTS.forEach((account) => {
      if (account.cnpj && account.cnpj !== 'ALL' && account.razaoSocial) {
        // Normalizar CNPJ (remover formatação) para garantir match
        const normalizedCnpj = account.cnpj.replace(/\D/g, '');
        if (normalizedCnpj) {
          map.set(normalizedCnpj, account.razaoSocial);
        }
      }
    });
    
    // Adicionar CNPJs que faltam no CORPX_ACCOUNTS
    map.set('53781325000115', 'TCR FINANCE LTDA');
    
    // Depois, adicionar da API de contas (fallback)
    // IMPORTANTE: A API de contas pode ter nomes corretos mesmo que não estejam no CORPX_ACCOUNTS
    if (accountsData?.accounts) {
      accountsData.accounts.forEach((account) => {
        if (account.taxDocument && account.accountName) {
          const normalizedCnpj = account.taxDocument.replace(/\D/g, '');
          // Só adicionar se não começar com "CNPJ " (formato inválido)
          if (normalizedCnpj && !account.accountName.startsWith('CNPJ ')) {
            // Sobrescrever mesmo se já existir, pois a API de contas pode ter nome mais atualizado
            map.set(normalizedCnpj, account.accountName);
          }
        }
      });
    }
    
    return map;
  }, [accountsData]);

  // Agrupar dados por conta (nome + tax_document) com totais de créditos e débitos
  const accountTotals = useMemo(() => {
    if (!closuresData?.data) return [];
    
    const accountMap = new Map<string, {
      accountName: string;
      taxDocument: string;
      totalCredits: number;
      totalDebits: number;
      totalEntries: number; // pixReceivedCount
      totalExits: number; // pixSentCount
    }>();

    closuresData.data.forEach((closure) => {
      // Normalizar CNPJ (remover formatação)
      const normalizedCnpj = closure.taxDocument?.replace(/\D/g, '') || '';
      if (!normalizedCnpj) return; // Pular se não tiver CNPJ
      
      // Filtrar por conta se selecionada (comparar CNPJs normalizados)
      if (selectedAccount !== 'all') {
        const normalizedSelected = selectedAccount.replace(/\D/g, '');
        if (normalizedCnpj !== normalizedSelected) {
          return;
        }
      }
      
      const key = normalizedCnpj;
      const existing = accountMap.get(key);
      
      // Buscar nome correto do mapeamento
      // Prioridade: 1) accountNameMap (CORPX_ACCOUNTS + API de contas), 2) closure.accountName (só se não for formato "CNPJ XX.XXX.XXX/XXXX-XX")
      let correctAccountName = accountNameMap.get(key);
      
      // Se não encontrou no mapeamento, tentar usar o nome da API de fechamentos
      // mas NUNCA usar se vier formatado como "CNPJ XX.XXX.XXX/XXXX-XX"
      if (!correctAccountName) {
        if (closure.accountName && !closure.accountName.startsWith('CNPJ ')) {
          correctAccountName = closure.accountName;
        } else {
          // Se vier formatado como "CNPJ XX.XXX.XXX/XXXX-XX" ou não tiver nome, usar fallback
          correctAccountName = `Conta ${normalizedCnpj}`;
        }
      }
      
      if (existing) {
        existing.totalCredits += closure.totalCredits;
        existing.totalDebits += Math.abs(closure.totalDebits); // totalDebits já vem negativo da API
        existing.totalEntries += closure.totalCreditTransactions || 0;
        existing.totalExits += closure.totalDebitTransactions || 0;
      } else {
        accountMap.set(key, {
          accountName: correctAccountName,
          taxDocument: normalizedCnpj,
          totalCredits: closure.totalCredits,
          totalDebits: Math.abs(closure.totalDebits), // totalDebits já vem negativo da API
          totalEntries: closure.totalCreditTransactions || 0,
          totalExits: closure.totalDebitTransactions || 0,
        });
      }
    });

    return Array.from(accountMap.values()).sort((a, b) => 
      a.accountName.localeCompare(b.accountName)
    );
  }, [closuresData, selectedAccount, accountNameMap]);

  // Filtrar fechamentos TTF com estatísticas PIX-OUT
  const ttfClosuresWithStats = useMemo(() => {
    if (!closuresData?.data) return [];
    
    return closuresData.data.filter(
      (closure) => {
        const normalizedCnpj = closure.taxDocument?.replace(/\D/g, '') || '';
        return (
          normalizedCnpj === '14283885000198' &&
          closure.ttfPixOutStats
        );
      }
    );
  }, [closuresData]);

  // Handler para preset de período
  const handlePeriodPreset = (preset: keyof typeof PERIOD_PRESETS) => {
    const dates = PERIOD_PRESETS[preset].getDates();
    setStartDate(dates.startDate);
    setEndDate(dates.endDate);
  };

  // Handler para refresh
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['cash-closure'] });
    toast.success('Dados atualizados');
  };

  // Handler para exportar CSV (placeholder)
  const handleExportCSV = () => {
    toast.info('Funcionalidade de exportação em desenvolvimento');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0A0A] via-[#0F0F0F] to-[#0A0A0A] text-white">
      {/* Background Pattern */}
      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-8">
        {/* Header */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#FF7A3D] blur-xl opacity-30 rounded-full"></div>
                  <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF7A3D] to-[#FF8A4D] flex items-center justify-center shadow-lg shadow-[#FF7A3D]/20">
                    <DollarSign className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                    Cash Closure
                  </h1>
                  <p className="text-gray-400 mt-2 text-sm sm:text-base font-medium">
                    Fechamentos de caixa diários das contas CorpX
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF7A3D] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF7A3D]"></span>
                </div>
                <span className="text-xs font-medium text-gray-400">
                  {new Date().toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <Button
                onClick={handleRefresh}
                disabled={isLoadingClosures || isLoadingSummary}
                className="h-11 px-5 bg-gradient-to-r from-[#FF7A3D] to-[#FF8A4D] hover:from-[#FF8A4D] hover:to-[#FF7A3D] text-white border-0 shadow-lg shadow-[#FF7A3D]/25 transition-all duration-300 hover:scale-105"
              >
                <RefreshCw
                  className={cn(
                    'h-4 w-4 mr-2',
                    (isLoadingClosures || isLoadingSummary) && 'animate-spin'
                  )}
                />
                Atualizar
              </Button>
            </div>
          </div>

          {/* Filtros */}
          <Card className="bg-white/5 border-white/10 backdrop-blur-xl p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex flex-col sm:flex-row gap-4 flex-1">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                    Data Inicial
                  </label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-[#FF7A3D] focus-visible:border-[#FF7A3D]/50"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                    Data Final
                  </label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-[#FF7A3D] focus-visible:border-[#FF7A3D]/50"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                    Conta
                  </label>
                  <Select
                    value={selectedAccount}
                    onValueChange={setSelectedAccount}
                  >
                    <SelectTrigger className="h-11 bg-white/5 border-white/10 text-white focus:ring-[#FF7A3D]">
                      <Building2 className="h-4 w-4 mr-2 text-gray-400" />
                      <SelectValue placeholder="Todas as contas" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1A1A] border-white/10 text-white">
                      <SelectItem value="all">Todas as contas</SelectItem>
                      {accountsData?.accounts.map((account) => {
                        const normalizedCnpj = account.taxDocument.replace(/\D/g, '');
                        const accountName = accountNameMap.get(normalizedCnpj) || account.accountName;
                        // Não mostrar se o nome começar com "CNPJ "
                        if (accountName && !accountName.startsWith('CNPJ ')) {
                          return (
                            <SelectItem key={account.taxDocument} value={account.taxDocument}>
                              {accountName}
                            </SelectItem>
                          );
                        }
                        return null;
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(PERIOD_PRESETS).map(([key, preset]) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    onClick={() => handlePeriodPreset(key as keyof typeof PERIOD_PRESETS)}
                    className="h-11 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          </Card>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Total Créditos */}
            <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-sm hover:border-green-500/30 transition-all duration-300 group">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  </div>
                </div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Total Créditos
                </p>
                <p className="text-2xl font-bold text-white money-font">
                  {isLoadingSummary ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    formatCurrencyExact(summaryData?.totals.totalCredits || 0)
                  )}
                </p>
                {summaryData && (
                  <p className="text-xs text-gray-400 mt-1">
                    {summaryData.totals.pixReceivedCount.toLocaleString('pt-BR')} PIX recebidos
                  </p>
                )}
              </div>
            </Card>

            {/* Total Débitos */}
            <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-sm hover:border-red-500/30 transition-all duration-300 group">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-red-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <TrendingDown className="w-5 h-5 text-red-400" />
                  </div>
                </div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Total Débitos
                </p>
                <p className="text-2xl font-bold text-white money-font">
                  {isLoadingSummary ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    formatCurrencyExact(Math.abs(summaryData?.totals.totalDebits || 0))
                  )}
                </p>
                {summaryData && (
                  <p className="text-xs text-gray-400 mt-1">
                    {summaryData.totals.pixSentCount.toLocaleString('pt-BR')} PIX enviados
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Tabela de Fechamentos por Conta */}
          <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Resumo por Conta</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCSV}
                    className="border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isLoadingClosures}
                    className="text-gray-300 hover:text-white"
                  >
                    <RefreshCw
                      className={cn('h-4 w-4', isLoadingClosures && 'animate-spin')}
                    />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingClosures ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-[#FF7A3D]" />
                </div>
              ) : accountTotals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                    <Calendar className="w-8 h-8 text-gray-500" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Nenhum dado encontrado
                  </h3>
                  <p className="text-gray-400 max-w-sm">
                    Não há fechamentos para o período selecionado.
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/10 hover:bg-white/5">
                          <TableHead className="text-gray-400">Nome da Conta</TableHead>
                          <TableHead className="text-gray-400">CNPJ</TableHead>
                          <TableHead className="text-gray-400 text-right">Total Créditos</TableHead>
                          <TableHead className="text-gray-400 text-right">Total Débitos</TableHead>
                          <TableHead className="text-gray-400 text-right">Qtd. Entrada</TableHead>
                          <TableHead className="text-gray-400 text-right">Qtd. Saída</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accountTotals.map((account, index) => (
                          <TableRow
                            key={`${account.taxDocument}-${index}`}
                            className="border-white/10 hover:bg-white/5"
                          >
                            <TableCell className="font-medium text-white">
                              {account.accountName}
                            </TableCell>
                            <TableCell className="text-gray-300 font-mono text-sm">
                              {account.taxDocument}
                            </TableCell>
                            <TableCell className="text-right font-bold text-green-400 money-font">
                              {formatCurrencyExact(account.totalCredits)}
                            </TableCell>
                            <TableCell className="text-right font-bold text-red-400 money-font">
                              {formatCurrencyExact(account.totalDebits)}
                            </TableCell>
                            <TableCell className="text-right text-gray-300">
                              {account.totalEntries.toLocaleString('pt-BR')}
                            </TableCell>
                            <TableCell className="text-right text-gray-300">
                              {account.totalExits.toLocaleString('pt-BR')}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Linha de Total Geral */}
                        {summaryData && (
                          <TableRow className="border-white/20 bg-white/5 font-bold">
                            <TableCell colSpan={2} className="text-white">
                              TOTAL GERAL
                            </TableCell>
                            <TableCell className="text-right text-green-400 money-font">
                              {formatCurrencyExact(summaryData.totals.totalCredits)}
                            </TableCell>
                            <TableCell className="text-right text-red-400 money-font">
                              {formatCurrencyExact(Math.abs(summaryData.totals.totalDebits))}
                            </TableCell>
                            <TableCell className="text-right text-white">
                              {summaryData.totals.pixReceivedCount.toLocaleString('pt-BR')}
                            </TableCell>
                            <TableCell className="text-right text-white">
                              {summaryData.totals.pixSentCount.toLocaleString('pt-BR')}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Estatísticas PIX-OUT TTF */}
          {ttfClosuresWithStats.length > 0 && (
            <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center gap-2">
                      <ArrowRight className="h-5 w-5 text-[#FF7A3D]" />
                      Estatísticas PIX-OUT - TTF
                    </CardTitle>
                    <p className="text-sm text-gray-400 mt-1">
                      Distribuição de PIX enviados por destino (apenas TTF)
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {ttfClosuresWithStats.map((closure) => {
                  const stats = closure.ttfPixOutStats!;
                  const normalizedCnpj = closure.taxDocument?.replace(/\D/g, '') || '';
                  const accountName = accountNameMap.get(normalizedCnpj) || closure.accountName || 'TTF SERVICOS DIGITAIS LTDA';
                  
                  return (
                    <div key={closure.id} className="space-y-4">
                      {/* Header do Fechamento */}
                      <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
                        <div>
                          <p className="text-sm font-semibold text-white">{accountName}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Fechamento: {format(new Date(closure.closureDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Total de Destinos</p>
                          <p className="text-lg font-bold text-white">{stats.totalDestinations}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Total de Transações</p>
                          <p className="text-lg font-bold text-white">{stats.totalTransactions.toLocaleString('pt-BR')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Valor Total</p>
                          <p className="text-lg font-bold text-red-400 money-font">
                            {formatCurrencyExact(Math.abs(stats.totalAmount))}
                          </p>
                        </div>
                      </div>

                      {/* Tabela de Destinos */}
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-white/10 hover:bg-white/5">
                              <TableHead className="text-gray-400">#</TableHead>
                              <TableHead className="text-gray-400">Chave PIX / Destino</TableHead>
                              <TableHead className="text-gray-400">Beneficiário</TableHead>
                              <TableHead className="text-gray-400 text-right">Transações</TableHead>
                              <TableHead className="text-gray-400 text-right">Valor Total</TableHead>
                              <TableHead className="text-gray-400 text-right">% do Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stats.byDestination.map((dest, idx) => {
                              const percentage = (Math.abs(dest.totalAmount) / Math.abs(stats.totalAmount)) * 100;
                              const destinationLabel = dest.pixKey || dest.beneficiaryDocument || 'Sem identificação';
                              const beneficiaryLabel = dest.beneficiaryName || dest.beneficiaryDocument || 'N/A';
                              
                              return (
                                <TableRow
                                  key={`${closure.id}-${idx}`}
                                  className="border-white/10 hover:bg-white/5"
                                >
                                  <TableCell className="text-gray-300 font-medium">
                                    {idx + 1}
                                  </TableCell>
                                  <TableCell className="font-mono text-sm text-white">
                                    {dest.pixKey ? (
                                      <span title="Chave PIX">{dest.pixKey}</span>
                                    ) : (
                                      <span className="italic text-gray-400">
                                        {dest.beneficiaryDocument || 'Transferência Interna'}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-gray-300">
                                    {beneficiaryLabel}
                                  </TableCell>
                                  <TableCell className="text-right text-gray-300">
                                    {dest.transactionCount.toLocaleString('pt-BR')}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-red-400 money-font">
                                    {formatCurrencyExact(Math.abs(dest.totalAmount))}
                                  </TableCell>
                                  <TableCell className="text-right text-gray-300">
                                    {percentage.toFixed(2)}%
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Timestamp de cálculo (se disponível) */}
                      {stats.calculatedAt && (
                        <p className="text-xs text-gray-500 text-right">
                          Calculado em: {format(new Date(stats.calculatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
