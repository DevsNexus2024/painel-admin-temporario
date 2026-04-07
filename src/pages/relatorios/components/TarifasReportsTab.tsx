import React, { useState, useCallback, useMemo } from 'react';
import { DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { format, subMonths } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import ReportCard from './ReportCard';
import DateRangeFilter from './DateRangeFilter';
import { useReportGenerator } from '@/hooks/useReportGenerator';
import { reportService } from '@/services/reports';
import { exportToCSVMapped, TARIFA_COLUMNS, formatDateBR, formatCurrencyBR } from '@/utils/reportExport';
import { BRASILCASH_ACCOUNTS, ReportProgress } from '@/types/reports';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TarifaRow {
  date: string;
  provider: string;
  amount: number;
  description: string;
  transactionId: string;
  accountName: string;
}

const TarifasReportsTab: React.FC = () => {
  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [provider, setProvider] = useState<'all' | 'corpx' | 'brasilcash'>('all');
  const [brasilcashOtcId, setBrasilcashOtcId] = useState('all');
  const [corpxAccountId, setCorpxAccountId] = useState('all');

  // Buscar contas CorpX do tcr-baas
  const { data: accountsData } = useQuery({
    queryKey: ['tcr-accounts-corpx'],
    queryFn: async () => {
      const result = await reportService.fetchAccounts('CORPX');
      return result.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const corpxAccounts = accountsData || [];

  // CorpX tarifas — offset-based
  const corpxGenerator = useReportGenerator<TarifaRow>({
    pageSize: 2000,
    fetchPage: useCallback(async (page: number, signal: AbortSignal) => {
      const offset = (page - 1) * 2000;
      const result = await reportService.fetchCorpxTariffs(
        {
          dateFrom,
          dateTo,
          accountId: corpxAccountId !== 'all' ? corpxAccountId : undefined,
        },
        offset,
        2000,
        signal,
      );
      const selectedAccountName = corpxAccounts.find(a => a.accountId === corpxAccountId)?.name;
      const data = (result.data || []).map(t => ({
        date: t.transactionDate,
        provider: 'CorpX',
        amount: t.amount,
        description: t.beneficiaryName || 'TARIFA',
        transactionId: t.transactionId || '',
        accountName: selectedAccountName || t.payerName || 'CorpX',
      }));
      return { data, total: result.pagination?.total || 0 };
    }, [dateFrom, dateTo, corpxAccountId, corpxAccounts]),
  });

  // BrasilCash tarifas — offset-based (conta específica)
  const brasilcashGenerator = useReportGenerator<TarifaRow>({
    pageSize: 2000,
    fetchPage: useCallback(async (page: number, signal: AbortSignal) => {
      if (brasilcashOtcId === 'all') {
        // Quando "todas", não usa o generator paginado — handled no handleGenerate
        return { data: [], total: 0 };
      }
      const offset = (page - 1) * 2000;
      const result = await reportService.fetchBrasilcashTariffs(
        { dateFrom, dateTo, otcId: brasilcashOtcId },
        offset,
        2000,
        signal,
      );
      const accountName = BRASILCASH_ACCOUNTS.find(a => a.otcId === brasilcashOtcId)?.name || brasilcashOtcId;
      const data = (result.data || []).map(t => ({
        date: t.created_at,
        provider: 'BrasilCash',
        amount: t.amount,
        description: `Tarifa - ${t.method || 'PIX'}`,
        transactionId: t.end_to_end_id || t.pix_id || '',
        accountName,
      }));
      return { data, total: result.pagination?.total || 0 };
    }, [dateFrom, dateTo, brasilcashOtcId]),
  });

  // Buscar tarifas BrasilCash de TODAS as contas em paralelo
  const fetchAllBrasilcashTariffs = async (signal?: AbortSignal): Promise<TarifaRow[]> => {
    const allRows: TarifaRow[] = [];

    const accountFetches = BRASILCASH_ACCOUNTS.map(async (acc) => {
      const rows: TarifaRow[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        if (signal?.aborted) return rows;
        const result = await reportService.fetchBrasilcashTariffs(
          { dateFrom, dateTo, otcId: acc.otcId },
          offset,
          2000,
          signal,
        );
        const data = (result.data || []).map(t => ({
          date: t.created_at,
          provider: 'BrasilCash',
          amount: t.amount,
          description: `Tarifa - ${t.method || 'PIX'}`,
          transactionId: t.end_to_end_id || t.pix_id || '',
          accountName: acc.name,
        }));
        rows.push(...data);
        hasMore = result.pagination?.has_more ?? false;
        offset += 2000;
      }
      return rows;
    });

    const results = await Promise.all(accountFetches);
    for (const rows of results) {
      allRows.push(...rows);
    }
    return allRows;
  };

  const doExport = (allData: TarifaRow[]) => {
    if (allData.length === 0) {
      toast.info('Nenhuma tarifa encontrada para os filtros selecionados');
      return;
    }

    allData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const totalTarifas = allData.reduce((acc, t) => acc + Math.abs(t.amount), 0);

    const filename = `tarifas-${provider}-${dateFrom}-${dateTo}`;
    exportToCSVMapped(allData, TARIFA_COLUMNS, (t) => ({
      date: formatDateBR(t.date),
      provider: t.provider,
      amount: formatCurrencyBR(Math.abs(t.amount)),
      description: t.description,
      transactionId: t.transactionId,
      accountName: t.accountName,
    }), filename);
    toast.success(
      `Relatório exportado: ${allData.length} tarifas — Total: ${formatCurrencyBR(totalTarifas)}`
    );
  };

  const [isFetchingAll, setIsFetchingAll] = useState(false);

  const handleGenerate = async () => {
    const promises: Promise<TarifaRow[] | null>[] = [];

    if (provider === 'all' || provider === 'corpx') {
      promises.push(corpxGenerator.generate());
    }

    if (provider === 'all' || provider === 'brasilcash') {
      if (brasilcashOtcId === 'all') {
        // Buscar de todas as contas BrasilCash em paralelo
        setIsFetchingAll(true);
        promises.push(
          fetchAllBrasilcashTariffs().then(rows => rows.length > 0 ? rows : null).finally(() => setIsFetchingAll(false))
        );
      } else {
        promises.push(brasilcashGenerator.generate());
      }
    }

    const results = await Promise.all(promises);

    if (corpxGenerator.needsConfirmation || brasilcashGenerator.needsConfirmation) {
      return;
    }

    const allData: TarifaRow[] = [];
    for (const result of results) {
      if (result) allData.push(...result);
    }

    doExport(allData);
  };

  const handleConfirm = async () => {
    const promises: Promise<TarifaRow[] | null>[] = [];

    if (corpxGenerator.needsConfirmation) {
      promises.push(corpxGenerator.confirmAndGenerate());
    }
    if (brasilcashGenerator.needsConfirmation) {
      promises.push(brasilcashGenerator.confirmAndGenerate());
    }

    const results = await Promise.all(promises);

    const allData: TarifaRow[] = [];
    for (const result of results) {
      if (result) allData.push(...result);
    }

    doExport(allData);
  };

  const isGenerating = corpxGenerator.isGenerating || brasilcashGenerator.isGenerating || isFetchingAll;
  const activeError = corpxGenerator.error || brasilcashGenerator.error;
  const needsConfirmation = corpxGenerator.needsConfirmation || brasilcashGenerator.needsConfirmation;

  const combinedProgress: ReportProgress = useMemo(() => {
    const cp = corpxGenerator.progress;
    const bp = brasilcashGenerator.progress;

    if (provider !== 'all') {
      return provider === 'corpx' ? cp : bp;
    }

    const totalRecords = cp.total + bp.total;
    const currentRecords = cp.current + bp.current;
    const totalPages = cp.totalPages + bp.totalPages;
    const currentPage = cp.page + bp.page;

    return {
      current: currentRecords,
      total: totalRecords,
      percentage: totalRecords > 0 ? Math.round((currentRecords / totalRecords) * 100) : 0,
      page: currentPage,
      totalPages,
      estimatedTimeLeft: cp.estimatedTimeLeft || bp.estimatedTimeLeft,
    };
  }, [provider, corpxGenerator.progress, brasilcashGenerator.progress]);

  const handleCancel = () => {
    corpxGenerator.cancel();
    brasilcashGenerator.cancel();
  };

  const handleDismiss = () => {
    corpxGenerator.dismissWarning();
    brasilcashGenerator.dismissWarning();
  };

  return (
    <div className="space-y-4">
      <ReportCard
        icon={<DollarSign className="h-5 w-5 text-amber-400" />}
        title="Tarifas"
        description="Taxas cobradas por CorpX e BrasilCash"
        isGenerating={isGenerating}
        progress={combinedProgress}
        onCancel={handleCancel}
        onGenerateCSV={handleGenerate}
        error={activeError}
        needsConfirmation={needsConfirmation}
        onConfirm={handleConfirm}
        onDismiss={handleDismiss}
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
            <Select value={provider} onValueChange={(v: 'all' | 'corpx' | 'brasilcash') => setProvider(v)}>
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

          {/* Conta CorpX */}
          {(provider === 'all' || provider === 'corpx') && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Conta CorpX</label>
              <Select value={corpxAccountId} onValueChange={setCorpxAccountId}>
                <SelectTrigger className="h-11 bg-white/5 border-white/10 text-white cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as contas</SelectItem>
                  {corpxAccounts.map(acc => (
                    <SelectItem key={acc.accountId} value={acc.accountId}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Conta BrasilCash */}
          {(provider === 'all' || provider === 'brasilcash') && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Conta BrasilCash</label>
              <Select value={brasilcashOtcId} onValueChange={setBrasilcashOtcId}>
                <SelectTrigger className="h-11 bg-white/5 border-white/10 text-white cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as contas</SelectItem>
                  {BRASILCASH_ACCOUNTS.map(acc => (
                    <SelectItem key={acc.otcId} value={acc.otcId}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </ReportCard>
    </div>
  );
};

export default TarifasReportsTab;
