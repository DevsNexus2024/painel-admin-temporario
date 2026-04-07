import React, { useState, useCallback, useMemo } from 'react';
import { Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, subMonths } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import ReportCard from './ReportCard';
import DateRangeFilter from './DateRangeFilter';
import { useReportGenerator } from '@/hooks/useReportGenerator';
import { reportService } from '@/services/reports';
import { exportToCSVMapped, BANKING_COLUMNS, formatDateBR, formatCurrencyBR } from '@/utils/reportExport';
import { TcrTransaction } from '@/types/reports';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

const BankingReportsTab: React.FC = () => {
  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [provider, setProvider] = useState<'all' | 'corpx' | 'brasilcash'>('all');
  const [accountId, setAccountId] = useState('all');
  const [type, setType] = useState<'all' | 'CREDIT' | 'DEBIT'>('all');
  const [search, setSearch] = useState('');

  // Buscar contas disponíveis
  const { data: accountsData } = useQuery({
    queryKey: ['tcr-accounts'],
    queryFn: async () => {
      const result = await reportService.fetchAccounts();
      return result.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const accounts = accountsData || [];

  // Filtrar contas por provider selecionado
  const filteredAccounts = useMemo(() => {
    if (provider === 'all') return accounts;
    return accounts.filter(a => a.provider.toLowerCase() === provider);
  }, [accounts, provider]);

  // Reset accountId quando muda provider
  const handleProviderChange = (v: 'all' | 'corpx' | 'brasilcash') => {
    setProvider(v);
    setAccountId('all');
  };

  const generator = useReportGenerator<TcrTransaction>({
    pageSize: 2000,
    fetchPage: useCallback(async (page: number, signal: AbortSignal) => {
      const result = await reportService.fetchBankingTransactions(
        {
          dateFrom,
          dateTo,
          provider: provider === 'all' ? undefined : provider,
          accountId: accountId !== 'all' ? accountId : undefined,
          type: type !== 'all' ? type : undefined,
          search: search || undefined,
        },
        page,
        2000,
        signal,
      );
      return {
        data: result.data || [],
        total: result.total || 0,
      };
    }, [dateFrom, dateTo, provider, accountId, type, search]),
  });

  const handleGenerate = async () => {
    const data = await generator.generate();
    if (data && data.length > 0) {
      const filename = `bancario-${provider}-${dateFrom}-${dateTo}`;
      exportToCSVMapped(data, BANKING_COLUMNS, (t) => ({
        date: formatDateBR(t.transactionDate),
        provider: t.provider,
        type: t.type === 'CREDIT' ? 'Entrada' : 'Saída',
        amount: formatCurrencyBR(t.amount),
        status: t.status,
        endToEndId: t.endToEndId || '',
        payerName: t.payerName || '',
        payerDocument: t.payerDocument || '',
        beneficiaryName: t.beneficiaryName || '',
        beneficiaryDocument: t.beneficiaryDocument || '',
        pixKey: t.pixKey || '',
      }), filename);
      toast.success(`Relatório exportado: ${data.length} transações`);
    } else if (data && data.length === 0) {
      toast.info('Nenhuma transação encontrada para os filtros selecionados');
    }
  };

  return (
    <div className="space-y-4">
      <ReportCard
        icon={<Building2 className="h-5 w-5 text-emerald-400" />}
        title="Extrato Bancário"
        description="Transações unificadas CorpX + BrasilCash"
        isGenerating={generator.isGenerating}
        progress={generator.progress}
        onCancel={generator.cancel}
        onGenerateCSV={handleGenerate}
        error={generator.error}
        needsConfirmation={generator.needsConfirmation}
        onConfirm={generator.confirmAndGenerate}
        onDismiss={generator.dismissWarning}
      >
        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Provider</label>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger className="h-11 bg-white/5 border-white/10 text-white cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="corpx">CorpX</SelectItem>
                <SelectItem value="brasilcash">BrasilCash</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Conta</label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-11 bg-white/5 border-white/10 text-white cursor-pointer">
                <SelectValue placeholder="Todas as contas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {filteredAccounts.map(acc => (
                  <SelectItem key={`${acc.provider}-${acc.accountId}`} value={acc.accountId}>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {acc.provider}
                      </span>
                      <span className="font-medium">{acc.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Tipo</label>
            <Select value={type} onValueChange={(v: 'all' | 'CREDIT' | 'DEBIT') => setType(v)}>
              <SelectTrigger className="h-11 bg-white/5 border-white/10 text-white cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="CREDIT">Entrada</SelectItem>
                <SelectItem value="DEBIT">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Busca</label>
            <Input
              placeholder="Documento, nome, PIX..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
            />
          </div>
        </div>
      </ReportCard>
    </div>
  );
};

export default BankingReportsTab;
