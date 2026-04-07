import React, { useState, useCallback } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import ReportCard from './ReportCard';
import DateRangeFilter from './DateRangeFilter';
import ClientSelector from './ClientSelector';
import { useReportGenerator } from '@/hooks/useReportGenerator';
import { reportService } from '@/services/reports';
import { exportToCSV, OTC_STATEMENT_COLUMNS, OTC_CONVERSIONS_COLUMNS, formatDateBR, formatCurrencyBR } from '@/utils/reportExport';
import { OTCClient, OTCTransaction, OTCConversion } from '@/types/otc';
import { format, subMonths } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const OtcReportsTab: React.FC = () => {
  const [clientId, setClientId] = useState<number | null>(null);
  const [clientName, setClientName] = useState('');
  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportType, setReportType] = useState<'statement' | 'conversions'>('statement');

  const handleClientChange = (id: number | null, client?: OTCClient) => {
    setClientId(id);
    setClientName(client?.name || '');
  };

  // ===== Extrato =====
  const statementGenerator = useReportGenerator<OTCTransaction>({
    pageSize: 200,
    fetchPage: useCallback(async (page: number, signal: AbortSignal) => {
      if (!clientId) throw new Error('Selecione um cliente');
      const result = await reportService.fetchOtcStatement(
        clientId,
        { clientId, dateFrom, dateTo },
        page,
        200,
        signal,
      );
      const data = result.data;
      return {
        data: data?.transacoes || [],
        total: data?.paginacao?.total || 0,
      };
    }, [clientId, dateFrom, dateTo]),
  });

  const handleGenerateStatement = async () => {
    if (!clientId) {
      toast.error('Selecione um cliente para gerar o relatório');
      return;
    }
    const data = await statementGenerator.generate();
    if (data && data.length > 0) {
      const formatted = data.map(t => ({
        date: formatDateBR(t.sort_date || t.date),
        type: t.type,
        description: t.description || t.operation_description || '',
        amount: formatCurrencyBR(t.amount),
        usd_amount: t.usd_amount ? formatCurrencyBR(t.usd_amount) : '',
        conversion_rate: t.conversion_rate || '',
        saldo_posterior: t.saldo_posterior != null ? formatCurrencyBR(t.saldo_posterior) : '',
        status: t.status,
        payer_name: t.payer_name || '',
        payer_document: t.payer_document || '',
      }));
      const filename = `extrato-otc-${clientName.replace(/\s+/g, '_')}-${dateFrom}-${dateTo}`;
      exportToCSV(formatted, OTC_STATEMENT_COLUMNS, filename);
      toast.success(`Relatório exportado: ${data.length} registros`);
    } else if (data && data.length === 0) {
      toast.info('Nenhum registro encontrado para o período selecionado');
    }
  };

  // ===== Conversões =====
  const conversionsGenerator = useReportGenerator<OTCConversion>({
    pageSize: 50,
    fetchPage: useCallback(async (page: number, signal: AbortSignal) => {
      if (!clientId) throw new Error('Selecione um cliente');
      const result = await reportService.fetchOtcConversions(
        clientId,
        { clientId, dateFrom, dateTo },
        page,
        50,
        signal,
      );
      return {
        data: result.data?.conversions || [],
        total: result.data?.pagination?.total_items || 0,
      };
    }, [clientId, dateFrom, dateTo]),
  });

  const handleGenerateConversions = async () => {
    if (!clientId) {
      toast.error('Selecione um cliente para gerar o relatório');
      return;
    }
    const data = await conversionsGenerator.generate();
    if (data && data.length > 0) {
      const formatted = data.map(c => ({
        created_at: formatDateBR(c.created_at),
        brl_amount: formatCurrencyBR(c.brl_amount),
        usd_amount: formatCurrencyBR(c.usd_amount),
        conversion_rate: c.conversion_rate.toFixed(4),
        brl_balance_after: formatCurrencyBR(c.brl_balance_after),
        usd_balance_after: formatCurrencyBR(c.usd_balance_after),
        description: c.description,
        admin_name: c.admin?.name || '',
      }));
      const filename = `conversoes-otc-${clientName.replace(/\s+/g, '_')}-${dateFrom}-${dateTo}`;
      exportToCSV(formatted, OTC_CONVERSIONS_COLUMNS, filename);
      toast.success(`Relatório exportado: ${data.length} conversões`);
    } else if (data && data.length === 0) {
      toast.info('Nenhuma conversão encontrada para o período selecionado');
    }
  };

  const activeGenerator = reportType === 'statement' ? statementGenerator : conversionsGenerator;
  const handleGenerate = reportType === 'statement' ? handleGenerateStatement : handleGenerateConversions;

  return (
    <div className="space-y-4">
      <ReportCard
        icon={<FileText className="h-5 w-5 text-blue-400" />}
        title="Extrato OTC"
        description="Movimentações e conversões dos clientes"
        isGenerating={activeGenerator.isGenerating}
        progress={activeGenerator.progress}
        onCancel={activeGenerator.cancel}
        onGenerateCSV={handleGenerate}
        error={activeGenerator.error}
        needsConfirmation={activeGenerator.needsConfirmation}
        onConfirm={activeGenerator.confirmAndGenerate}
        onDismiss={activeGenerator.dismissWarning}
        disabled={!clientId}
        disabledReason="Selecione um cliente"
      >
        <ClientSelector value={clientId} onChange={handleClientChange} />

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Tipo de Relatório</label>
          <Select value={reportType} onValueChange={(v: 'statement' | 'conversions') => setReportType(v)}>
            <SelectTrigger className="h-11 bg-white/5 border-white/10 text-white cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="statement">
                <div className="flex items-center gap-2">
                  <FileText className="h-3 w-3" />
                  Extrato Completo
                </div>
              </SelectItem>
              <SelectItem value="conversions">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-3 w-3" />
                  Conversões BRL/USD
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
        />
      </ReportCard>
    </div>
  );
};

export default OtcReportsTab;
