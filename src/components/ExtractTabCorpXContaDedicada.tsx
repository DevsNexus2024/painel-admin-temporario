import { useState, useMemo, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Search,
  Download,
  ArrowUpCircle,
  ArrowDownCircle,
  Loader2,
  FileText,
  X,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Calendar as CalendarIcon,
  CheckCircle,
  Check,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import CompensationModalInteligente from "@/components/CompensationModalInteligente";
import { TCRVerificacaoService } from "@/services/tcrVerificacao";
import type { CorpXTransactionItem } from "@/types/corpx";
import {
  CONTA_DEDICADA_CORPX,
  contaEstaConfigurada,
  rotuloConta,
  ehAnteriorAoVinculo,
  montarIdentificacaoCompensacao,
  buscarTransacoesContaDedicada,
  sincronizarExtratoContaDedicada,
  normalizarLinha,
  LIMITE_MAXIMO_EXTRATO,
  type FiltrosExtrato,
  type LinhaExtrato,
} from "@/services/corpx-conta-dedicada";

const CONTA = CONTA_DEDICADA_CORPX;

function formatarBRL(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function formatarData(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR');
}

/** Badge de status. Status desconhecido aparece cru — inventar rótulo esconderia estado novo. */
function badgeDeStatus(status: string): { classe: string; texto: string } {
  const s = (status || '').toLowerCase();
  if (['paid', 'completed', 'complete', 'concluido', 'concluída', 'settled'].includes(s)) {
    return { classe: 'bg-green-500/15 text-green-500 border-green-500/40', texto: 'Concluída' };
  }
  if (['pending', 'processing', 'pendente'].includes(s)) {
    return { classe: 'bg-amber-500/15 text-amber-500 border-amber-500/40', texto: 'Pendente' };
  }
  if (['refused', 'failed', 'error', 'cancelled', 'canceled'].includes(s)) {
    return { classe: 'bg-red-500/15 text-red-500 border-red-500/40', texto: 'Falhou' };
  }
  return { classe: 'bg-muted text-muted-foreground border-border', texto: status || '—' };
}

/**
 * Extrato da conta CorpX dedicada do Edition, com a função de suporte da TCR.
 *
 * Diferenças deliberadas em relação à /corpx, todas por segurança de dinheiro —
 * ver os comentários no ponto de cada omissão:
 *  - "Sincronizar Extrato" existe, mas com o alvo FIXO na conta desta tela: o
 *    operador escolhe o período, nunca a conta (ver `handleSincronizar`);
 *  - sem crédito ao OTC (a conta saiu do OTC; esta tela é de suporte TCR);
 *  - sem seletor de conta: a conta é fixa e não passa pelo CorpXContext;
 *  - sem WebSocket/MoneyRainEffect: o realtime é escopado na conta selecionada
 *    do contexto global, que não é esta;
 *  - sem os filtros de ocultação da tela consolidada (ver `fetchTransactions`).
 */
export default function ExtractTabCorpXContaDedicada() {
  const contaPronta = contaEstaConfigurada(CONTA);

  const [transactions, setTransactions] = useState<LinhaExtrato[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordsPerPage, setRecordsPerPage] = useState(500);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 500,
    offset: 0,
    has_more: false,
    current_page: 1,
    total_pages: 1,
  });

  // Filtros
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'C' | 'D'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'FAILED'>('ALL');
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [specificAmount, setSpecificAmount] = useState<string>("");
  const [endToEndFilter, setEndToEndFilter] = useState<string>("");

  // Sincronização — só o PERÍODO é escolhido aqui. A conta é fixa e sai da
  // config; não há estado nenhum para documento, de propósito.
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStartDate, setSyncStartDate] = useState<Date | null>(null);
  const [syncEndDate, setSyncEndDate] = useState<Date | null>(null);

  // Compensação (suporte TCR)
  const [compensationModalOpen, setCompensationModalOpen] = useState(false);
  const [selectedCompensationRecord, setSelectedCompensationRecord] = useState<any>(null);
  const [compensatedRecords, setCompensatedRecords] = useState<Set<string>>(new Set());

  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchTransactions = useCallback(
    async (
      customDateFrom?: Date | null,
      customDateTo?: Date | null,
      page = 1,
      applyFilters = false,
    ) => {
      // Conta não preenchida: não consultar. A cerca em `montarRequisicaoExtrato`
      // também lançaria, mas parar aqui dá uma mensagem com ação para o operador.
      if (!contaPronta) {
        setTransactions([]);
        setError('A conta desta tela ainda não foi configurada. Fale com o suporte técnico para liberá-la.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const limit = Math.min(recordsPerPage, LIMITE_MAXIMO_EXTRATO);
        const offset = (page - 1) * limit;

        const inicio = customDateFrom ?? dateFrom;
        const fim = customDateTo ?? dateTo;

        // A conta NÃO entra aqui: quem a injeta é `montarRequisicaoExtrato`, que
        // sobrescreve qualquer accountId e lança se o identificador estiver errado.
        // Passar accountId neste objeto seria inócuo — e enganaria o leitor.
        const filtros: FiltrosExtrato = {
          ...(inicio && { startDate: inicio.toISOString().split('T')[0] }),
          ...(fim && { endDate: fim.toISOString().split('T')[0] }),
          ...(applyFilters && {
            ...(typeFilter !== 'ALL' && { transactionType: typeFilter }),
            ...(endToEndFilter.trim() && { endToEnd: endToEndFilter.trim() }),
            ...(specificAmount && Number.isFinite(parseFloat(specificAmount))
              ? { exactAmount: parseFloat(specificAmount) }
              : {}),
          }),
          limit,
          offset,
          order: 'desc',
        };

        const response = await buscarTransacoesContaDedicada(filtros);

        // NÃO se aplicam aqui os filtros de ocultação da tela consolidada
        // (/corpx esconde tarifas de R$ 0,50 e linhas cuja contraparte é a TCR).
        // Numa tela de conta de cliente, esconder lançamento é esconder o dinheiro
        // dele: o extrato deixaria de fechar com o saldo, e o suporte concluiria
        // errado. Tudo que o backend devolveu para esta conta é exibido.
        const linhas = (response.data || []).map(normalizarLinha);
        setTransactions(linhas);

        const p = response.pagination || {};
        const total = p.total ?? linhas.length;
        const hasMore = p.has_more ?? p.hasMore ?? false;
        setPagination({
          total,
          limit,
          offset,
          has_more: hasMore,
          current_page: p.current_page ?? page,
          total_pages: limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1,
        });

        toast.success(`Página ${p.current_page ?? page}: ${linhas.length} transações`, {
          description: `Extrato de ${rotuloConta(CONTA)}`,
          duration: 1500,
        });
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        // `err.message` já vem redigido pelo serviço (sem internals do backend).
        setError(err?.message || 'Não foi possível carregar o extrato desta conta.');
        setTransactions([]);
        toast.error('Erro ao carregar extrato', { description: err?.message });
      } finally {
        setLoading(false);
      }
    },
    [contaPronta, recordsPerPage, dateFrom, dateTo, typeFilter, endToEndFilter, specificAmount],
  );

  // Filtros de refino no front (os que a rota não cobre).
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    if (typeFilter !== 'ALL') {
      filtered = filtered.filter((tx) => tx.direcao === typeFilter);
    }

    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((tx) => {
        const s = tx.status.toLowerCase();
        if (statusFilter === 'PAID') return ['paid', 'completed', 'complete', 'settled'].includes(s);
        if (statusFilter === 'PENDING') return ['pending', 'processing'].includes(s);
        return ['refused', 'failed', 'error', 'cancelled', 'canceled'].includes(s);
      });
    }

    if (minAmount.trim()) {
      const min = parseFloat(minAmount);
      if (!Number.isNaN(min)) filtered = filtered.filter((tx) => tx.amount >= min);
    }

    if (maxAmount.trim()) {
      const max = parseFloat(maxAmount);
      if (!Number.isNaN(max)) filtered = filtered.filter((tx) => tx.amount <= max);
    }

    if (specificAmount.trim()) {
      const alvo = parseFloat(specificAmount);
      if (!Number.isNaN(alvo) && alvo > 0) {
        filtered = filtered.filter((tx) => Math.abs(tx.amount - alvo) < 0.01);
      }
    }

    if (endToEndFilter.trim()) {
      const e2e = endToEndFilter.toLowerCase().trim();
      filtered = filtered.filter((tx) => tx.endToEndId.toLowerCase().includes(e2e));
    }

    if (searchTerm.trim()) {
      const termo = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(
        (tx) =>
          tx.contraparteNome.toLowerCase().includes(termo) ||
          tx.contraparteDocumento.toLowerCase().includes(termo) ||
          tx.endToEndId.toLowerCase().includes(termo) ||
          tx.transactionId.toLowerCase().includes(termo) ||
          tx.descricao.toLowerCase().includes(termo) ||
          String(tx.amount).includes(termo),
      );
    }

    return filtered;
  }, [transactions, typeFilter, statusFilter, minAmount, maxAmount, specificAmount, endToEndFilter, searchTerm]);

  const metrics = useMemo(() => {
    const entradas = filteredTransactions.filter((tx) => tx.direcao === 'C');
    const saidas = filteredTransactions.filter((tx) => tx.direcao === 'D');
    return {
      totalEntradas: entradas.length,
      totalSaidas: saidas.length,
      valorEntradas: entradas.reduce((s, tx) => s + tx.amount, 0),
      valorSaidas: saidas.reduce((s, tx) => s + tx.amount, 0),
    };
  }, [filteredTransactions]);

  useEffect(() => {
    void fetchTransactions(null, null, 1, false);
    // Carga única na montagem: a conta é fixa, não há seletor que a mude.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAplicarFiltros = () => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      toast.error('Data inicial não pode ser maior que data final', {
        description: 'Verifique as datas selecionadas',
      });
      return;
    }
    if (minAmount && maxAmount) {
      const min = parseFloat(minAmount);
      const max = parseFloat(maxAmount);
      if (!Number.isNaN(min) && !Number.isNaN(max) && min > max) {
        toast.error('Valor mínimo não pode ser maior que valor máximo', {
          description: 'Verifique os valores informados',
        });
        return;
      }
    }
    void fetchTransactions(dateFrom, dateTo, 1, true);
  };

  const handleLimparFiltros = () => {
    setDateFrom(null);
    setDateTo(null);
    setSearchTerm("");
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setMinAmount("");
    setMaxAmount("");
    setSpecificAmount("");
    setEndToEndFilter("");
    void fetchTransactions(null, null, 1, false);
    toast.success('Filtros limpos!', { description: 'Retornando aos últimos registros' });
  };

  const handlePageChange = (novaPagina: number) => {
    if (novaPagina >= 1) void fetchTransactions(dateFrom, dateTo, novaPagina, false);
  };

  const handleRecordsPerPageChange = (value: string) => {
    const limit = parseInt(value, 10);
    if (Number.isNaN(limit)) return;
    setRecordsPerPage(limit);
    setPagination((prev) => ({ ...prev, limit, offset: 0, current_page: 1 }));
    void fetchTransactions(dateFrom, dateTo, 1, false);
  };

  const isRecordCompensated = (tx: LinhaExtrato): boolean =>
    compensatedRecords.has(`corpx-conta-dedicada-${tx.id}`);

  /**
   * "Sincronizar Extrato" — o alvo é FIXO, o operador escolhe só o período.
   *
   * 🔴 O RISCO QUE ESTE BOTÃO CONVIVE COM: `POST /api/corpx/sync`
   * (`corpx.controller.ts:175-176`) é o ÚNICO endpoint do controller sem
   * `RbacGuard`/`@RequireRoles` — só `HybridAuthGuard` — e o escopo do que ele
   * sincroniza vem do CORPO (`CorpXSyncRequestDto.taxDocument`), não do usuário
   * autenticado. Esse furo é do backend, é pré-existente e continua de pé.
   *
   * O QUE ESTÁ TRAVADO DO LADO DE CÁ: a tela não tem como apontar a
   * sincronização para outra conta. Não existe campo, seletor ou filtro de
   * documento; `sincronizarExtratoContaDedicada` não aceita documento na
   * assinatura, e o `taxDocument` sai de `montarRequisicaoSync`, que o lê da
   * config e o passa por uma allowlist fechada. Passar qualquer outro documento
   * LANÇA (ver seções 10-11 do verificador).
   *
   * ⚠️ Isso NÃO conserta o endpoint: quem já tem sessão continua podendo chamar
   * a rota à mão com outro CNPJ. O que o front garante é não ser o gatilho.
   */
  const handleSincronizar = async () => {
    if (!syncStartDate || !syncEndDate) {
      toast.error('Informe o período', {
        description: 'Escolha a data inicial e a data final para sincronizar.',
      });
      return;
    }

    setIsSyncing(true);
    try {
      // Datas em ISO local (YYYY-MM-DD). `toISOString()` converteria para UTC e
      // poderia jogar a data para o dia anterior dependendo do fuso.
      const resposta = await sincronizarExtratoContaDedicada({
        startDate: format(syncStartDate, 'yyyy-MM-dd'),
        endDate: format(syncEndDate, 'yyyy-MM-dd'),
      });

      toast.success('Sincronização iniciada', {
        description:
          typeof resposta?.totalSynced === 'number'
            ? `${resposta.totalSynced} transações sincronizadas.`
            : `Período de ${format(syncStartDate, 'dd/MM/yyyy')} a ${format(syncEndDate, 'dd/MM/yyyy')}.`,
      });

      setIsSyncDialogOpen(false);
      // Recarrega já com a janela sincronizada, para o operador ver o efeito.
      setDateFrom(syncStartDate);
      setDateTo(syncEndDate);
      void fetchTransactions(syncStartDate, syncEndDate, 1, false);
    } catch (erro) {
      // A mensagem já vem traduzida por `traduzirErroDeSync` — sem corpo de
      // resposta, sem status HTTP, sem nome de tabela.
      toast.error('Não foi possível sincronizar', {
        description: erro instanceof Error ? erro.message : 'Tente novamente em alguns instantes.',
        duration: 6000,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * NÃO existe crédito ao OTC nesta tela — nem `CreditExtractToOTCModal` nem
   * `BulkCreditOTCModal`. A conta do Edition foi migrada do OTC para o app; o
   * suporte desta tela é o da TCR. Manter o botão de creditar no OTC deixaria a
   * porta antiga aberta na tela nova.
   */
  const handleCompensation = async (tx: LinhaExtrato, event: React.MouseEvent) => {
    event.stopPropagation();

    if (isRecordCompensated(tx)) {
      toast.error('Registro já compensado');
      return;
    }

    const identificacao = montarIdentificacaoCompensacao({
      id: tx.id,
      transactionId: tx.transactionId,
      endToEndId: tx.endToEndId,
    });

    const extractRecord: any = {
      id: identificacao.id,
      dateTime: tx.createdAt,
      value: tx.amount,
      type: tx.direcao === 'C' ? 'CRÉDITO' : 'DÉBITO',
      client: tx.contraparteNome || 'N/A',
      document: tx.contraparteDocumento || '',
      code: identificacao.code,
      descCliente: `CorpX ${rotuloConta(CONTA)} - ${tx.contraparteNome || 'N/A'}`,
      identified: true,
      descricaoOperacao: `CorpX ${rotuloConta(CONTA)} - ${tx.contraparteNome || 'N/A'}`,
      status: tx.status,
      _original: {
        id: tx.id,
        transactionId: tx.transactionId,
        endToEndId: tx.endToEndId,
      },
    };

    // Busca do id_usuario pelo E2E — mesmo passo do molde
    // (/brasilcash-conta-dedicada). Sem E2E não há o que consultar.
    if (tx.endToEndId) {
      try {
        toast.info('Buscando usuário...', { description: 'Verificando o EndToEnd da transação' });
        const resultado = await TCRVerificacaoService.verificarTransacaoTCR({
          id: tx.transactionId || tx.endToEndId,
          _original: { idEndToEnd: tx.endToEndId, endToEndId: tx.endToEndId },
          code: tx.endToEndId,
        });

        if (resultado.encontrou && resultado.id_usuario) {
          extractRecord.descCliente = `Usuario ${resultado.id_usuario}; ${extractRecord.descCliente}`;
          toast.success(`Usuário encontrado: ID ${resultado.id_usuario}`);
        } else {
          toast.warning('Usuário não encontrado automaticamente', {
            description: 'Informe o ID manualmente no modal',
          });
        }
      } catch {
        toast.error('Não foi possível verificar o usuário automaticamente', {
          description: 'Informe o ID manualmente no modal',
        });
      }
    }

    setSelectedCompensationRecord(extractRecord);
    setCompensationModalOpen(true);
  };

  const handleCloseCompensationModal = (wasSuccessful?: boolean) => {
    if (wasSuccessful && selectedCompensationRecord?._original) {
      const chave = `corpx-conta-dedicada-${selectedCompensationRecord._original.id}`;
      setCompensatedRecords((prev) => new Set(prev).add(chave));
      toast.success('Compensação realizada com sucesso!');
      void fetchTransactions(dateFrom, dateTo, pagination.current_page, false);
    }
    setCompensationModalOpen(false);
    setSelectedCompensationRecord(null);
  };

  const exportToCSV = () => {
    try {
      const headers = [
        'Data/Hora',
        'Tipo',
        'Status',
        'Valor',
        'Contraparte',
        'Documento',
        'End-to-End',
        'Nr. Movimento',
        'Descrição',
      ];
      const rows = filteredTransactions.map((tx) => [
        formatarData(tx.createdAt),
        tx.direcao === 'C' ? 'Entrada' : 'Saída',
        tx.status,
        tx.amount.toFixed(2),
        tx.contraparteNome,
        tx.contraparteDocumento,
        tx.endToEndId,
        tx.transactionId,
        tx.descricao,
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c ?? '')}"`).join(','))].join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `extrato-corpx-conta-dedicada-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);

      toast.success(`${filteredTransactions.length} registros exportados`);
    } catch (err: any) {
      toast.error('Erro ao exportar extrato', {
        description: 'Não foi possível gerar o arquivo CSV.',
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <span className="text-sm text-muted-foreground">{pagination.total} transações</span>

        <div className="flex gap-2">
          <Select value={recordsPerPage.toString()} onValueChange={handleRecordsPerPageChange} disabled={loading}>
            <SelectTrigger className="h-10 w-[180px]">
              <SelectValue placeholder="Registros" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="100">100 registros</SelectItem>
              <SelectItem value="500">500 registros</SelectItem>
              <SelectItem value="1000">1000 registros</SelectItem>
              <SelectItem value="2000">2000 registros</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchTransactions(dateFrom, dateTo, pagination.current_page, false)}
            disabled={loading}
          >
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={filteredTransactions.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>

          {/* Sincronizar Extrato — mesma ergonomia da /corpx: um diálogo que pede
              só o PERÍODO. Não há campo de conta/documento aqui, de propósito:
              ver o comentário em `handleSincronizar`. */}
          <Dialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!contaPronta || loading || isSyncing}>
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4 mr-2" />
                )}
                {isSyncing ? "Sincronizando..." : "Sincronizar Extrato"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Sincronizar extrato da conta {rotuloConta(CONTA)}</DialogTitle>
                <DialogDescription>
                  Informe o período que deseja sincronizar. A operação busca o movimento direto na
                  CorpX e atualiza o extrato desta conta — nenhuma outra é afetada.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-card-foreground">Data inicial</label>
                  <Popover modal>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !syncStartDate && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {syncStartDate ? format(syncStartDate, "PPP", { locale: ptBR }) : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[100]" align="start">
                      <Calendar
                        mode="single"
                        selected={syncStartDate || undefined}
                        onSelect={(date) => date && setSyncStartDate(date)}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-card-foreground">Data final</label>
                  <Popover modal>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !syncEndDate && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {syncEndDate ? format(syncEndDate, "PPP", { locale: ptBR }) : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[100]" align="start">
                      <Calendar
                        mode="single"
                        selected={syncEndDate || undefined}
                        onSelect={(date) => date && setSyncEndDate(date)}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={isSyncing}>
                    Cancelar
                  </Button>
                </DialogClose>
                <Button onClick={() => void handleSincronizar()} disabled={isSyncing || !syncStartDate || !syncEndDate}>
                  {isSyncing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCcw className="h-4 w-4 mr-2" />
                      Confirmar sincronização
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Métricas — da página carregada, não do saldo da conta. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-background border border-[rgba(147,51,234,0.3)]">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Entradas</p>
          <p className="text-2xl font-bold text-[rgb(147,51,234)]">{metrics.totalEntradas}</p>
        </Card>
        <Card className="p-4 bg-background border border-[rgba(147,51,234,0.3)]">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saídas</p>
          <p className="text-2xl font-bold text-[rgb(147,51,234)]">{metrics.totalSaidas}</p>
        </Card>
        <Card className="p-4 bg-background border border-[rgba(147,51,234,0.3)]">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor em Entradas</p>
          <p className="text-2xl font-bold text-green-500">{formatarBRL(metrics.valorEntradas)}</p>
        </Card>
        <Card className="p-4 bg-background border border-[rgba(147,51,234,0.3)]">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor em Saídas</p>
          <p className="text-2xl font-bold text-red-500">{formatarBRL(metrics.valorSaidas)}</p>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-4 lg:p-6 bg-background border border-[rgba(255,255,255,0.1)]">
        <div className="space-y-3 lg:space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, CPF/CNPJ, ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 bg-background border-2 focus:border-[rgba(147,51,234,0.6)]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo</label>
              <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
                <SelectTrigger className="h-10 bg-background border-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="C">Entrada (crédito)</SelectItem>
                  <SelectItem value="D">Saída (débito)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</label>
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="h-10 bg-background border-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="PAID">Concluída</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="FAILED">Falhou</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">End-to-End</label>
              <Input
                placeholder="E..."
                value={endToEndFilter}
                onChange={(e) => setEndToEndFilter(e.target.value)}
                className="h-10 bg-background border-2 focus:border-[rgba(147,51,234,0.6)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data inicial</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-10 w-full justify-start text-left font-normal bg-background border-2",
                      !dateFrom && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 shadow-2xl" align="start">
                  <Calendar mode="single" selected={dateFrom ?? undefined} onSelect={(d) => d && setDateFrom(d)} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data final</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-10 w-full justify-start text-left font-normal bg-background border-2",
                      !dateTo && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 shadow-2xl" align="start">
                  <Calendar mode="single" selected={dateTo ?? undefined} onSelect={(d) => d && setDateTo(d)} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor exato</label>
              <Input
                type="number"
                placeholder="0.00"
                value={specificAmount}
                onChange={(e) => setSpecificAmount(e.target.value)}
                className="h-10 bg-background border-2"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor mínimo</label>
              <Input
                type="number"
                placeholder="0.00"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="h-10 bg-background border-2"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor máximo</label>
              <Input
                type="number"
                placeholder="0.00"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="h-10 bg-background border-2"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando...
              </div>
            )}
            <div className="flex gap-2 items-center flex-wrap ml-auto">
              <Button
                onClick={handleAplicarFiltros}
                className="h-10 bg-purple-600 hover:bg-purple-700 text-white rounded-md px-3 lg:px-4"
                disabled={loading}
              >
                <Filter className="h-4 w-4 mr-2" />
                Aplicar Filtros
              </Button>
              <Button
                variant="outline"
                onClick={handleLimparFiltros}
                className="h-10 border border-purple-500 hover:bg-purple-500 hover:text-white rounded-md px-3 lg:px-4"
                disabled={loading}
              >
                <X className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabela */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-red-500 mb-2 font-medium">Não foi possível carregar o extrato</p>
            {/* A mensagem real vai para a tela: um "erro genérico" esconderia
                justamente os casos com ação própria (conta não configurada,
                identificador errado, sessão expirada). */}
            <p className="text-muted-foreground text-sm mb-4">{error}</p>
            {contaPronta && (
              <Button onClick={() => void fetchTransactions(dateFrom, dateTo, pagination.current_page, false)} variant="outline">
                Tentar Novamente
              </Button>
            )}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchTerm ? 'Nenhuma transação encontrada com esse filtro' : 'Nenhuma transação encontrada para esta conta'}
            </p>
            {/* Lista vazia é ambígua: pode ser conta sem movimento OU extrato
                gravado com outro identificador. Numa tela de dinheiro, mostrar
                "vazio" e calar seria mentir por omissão. */}
            {!searchTerm && (
              <p className="text-xs text-muted-foreground/80 mt-3 max-w-md mx-auto">
                Se esta conta já movimentou, o extrato pode não estar sendo gravado com o
                identificador configurado aqui ({CONTA.idExtrato}). Avise o suporte técnico antes
                de concluir que não houve movimento.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto max-h-[1000px] overflow-y-auto relative">
              <table className="w-full">
                <thead className="bg-muted/50 border-b sticky top-0 z-10">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Data/Hora</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Contraparte</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Valor</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">End-to-End</th>
                    <th className="w-32 p-3 text-xs font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx, index) => (
                    <>
                      <tr
                        key={tx.id}
                        className={cn(
                          "border-b hover:bg-muted/30 transition-colors cursor-pointer",
                          index % 2 === 0 ? "bg-[#181818]" : "bg-[#1E1E1E]",
                          expandedRow === tx.id && "bg-muted/10",
                        )}
                        onClick={() => setExpandedRow(expandedRow === tx.id ? null : tx.id)}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {expandedRow === tx.id ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                            <div>
                              <div className="text-sm">{formatarData(tx.createdAt)}</div>
                              {/* MARCA, não filtra: a linha continua visível e com o
                                  botão Compensar ao lado. Esconder seria decisão de
                                  produto. Hoje `vinculadoEm` está vazio, então esta
                                  marca não aparece em nenhuma linha. */}
                              {ehAnteriorAoVinculo(tx.createdAt, CONTA.vinculadoEm) && (
                                <Badge
                                  variant="outline"
                                  className="mt-1 text-[10px] border-amber-500/60 text-amber-600 dark:text-amber-500"
                                  title={`Anterior ao vínculo da conta com o cliente (${CONTA.vinculadoEm}). Confirme antes de compensar.`}
                                >
                                  anterior ao vínculo
                                </Badge>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {tx.direcao === 'C' ? (
                              <ArrowDownCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <ArrowUpCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="text-sm">{tx.direcao === 'C' ? 'Entrada' : 'Saída'}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="text-sm font-medium">{tx.contraparteNome || 'N/A'}</div>
                          {tx.contraparteDocumento && (
                            <div className="text-xs font-mono text-muted-foreground">{tx.contraparteDocumento}</div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className={cn("text-sm font-bold", tx.direcao === 'C' ? "text-green-600" : "text-red-600")}>
                            {tx.direcao === 'C' ? '+' : '-'} {formatarBRL(tx.amount)}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={cn("text-xs", badgeDeStatus(tx.status).classe)}>
                            {badgeDeStatus(tx.status).texto}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="text-xs font-mono text-muted-foreground">
                            {tx.endToEndId ? `${tx.endToEndId.substring(0, 20)}...` : '-'}
                          </div>
                        </td>
                        <td className="p-3">
                          {/* Compensar só nas ENTRADAS: compensação credita o
                              cliente no ledger da TCR a partir de um depósito. */}
                          {tx.direcao === 'C' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => void handleCompensation(tx, e)}
                              disabled={isRecordCompensated(tx)}
                              className={cn(
                                "h-7 px-2 text-xs transition-all",
                                isRecordCompensated(tx)
                                  ? "bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed"
                                  : "bg-[rgba(147,51,234,0.1)] hover:bg-[rgba(147,51,234,0.2)] text-purple-400 border-[rgba(147,51,234,0.4)]",
                              )}
                              title={isRecordCompensated(tx) ? "Já compensado" : "Realizar compensação"}
                            >
                              {isRecordCompensated(tx) ? (
                                <>
                                  <Check className="h-3 w-3 mr-1" />
                                  Compensado
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Compensar
                                </>
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>

                      {expandedRow === tx.id && (
                        <tr className="bg-muted/5 border-b border-border/50">
                          <td colSpan={7} className="p-0">
                            <div className="p-6 space-y-4">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-semibold text-purple-400">Detalhes da Transação</h4>
                                <Badge variant="outline" className="text-xs">ID: {tx.id}</Badge>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="space-y-3">
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">End-to-End ID</label>
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className="text-sm font-mono break-all">{tx.endToEndId || '-'}</p>
                                      {tx.endToEndId && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void navigator.clipboard.writeText(tx.endToEndId);
                                            toast.success('End-to-End ID copiado!');
                                          }}
                                          className="h-6 w-6 p-0 flex-shrink-0"
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Nr. Movimento</label>
                                    <p className="text-sm font-mono mt-1">{tx.transactionId || '-'}</p>
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Origem</label>
                                    <p className="text-sm mt-1">{tx.source || '-'}</p>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <h4 className="text-xs font-semibold text-purple-400 uppercase mb-2">
                                    {tx.direcao === 'C' ? 'Pagador' : 'Beneficiário'}
                                  </h4>
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Nome</label>
                                    <p className="text-sm mt-1">{tx.contraparteNome || '-'}</p>
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">CPF/CNPJ</label>
                                    <p className="text-sm mt-1 font-mono">{tx.contraparteDocumento || '-'}</p>
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Tipo de PIX</label>
                                    <p className="text-sm mt-1">{tx.pixType || '-'}</p>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <h4 className="text-xs font-semibold text-purple-400 uppercase mb-2">Transação</h4>
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Valor</label>
                                    <p className="text-sm mt-1 font-bold">{formatarBRL(tx.amount)}</p>
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Status</label>
                                    <p className="text-sm mt-1">{tx.status || '-'}</p>
                                  </div>
                                  {tx.descricao && (
                                    <div>
                                      <label className="text-xs font-medium text-muted-foreground uppercase">Descrição</label>
                                      <p className="text-sm mt-1 break-words">{tx.descricao}</p>
                                    </div>
                                  )}
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Conta (id do extrato)</label>
                                    <p className="text-sm mt-1 font-mono">{String(tx.original.corpx_account_id ?? '-')}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            <div className="flex items-center justify-between p-4 border-t bg-muted/20">
              <div className="text-sm text-muted-foreground">
                Mostrando {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} de{' '}
                {pagination.total}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.current_page - 1)}
                  disabled={pagination.current_page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm px-2">
                  {pagination.current_page} / {pagination.total_pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.current_page + 1)}
                  disabled={!pagination.has_more}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Modal de Compensação — suporte da TCR.
          `allowPixActions` reusa a MESMA função que montou o registro: duas
          expressões separadas para a mesma regra é como elas divergem com o tempo. */}
      <CompensationModalInteligente
        isOpen={compensationModalOpen}
        onClose={handleCloseCompensationModal}
        extractRecord={selectedCompensationRecord}
        provider="corpx_v2"
        rotuloConta="EDITION"
        allowPixActions={
          selectedCompensationRecord?._original
            ? montarIdentificacaoCompensacao(selectedCompensationRecord._original).permitirAcoesPix
            : false
        }
      />
    </div>
  );
}
