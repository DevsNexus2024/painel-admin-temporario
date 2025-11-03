import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Search, RefreshCcw, Download, Loader2, Calendar as CalendarIcon, X, Copy } from "lucide-react";
import { ledgerApi } from "@/services/ledger-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange as DateRangeType } from "react-day-picker";

interface ExtratoContaTabProps {
  accountId: number | string;
  tenantId: number | string;
  accountName: string;
}

export default function ExtratoContaTab({ accountId, tenantId, accountName }: ExtratoContaTabProps) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    provider: "ALL",
    journalType: "ALL",
    search: "",
  });
  const [dateRange, setDateRange] = useState<DateRangeType | undefined>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    total: 0,
    hasMore: false,
  });

  useEffect(() => {
    fetchTransactions();
  }, [accountId, tenantId, filters, dateRange, pagination.offset]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const accountIdNum = typeof accountId === 'string' ? parseInt(accountId) : accountId;
      const tenantIdNum = typeof tenantId === 'string' ? parseInt(tenantId) : tenantId;
      const startDate = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined;
      const endDate = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined;

      const response = await ledgerApi.listTransactions(tenantIdNum, {
        provider: filters.provider !== "ALL" ? filters.provider : undefined,
        journalType: filters.journalType !== "ALL" ? filters.journalType : undefined,
        accountId: accountIdNum,
        search: filters.search || undefined,
        startDate,
        endDate,
        limit: pagination.limit,
        offset: pagination.offset,
        includePostings: true,
      });

      setTransactions(response.data || []);
      setPagination({
        ...pagination,
        total: response.pagination?.total || 0,
        hasMore: response.pagination?.hasMore || false,
      });
    } catch (error: any) {
      // Erro já tratado pelo ledgerApi
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
    } catch {
      return dateString;
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

  /**
   * Extrai o valor da transação baseado no tipo e metadata
   */
  const getTransactionAmount = (tx: any): string => {
    if (!tx.metadata) return "0";
    
    if (tx.journalType === "DEPOSIT") {
      return tx.metadata.net_amount || tx.metadata.gross_amount || "0";
    } else if (tx.journalType === "WITHDRAWAL") {
      return tx.metadata.amount || tx.metadata.total_amount || "0";
    }
    
    return tx.metadata.amount || tx.metadata.net_amount || tx.metadata.gross_amount || tx.metadata.total_amount || "0";
  };

  const exportToCSV = () => {
    if (transactions.length === 0) {
      toast.error("Nenhuma transação para exportar");
      return;
    }

    const headers = ["ID", "Tipo", "Descrição", "Valor", "Data", "Status", "End-to-End ID"];
    const rows = transactions.map((tx) => [
      tx.id,
      tx.journalType,
      tx.description,
      getTransactionAmount(tx),
      tx.createdAt,
      tx.metadata?.withdrawal_status || tx.metadata?.status || "N/A",
      tx.endToEndId || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `extrato-${accountName}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("Extrato exportado com sucesso");
  };

  const handleClearFilters = () => {
    setFilters({
      provider: "ALL",
      journalType: "ALL",
      search: "",
    });
    setDateRange({
      from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      to: new Date(),
    });
    setPagination({ ...pagination, offset: 0 });
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="p-4 lg:p-6 bg-background border border-[rgba(255,255,255,0.1)]">
        <div className="space-y-3 lg:space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="End-to-End ID, External ID..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-10 h-10 bg-background border-2 focus:border-[rgba(0,105,209,0.6)]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Tipo
              </label>
              <Select
                value={filters.journalType}
                onValueChange={(value) => setFilters({ ...filters, journalType: value })}
              >
                <SelectTrigger className="h-10 bg-background border-2 focus:border-[rgba(0,105,209,0.6)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="DEPOSIT">Depósito</SelectItem>
                  <SelectItem value="WITHDRAWAL">Saque</SelectItem>
                  <SelectItem value="TRANSFER">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Provider
              </label>
              <Select
                value={filters.provider}
                onValueChange={(value) => setFilters({ ...filters, provider: value })}
              >
                <SelectTrigger className="h-10 bg-background border-2 focus:border-[rgba(0,105,209,0.6)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="BITSO">Bitso</SelectItem>
                  <SelectItem value="CORPX">CorpX</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Data Inicial
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-10 justify-start text-left font-normal bg-background border-2",
                      !dateRange?.from && "text-muted-foreground",
                      dateRange?.from && "border-[rgba(0,105,209,0.6)]"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                    ) : (
                      <span>Selecione a data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Data Final
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-10 justify-start text-left font-normal bg-background border-2",
                      !dateRange?.to && "text-muted-foreground",
                      dateRange?.to && "border-[rgba(0,105,209,0.6)]"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.to ? (
                      format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })
                    ) : (
                      <span>Selecione a data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={fetchTransactions}
              disabled={loading}
              className="h-10"
            >
              <RefreshCcw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Atualizar
            </Button>
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={transactions.length === 0}
              className="h-10"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
            <Button
              variant="outline"
              onClick={handleClearFilters}
              disabled={loading}
              className="h-10 bg-black border border-[#0069d1] text-white hover:bg-[#0069d1] hover:text-white transition-all duration-200 rounded-md px-3 lg:px-4"
            >
              <X className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabela de Transações */}
      <Card className="bg-background border border-[rgba(255,255,255,0.1)]">
        {loading && transactions.length === 0 ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#0069d1]" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-muted-foreground">Nenhuma transação encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b sticky top-0 z-10">
                <tr>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                    ID
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                    Tipo
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                    Descrição
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                    Valor
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                    Data
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                    End-to-End ID
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                    Provider
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, index) => (
                  <>
                    <tr
                      key={tx.id}
                      className={cn(
                        "border-b hover:bg-muted/30 transition-colors cursor-pointer",
                        index % 2 === 0 ? "bg-[#181818]" : "bg-[#1E1E1E]",
                        expandedRow === tx.id && "bg-muted/10"
                      )}
                      onClick={() => setExpandedRow(expandedRow === tx.id ? null : tx.id)}
                    >
                      <td className="p-3">
                        <span className="text-sm font-mono">{tx.id}</span>
                      </td>
                      <td className="p-3">
                        <Badge className="text-xs bg-[rgba(0,105,209,0.2)] text-[#0069d1] border-[rgba(0,105,209,0.4)]">
                          {tx.journalType}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <span className="text-sm">{tx.description || "N/A"}</span>
                      </td>
                      <td className="p-3">
                        <span className={cn(
                          "text-sm font-bold",
                          tx.journalType === "DEPOSIT" ? "text-green-500" : 
                          tx.journalType === "WITHDRAWAL" ? "text-red-500" : 
                          "text-foreground"
                        )}>
                          {tx.journalType === "DEPOSIT" ? "+" : tx.journalType === "WITHDRAWAL" ? "-" : ""}
                          {formatCurrency(getTransactionAmount(tx))}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-sm text-muted-foreground">
                          {formatDate(tx.createdAt)}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">
                            {tx.endToEndId ? `${tx.endToEndId.substring(0, 20)}...` : "-"}
                          </span>
                          {tx.endToEndId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(tx.endToEndId);
                                toast.success("Copiado!");
                              }}
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="text-sm">{tx.provider || "N/A"}</span>
                      </td>
                    </tr>
                    {expandedRow === tx.id && tx.postings && (
                      <tr className="bg-muted/5 border-b">
                        <td colSpan={7} className="p-6">
                          <div className="space-y-4">
                            <h4 className="text-sm font-semibold text-[#0069d1]">
                              Detalhes da Transação
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Journal ID</p>
                                <p className="text-sm font-mono">{tx.id}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">End-to-End ID</p>
                                <p className="text-sm font-mono">{tx.endToEndId || "N/A"}</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-2">Postings (Débitos e Créditos)</p>
                              <div className="space-y-2">
                                {tx.postings.map((posting: any) => (
                                  <div
                                    key={posting.id}
                                    className="p-3 rounded bg-muted/30 flex items-center justify-between"
                                  >
                                    <div>
                                      <span className={cn(
                                        "text-sm font-semibold",
                                        posting.side === "PAY_OUT" ? "text-red-500" : "text-green-500"
                                      )}>
                                        {posting.side === "PAY_OUT" ? "↓ PAY_OUT" : "↑ PAY_IN"}
                                      </span>
                                      <p className="text-xs text-muted-foreground">
                                        Account {posting.accountId} ({posting.account?.accountType || "N/A"})
                                      </p>
                                    </div>
                                    <span className="text-sm font-bold">
                                      {formatCurrency(posting.amount)} {posting.currency}
                                    </span>
                                  </div>
                                ))}
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
        )}

        {/* Paginação */}
        {pagination.total > 0 && (
          <div className="flex items-center justify-between p-4 border-t bg-muted/20">
            <div className="text-sm text-muted-foreground">
              Mostrando {pagination.offset + 1} -{" "}
              {Math.min(pagination.offset + pagination.limit, pagination.total)} de{" "}
              {pagination.total}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination({ ...pagination, offset: Math.max(0, pagination.offset - pagination.limit) })}
                disabled={pagination.offset === 0 || loading}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination({ ...pagination, offset: pagination.offset + pagination.limit })}
                disabled={!pagination.hasMore || loading}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

