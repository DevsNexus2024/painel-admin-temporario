import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownToLine, Loader2, Users, Hash, Banknote } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { reportService } from '@/services/reports';
import { DepositsStatsClientEntry } from '@/types/reports';
import { formatCurrencyBR } from '@/utils/reportExport';
import DateRangeFilter from './DateRangeFilter';

const DepositsStatsCard: React.FC = () => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['deposits-stats', dateFrom, dateTo],
    queryFn: async () => {
      const result = await reportService.fetchDepositsStats(
        dateFrom || undefined,
        dateTo || undefined,
      );
      return result.data;
    },
    staleTime: 60 * 1000,
  });

  const isPeriodFiltered = !!(dateFrom || dateTo);

  return (
    <div className="rounded-lg border border-border/60 bg-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted/80">
          <ArrowDownToLine className="h-4 w-4 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-medium">Depósitos OTC</h3>
          <p className="text-[11px] text-muted-foreground">
            Quantidade de depósitos por cliente {isPeriodFiltered ? '(filtrado)' : '(total geral)'}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-5 py-4">
        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
        />
      </div>

      {/* Resumo cards */}
      <div className="px-5 pb-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-sm text-destructive py-4 text-center">
            Erro ao carregar dados
          </div>
        ) : data ? (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-md bg-muted/40 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                  <Hash className="h-3 w-3" />
                  Total Depósitos
                </div>
                <p className="text-xl font-semibold tabular-nums">
                  {data.total_depositos.toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="rounded-md bg-muted/40 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                  <Banknote className="h-3 w-3" />
                  Volume Total
                </div>
                <p className="text-xl font-semibold tabular-nums">
                  {formatCurrencyBR(data.total_brl)}
                </p>
              </div>
              <div className="rounded-md bg-muted/40 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                  <Users className="h-3 w-3" />
                  Clientes
                </div>
                <p className="text-xl font-semibold tabular-nums">
                  {data.clientes.length}
                </p>
              </div>
            </div>

            {/* Tabela por cliente */}
            {data.clientes.length > 0 && (
              <div className="rounded-md border border-border/40 overflow-hidden">
                <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Cliente</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qtd</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total (BRL)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {data.clientes.map((c: DepositsStatsClientEntry) => (
                        <tr key={c.otc_client_id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{c.client_name}</span>
                              {!c.is_active && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  inativo
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {c.client_document}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">
                            {c.quantidade.toLocaleString('pt-BR')}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatCurrencyBR(c.total_brl)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {data.clientes.length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Nenhum depósito encontrado para o período selecionado
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default DepositsStatsCard;
