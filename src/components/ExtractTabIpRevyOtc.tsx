import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Check,
  Copy,
  Download,
  FileText,
  Filter,
  Loader2,
  RefreshCcw,
  SendHorizontal,
  Search,
  Server,
  TrendingUp,
  X,
  Building2,
  DollarSign,
  CheckCircle2,
  Lock,
  Key,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchRevyTransactions,
  sendRevyPixPayment,
  LedgerTransaction,
} from "@/services/revy";
import { useRevyRealtime } from "@/hooks/useRevyRealtime";

type IpRevyTransaction = {
  id: string;
  createdAt: string;
  type: "FUNDING" | "WITHDRAWAL";
  status: TransactionStatusFilter;
  amount: number;
  currency: string;
  payerName: string;
  payerTaxId: string;
  payerBankName: string;
  payeeName: string;
  payeeDocument?: string;
  payeeBankName?: string;
  bankName: string;
  endToEndId: string;
  transactionId: string;
  reconciliationId: string;
  description: string;
};

type TransactionTypeFilter = "ALL" | "FUNDING" | "WITHDRAWAL";
type TransactionStatusFilter =
  | "ALL"
  | "PENDING"
  | "COMPLETE"
  | "FAILED"
  | "CANCELLED";

type DateRange = {
  from: Date | undefined;
  to: Date | undefined;
};

const REVY_TENANT_ID = 3;
const REVY_OPERATIONAL_ACCOUNT_ID = 33;
const REVY_ACCOUNT_UUID = "130e63e7-c9b7-451d-827e-7b04ef5914f8";

const formatCurrency = (value: number, currency = "BRL") => {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  } catch (error) {
    return `${currency} ${value.toFixed(2)}`;
  }
};

const formatDateTime = (dateString: string) => {
  try {
    return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch (error) {
    return dateString;
  }
};

const formatDocument = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return value;
};

const statusConfig: Record<Exclude<TransactionStatusFilter, "ALL">, { label: string; className: string }> = {
  COMPLETE: {
    label: "Liquidado",
    className: "bg-green-500/15 text-green-600 border-green-500/20",
  },
  PENDING: {
    label: "Pendente",
    className: "bg-amber-500/15 text-amber-600 border-amber-500/20",
  },
  FAILED: {
    label: "Falhou",
    className: "bg-red-500/15 text-red-600 border-red-500/20",
  },
  CANCELLED: {
    label: "Cancelado",
    className: "bg-muted text-muted-foreground",
  },
};

const DEFAULT_DATE_RANGE: DateRange = {
  from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  to: new Date(),
};

type QueryOverrides = {
  searchTerm?: string;
  typeFilter?: TransactionTypeFilter;
  dateRange?: DateRange;
  recordsPerPage?: number;
};

const formatDateParam = (value?: Date) => {
  if (!value) return undefined;
  return value.toISOString().split("T")[0];
};

const normalizeStatus = (raw?: string | null): TransactionStatusFilter => {
  if (!raw) return "COMPLETE";
  const normalized = raw.toUpperCase();
  if (normalized.includes("PEND")) return "PENDING";
  if (normalized.includes("FAIL") || normalized.includes("ERROR")) return "FAILED";
  if (normalized.includes("CANCEL")) return "CANCELLED";
  return "COMPLETE";
};

const parseAmount = (transaction: LedgerTransaction): number => {
  const metadata = transaction.metadata || {};
  if (metadata.amount) {
    const amount = parseFloat(metadata.amount);
    if (!Number.isNaN(amount)) return amount;
  }
  if (typeof metadata.amountCentavos === "number") {
    return metadata.amountCentavos / 100;
  }
  const posting = transaction.postings?.[0];
  if (posting) {
    const amount = parseFloat(posting.amount);
    if (!Number.isNaN(amount)) return amount;
  }
  return 0;
};

const extractOperationalBalance = (transactions: LedgerTransaction[]): number | null => {
  for (const tx of transactions) {
    const posting = tx.postings?.find((p) => p.account?.accountType === "OPERATIONAL");
    if (posting?.account?.balance) {
      const value = parseFloat(posting.account.balance);
      if (!Number.isNaN(value)) {
        return Math.abs(value);
      }
    }
  }
  return null;
};

const mapLedgerTransactionToIpRevy = (transaction: LedgerTransaction): IpRevyTransaction => {
  const metadata = transaction.metadata || {};
  const cashInOrOut = (metadata.cashInOrOut || "").toUpperCase();
  const type =
    cashInOrOut === "CASH IN"
      ? "FUNDING"
      : cashInOrOut === "CASH OUT"
        ? "WITHDRAWAL"
        : transaction.type === "DEPOSIT"
          ? "FUNDING"
          : "WITHDRAWAL";

  const payerInfo = metadata.payer || {};
  const beneficiaryInfo = metadata.beneficiary || {};

  const resolveBankName = (info?: Record<string, any>) => {
    if (!info) {
      return metadata.bankName || metadata.movementType || "Pix Revy";
    }
    if (info.bankCode) {
      return `Banco ${info.bankCode}`;
    }
    if (info.bank) {
      return `Banco ${info.bank}`;
    }
    return metadata.bankName || metadata.movementType || "Pix Revy";
  };

  const payerName =
    type === "FUNDING"
      ? payerInfo.name || metadata.payerName || metadata.counterpartyName || "Pagador não identificado"
      : "IP Revy <> OTC";
  const payerTaxId =
    type === "FUNDING"
      ? payerInfo.document || metadata.payerDocument || metadata.payerTaxId || ""
      : "53781325000115";

  const payeeName =
    type === "FUNDING"
      ? beneficiaryInfo.name || metadata.beneficiaryName || "IP Revy <> OTC"
      : beneficiaryInfo.name || metadata.beneficiaryName || metadata.counterpartyName || "Destinatário não identificado";
  const payeeDocument =
    type === "FUNDING"
      ? beneficiaryInfo.document || metadata.beneficiaryDocument || ""
      : beneficiaryInfo.document || metadata.beneficiaryDocument || "";

  const payerBankName =
    type === "FUNDING" ? resolveBankName(payerInfo) : "Banco 633 • Revy";
  const payeeBankName =
    type === "FUNDING"
      ? resolveBankName(beneficiaryInfo)
      : resolveBankName(beneficiaryInfo);
  const bankName = payerBankName;

  const endToEndId =
    transaction.endToEndId ||
    metadata.endToEnd ||
    metadata.reference ||
    metadata.internalReference ||
    "";

  const transactionId = transaction.providerTxId || transaction.externalId || transaction.id;
  const reconciliationId = metadata.movementId || transaction.externalId || transaction.id;

  return {
    id: transaction.id,
    createdAt: transaction.createdAt,
    type,
    status: normalizeStatus(metadata.status || metadata.pixStatus || metadata.revyStatus),
    amount: parseAmount(transaction),
    currency: transaction.functionalCurrency || "BRL",
    payerName,
    payerTaxId,
    payerBankName,
    payeeName,
    payeeDocument,
    payeeBankName,
    bankName,
    endToEndId,
    transactionId,
    reconciliationId,
    description: transaction.description || metadata.description || "",
  };
};

export default function ExtractTabIpRevyOtc() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<TransactionStatusFilter>("ALL");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [specificAmount, setSpecificAmount] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);
  const [recordsPerPage, setRecordsPerPage] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<IpRevyTransaction | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [syncRange, setSyncRange] = useState<DateRange>(DEFAULT_DATE_RANGE);
  const [transactions, setTransactions] = useState<IpRevyTransaction[]>([]);
  const [totalRemoteRecords, setTotalRemoteRecords] = useState(0);
  const [balance, setBalance] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [pixForm, setPixForm] = useState({
    key: "",
    amount: "",
    pin: "",
  });
  const [isSendingPix, setIsSendingPix] = useState(false);

  const getEffectiveQuery = useCallback(
    (overrides?: QueryOverrides) => ({
      searchTerm: overrides?.searchTerm ?? searchTerm,
      typeFilter: overrides?.typeFilter ?? typeFilter,
      dateRange: overrides?.dateRange ?? dateRange,
      recordsPerPage: overrides?.recordsPerPage ?? recordsPerPage,
    }),
    [dateRange, recordsPerPage, searchTerm, typeFilter]
  );

  const loadTransactions = useCallback(
    async (page = 1, overrides?: QueryOverrides) => {
      const effective = getEffectiveQuery(overrides);
      const effectiveSearch = effective.searchTerm;
      const effectiveType = effective.typeFilter;
      const effectiveDateRange = effective.dateRange;
      const effectiveLimit = effective.recordsPerPage;

      const limit = effectiveLimit;
      const offset = (page - 1) * limit;
      const startDate = formatDateParam(effectiveDateRange.from);
      const endDate = formatDateParam(effectiveDateRange.to);
      const search = effectiveSearch.trim();
      const journalType =
        effectiveType === "ALL"
          ? undefined
          : effectiveType === "FUNDING"
            ? "DEPOSIT"
            : "WITHDRAWAL";

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchRevyTransactions({
          tenantId: REVY_TENANT_ID,
          accountId: REVY_OPERATIONAL_ACCOUNT_ID,
          startDate,
          endDate,
          limit,
          offset,
          journalType,
          search: search || undefined,
          includePostings: true,
        });

        const normalized = response.data.map(mapLedgerTransactionToIpRevy);
        setTransactions(normalized);
        const totalFromApi = response.pagination?.total ?? response.total ?? normalized.length;
        setTotalRemoteRecords(totalFromApi);
        const balanceFromData = extractOperationalBalance(response.data);
        if (balanceFromData !== null) {
          setBalance(balanceFromData);
        }
        setCurrentPage(page);
        return normalized.length;
      } catch (err: any) {
        const message = err?.message || "Erro ao carregar extrato da Revy";
        setError(message);
        setTransactions([]);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [getEffectiveQuery]
  );

  useEffect(() => {
    loadTransactions(1).catch(() => {
      /* erros já tratados no próprio carregamento */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formattedBalance = useMemo(() => {
    if (balance === null) return "—";
    return formatCurrency(Math.abs(balance));
  }, [balance]);

  const summaryCards = useMemo(
    () => [
      {
        label: "Saldo principal",
        value: formattedBalance,
        description: "Saldo total",
        icon: DollarSign,
        iconClass: "bg-emerald-500/10 text-emerald-600",
      },
      {
        label: "Saldo disponível",
        value: formattedBalance,
        description: "Para transferências",
        icon: CheckCircle2,
        iconClass: "bg-blue-500/10 text-blue-600",
      },
      {
        label: "Limite bloqueado",
        value: formatCurrency(0),
        description: "Reservado",
        icon: Lock,
        iconClass: "bg-amber-500/10 text-amber-600",
      },
    ],
    [formattedBalance]
  );

  const loadTransactionsRef = useRef(loadTransactions);
  useEffect(() => {
    loadTransactionsRef.current = loadTransactions;
  }, [loadTransactions]);

  const {
    isConnected: isRealtimeConnected,
    isReconnecting: isRealtimeReconnecting,
    lastError: realtimeError,
  } = useRevyRealtime({
    tenantId: REVY_TENANT_ID,
    onTransaction: (payload) => {
      toast.success(
        payload.data.cashInOrOut === "CASH IN" ? "Novo crédito Revy" : "Novo débito Revy",
        {
          description: `${payload.data.description || payload.data.movementType} • R$ ${payload.data.amount}`,
        }
      );
      loadTransactionsRef.current?.(1);
    },
  });

  const filteredTransactions = useMemo(() => {
    const trimmedSearch = searchTerm.trim().toLowerCase();
    const min = parseFloat(minAmount.replace(/,/g, "."));
    const max = parseFloat(maxAmount.replace(/,/g, "."));
    const specific = parseFloat(specificAmount.replace(/,/g, "."));

    return transactions.filter((transaction) => {
      const createdAt = new Date(transaction.createdAt);
      const withinDateRange = (() => {
        if (!dateRange.from || !dateRange.to) return true;
        const start = new Date(dateRange.from);
        const end = new Date(dateRange.to);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return createdAt >= start && createdAt <= end;
      })();

      const matchesType =
        typeFilter === "ALL" ? true : transaction.type === typeFilter;

      const matchesStatus =
        statusFilter === "ALL" ? true : transaction.status === statusFilter;

      const matchesSearch =
        trimmedSearch.length === 0
          ? true
          : [
              transaction.payerName,
              transaction.payeeName,
              transaction.payerTaxId,
              transaction.transactionId,
              transaction.endToEndId,
              transaction.reconciliationId,
              transaction.description,
              transaction.bankName,
            ]
              .filter(Boolean)
              .some((field) => field!.toLowerCase().includes(trimmedSearch));

      const matchesAmount = (() => {
        const amount = transaction.amount;

        if (!Number.isNaN(specific)) {
          return Number(amount.toFixed(2)) === Number(specific.toFixed(2));
        }

        if (!Number.isNaN(min) && amount < min) {
          return false;
        }

        if (!Number.isNaN(max) && amount > max) {
          return false;
        }

        return true;
      })();

      return withinDateRange && matchesType && matchesStatus && matchesSearch && matchesAmount;
    });
  }, [dateRange.from, dateRange.to, maxAmount, minAmount, searchTerm, specificAmount, statusFilter, transactions, typeFilter]);

  const totals = useMemo(() => {
    const deposits = filteredTransactions.filter((tx) => tx.type === "FUNDING");
    const withdrawals = filteredTransactions.filter((tx) => tx.type === "WITHDRAWAL");

    const depositAmount = deposits.reduce((sum, tx) => sum + tx.amount, 0);
    const withdrawalAmount = withdrawals.reduce((sum, tx) => sum + tx.amount, 0);

    return {
      deposits: deposits.length,
      withdrawals: withdrawals.length,
      depositAmount,
      withdrawalAmount,
      net: depositAmount - withdrawalAmount,
    };
  }, [filteredTransactions]);

  const totalPages = Math.max(1, Math.ceil(Math.max(totalRemoteRecords, 1) / recordsPerPage));
  const showingFrom =
    filteredTransactions.length === 0 ? 0 : (currentPage - 1) * recordsPerPage + 1;
  const showingTo =
    filteredTransactions.length === 0
      ? 0
      : (currentPage - 1) * recordsPerPage + filteredTransactions.length;
  const totalRecordsDisplay = totalRemoteRecords || filteredTransactions.length;

  const fetchAllTransactionsForExport = useCallback(async () => {
    const effective = getEffectiveQuery();
    const limit = 1000;
    let offset = 0;
    const aggregated: IpRevyTransaction[] = [];
    let total = Infinity;

    const startDate = formatDateParam(effective.dateRange.from);
    const endDate = formatDateParam(effective.dateRange.to);
    const search = effective.searchTerm.trim();
    const journalType =
      effective.typeFilter === "ALL"
        ? undefined
        : effective.typeFilter === "FUNDING"
          ? "DEPOSIT"
          : "WITHDRAWAL";

    while (offset < total) {
      const response = await fetchRevyTransactions({
        tenantId: REVY_TENANT_ID,
        accountId: REVY_OPERATIONAL_ACCOUNT_ID,
        startDate,
        endDate,
        limit,
        offset,
        journalType,
        search: search || undefined,
        includePostings: true,
      });

      aggregated.push(...response.data.map(mapLedgerTransactionToIpRevy));
      total = response.total ?? aggregated.length;
      if (response.data.length < limit) {
        break;
      }
      offset += limit;
    }

    return aggregated;
  }, [getEffectiveQuery]);

  const paginatedTransactions = filteredTransactions;

  const handleRowClick = (transaction: IpRevyTransaction) => {
    setSelectedTransaction(transaction);
    setIsDetailDialogOpen(true);
  };

  const handleCopy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado`, {
      description: value,
      duration: 1500,
    });
  };

  const handleApplyFilters = async () => {
    try {
      const count = await loadTransactions(1);
      toast.success("Filtros aplicados", {
        description: `${count} registros encontrados`,
      });
    } catch (err: any) {
      toast.error("Erro ao aplicar filtros", {
        description: err?.message || "Tente novamente em instantes",
      });
    }
  };

  const handleResetFilters = async () => {
    setSearchTerm("");
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setMinAmount("");
    setMaxAmount("");
    setSpecificAmount("");
    setDateRange(DEFAULT_DATE_RANGE);
    setRecordsPerPage(100);
    setCurrentPage(1);
    try {
      await loadTransactions(1, {
        searchTerm: "",
        typeFilter: "ALL",
        dateRange: DEFAULT_DATE_RANGE,
        recordsPerPage: 100,
      });
      toast.info("Filtros limpos", {
        description: "Exibindo as últimas transações disponíveis",
      });
    } catch (err: any) {
      toast.error("Erro ao recarregar após limpar filtros", {
        description: err?.message || "Tente novamente em instantes",
      });
    }
  };

  const handlePageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || isLoading) {
      return;
    }

    try {
      await loadTransactions(newPage);
    } catch (err: any) {
      toast.error("Não foi possível mudar de página", {
        description: err?.message || "Tente novamente em instantes",
      });
    }
  };

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const allTransactions = await fetchAllTransactionsForExport();
      if (!allTransactions.length) {
        toast.info("Nenhuma transação para exportar", {
          description: "Ajuste os filtros e tente novamente.",
        });
        return;
      }

      const headers = [
        "Data/Hora",
        "Tipo",
        "Valor",
        "Status",
        "Pagador",
        "Documento",
        "Beneficiário",
        "Banco",
        "End-to-End",
        "Transaction ID",
        "Reconciliation ID",
        "Descrição",
      ];

      const csvRows = allTransactions.map((tx) => [
        formatDateTime(tx.createdAt),
        tx.type,
        (tx.type === "FUNDING" ? "+" : "-") + formatCurrency(tx.amount, tx.currency),
        tx.status,
        tx.payerName,
        tx.payerTaxId,
        tx.payeeName,
        tx.bankName,
        tx.endToEndId,
        tx.transactionId,
        tx.reconciliationId,
        tx.description || "",
      ]);

      const csvContent = [
        headers.join(","),
        ...csvRows.map((row) =>
          row
            .map((field) =>
              typeof field === "string" && (field.includes(",") || field.includes('"') || field.includes("\n"))
                ? `"${field.replace(/"/g, '""')}"`
                : field
            )
            .join(",")
        ),
      ].join("\n");

      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const filename = `extrato_revy_${new Date().toISOString().split("T")[0]}.csv`;
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Exportação concluída", {
        description: `${allTransactions.length} registros exportados`,
      });
    } catch (err: any) {
      toast.error("Erro ao exportar", {
        description: err?.message || "Tente novamente em instantes",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSync = async () => {
    if (!syncRange.from || !syncRange.to) {
      toast.error("Selecione o período completo", {
        description: "Informe data inicial e final para sincronizar.",
      });
      return;
    }

    setDateRange({ ...syncRange });
    setCurrentPage(1);
    try {
      await loadTransactions(1, { dateRange: syncRange });
      toast.success("Extrato atualizado", {
        description: `${format(syncRange.from, "dd/MM/yyyy")} a ${format(syncRange.to, "dd/MM/yyyy")}`,
      });
      setIsSyncDialogOpen(false);
    } catch (err: any) {
      toast.error("Erro ao sincronizar", {
        description: err?.message || "Tente novamente em instantes",
      });
    }
  };

  const handleSendPix = async () => {
    const amountNumber = parseFloat(pixForm.amount.replace(/[^\d.,-]/g, "").replace(",", "."));

    if (!pixForm.key.trim()) {
      toast.error("Informe a chave PIX");
      return;
    }

    if (Number.isNaN(amountNumber) || amountNumber <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    if (!pixForm.pin.trim()) {
      toast.error("Informe o PIN transacional");
      return;
    }

    setIsSendingPix(true);
    try {
      const response = await sendRevyPixPayment(REVY_ACCOUNT_UUID, {
        key: pixForm.key.trim(),
        amount: amountNumber,
        pin: pixForm.pin.trim(),
      });

      toast.success("PIX enviado com sucesso!", {
        description: `Transaction ID: ${response.transaction.id}`,
      });
      setPixForm({ key: "", amount: "", pin: "" });
      loadBalance();
    } catch (err: any) {
      toast.error("Erro ao enviar PIX", {
        description: err?.message || "Tente novamente em instantes",
      });
    } finally {
      setIsSendingPix(false);
    }
  };

  const renderStatusBadge = (status: IpRevyTransaction["status"]) => {
    const config = statusConfig[status];
    if (!config) return null;
    return (
      <Badge className={cn("text-xs", config.className)}>{config.label}</Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border border-border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600">
              <Server className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm text-muted-foreground">Consultando extrato de:</p>
              <p className="text-base font-semibold text-foreground">
                IP Revy {"<>"} OTC Desk
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                Documento: {formatDocument("12.345.678/0001-90")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Saldo OPERATIONAL</p>
                <p className="text-lg font-semibold">{formattedBalance}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadTransactions(currentPage)}
                disabled={isLoading}
                className="rounded-full"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                    Atualizar extrato
                  </>
                )}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                Ativo
              </Badge>
              <Badge
                className={cn(
                  "text-xs font-medium border",
                  isRealtimeConnected
                    ? "bg-green-100 text-green-800 border-green-200"
                    : isRealtimeReconnecting
                      ? "bg-amber-100 text-amber-700 border-amber-200"
                      : "bg-gray-100 text-gray-600 border-gray-200"
                )}
                title={realtimeError || undefined}
              >
                {isRealtimeReconnecting
                  ? "Tempo real: reconectando"
                  : isRealtimeConnected
                    ? "Tempo real: ativo"
                    : "Tempo real: offline"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.label} className="bg-card border border-border shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={cn("p-2 rounded-xl", card.iconClass)}>
                <card.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-xl font-semibold text-card-foreground">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="extract" className="space-y-6">
        <TabsList className="bg-muted/30 p-1 rounded-2xl flex flex-wrap gap-2 w-full">
          <TabsTrigger
            value="extract"
            className="flex items-center gap-2 px-4 py-2 rounded-xl data-[state=active]:bg-card data-[state=active]:text-card-foreground"
          >
            <FileText className="h-4 w-4" />
            Extrato
          </TabsTrigger>
          <TabsTrigger
            value="pix"
            className="flex items-center gap-2 px-4 py-2 rounded-xl data-[state=active]:bg-card data-[state=active]:text-card-foreground"
          >
            <SendHorizontal className="h-4 w-4" />
            Ações PIX
          </TabsTrigger>
          <TabsTrigger
            value="keys"
            className="flex items-center gap-2 px-4 py-2 rounded-xl data-[state=active]:bg-card data-[state=active]:text-card-foreground"
          >
            <Key className="h-4 w-4" />
            Chaves PIX
            <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-muted text-xs font-semibold">
              0
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="extract" className="space-y-6">

      <Card className="bg-card border border-border shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/20 to-muted/30 border-b border-border pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg text-white">
                <Filter className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-card-foreground">
                  Filtros de Pesquisa – IP Revy {"<>"} OTC
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Personalize a visualização do extrato
                </p>
              </div>
            </div>
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs font-semibold">
              OTC
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">
                Data inicial
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-12 justify-start text-left font-normal rounded-xl border-border bg-input",
                      !dateRange.from && "text-muted-foreground"
                    )}
                    disabled={isLoading}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      format(dateRange.from, "PPP", { locale: ptBR })
                    ) : (
                      "Selecionar data"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) =>
                      setDateRange((prev) => ({ ...prev, from: date || prev.from }))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">
                Data final
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-12 justify-start text-left font-normal rounded-xl border-border bg-input",
                      !dateRange.to && "text-muted-foreground"
                    )}
                    disabled={isLoading}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.to ? (
                      format(dateRange.to, "PPP", { locale: ptBR })
                    ) : (
                      "Selecionar data"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) =>
                      setDateRange((prev) => ({ ...prev, to: date || prev.to }))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">
                Buscar por nome ou documento
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cliente, banco, documento..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  disabled={isLoading}
                  className="pl-9 h-12 rounded-xl border-border bg-input"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">
                Valor específico (exato)
              </label>
              <Input
                placeholder="Ex: 100000"
                value={specificAmount}
                onChange={(event) => setSpecificAmount(event.target.value)}
                disabled={isLoading}
                className="h-12 rounded-xl border-border bg-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">
                Tipo de transação
              </label>
              <Select value={typeFilter} onValueChange={(value: TransactionTypeFilter) => setTypeFilter(value)}>
                <SelectTrigger className="h-12 rounded-xl border-border bg-input">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="FUNDING">Entradas (Funding)</SelectItem>
                  <SelectItem value="WITHDRAWAL">Saídas (Withdrawal)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">
                Status
              </label>
              <Select value={statusFilter} onValueChange={(value: TransactionStatusFilter) => setStatusFilter(value)}>
                <SelectTrigger className="h-12 rounded-xl border-border bg-input">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="COMPLETE">Liquidado</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="FAILED">Falhou</SelectItem>
                  <SelectItem value="CANCELLED">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">
                Valor mínimo
              </label>
              <Input
                placeholder="Ex: 1000"
                value={minAmount}
                onChange={(event) => setMinAmount(event.target.value)}
                disabled={isLoading}
                className="h-12 rounded-xl border-border bg-input"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">
                Valor máximo
              </label>
              <Input
                placeholder="Ex: 500000"
                value={maxAmount}
                onChange={(event) => setMaxAmount(event.target.value)}
                disabled={isLoading}
                className="h-12 rounded-xl border-border bg-input"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">
                Registros por página
              </label>
              <Select
                value={recordsPerPage.toString()}
                onValueChange={async (value) => {
                  const numeric = parseInt(value, 10);
                  const limit = Number.isNaN(numeric) ? 100 : numeric;
                  setRecordsPerPage(limit);
                  setCurrentPage(1);
                  try {
                    await loadTransactions(1, { recordsPerPage: limit });
                  } catch (err: any) {
                    toast.error("Erro ao atualizar quantidade", {
                      description: err?.message || "Tente novamente em instantes",
                    });
                  }
                }}
              >
                <SelectTrigger className="h-12 rounded-xl border-border bg-input">
                  <SelectValue placeholder="100" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 registros</SelectItem>
                  <SelectItem value="100">100 registros</SelectItem>
                  <SelectItem value="200">200 registros</SelectItem>
                  <SelectItem value="500">500 registros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleApplyFilters}
              disabled={isLoading}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl px-6 py-3 font-semibold shadow-lg"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Filter className="mr-2 h-4 w-4" />
              )}
              {isLoading ? "Aplicando..." : "Aplicar filtros"}
            </Button>
            <Button
              variant="outline"
              onClick={handleResetFilters}
              disabled={isLoading}
              className="rounded-xl px-6 py-3 font-semibold border-border"
            >
              <X className="mr-2 h-4 w-4" />
              Limpar filtros
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsSyncDialogOpen(true)}
              disabled={isLoading}
              className="rounded-xl px-6 py-3 font-semibold border-border hover:border-emerald-500 hover:text-emerald-600"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Sincronizar extrato
            </Button>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={isLoading || isExporting}
              className="rounded-xl px-6 py-3 font-semibold border-border hover:border-emerald-500 hover:text-emerald-600"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar CSV
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border border-border shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/20 to-muted/30 border-b border-border pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg text-white">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-card-foreground">
                  Extrato de Transações IP Revy {"<>"} OTC
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {filteredTransactions.length} registros nesta página • {totals.deposits} entradas • {totals.withdrawals} saídas
                </p>
                <div className="flex flex-wrap gap-4 mt-2 text-sm">
                  <span className="text-emerald-600 font-medium">
                    Entradas: {formatCurrency(totals.depositAmount)}
                  </span>
                  <span className="text-red-600 font-medium">
                    Saídas: {formatCurrency(totals.withdrawalAmount)}
                  </span>
                  <span className="text-muted-foreground">
                    Saldo líquido: {formatCurrency(totals.net)}
                  </span>
                </div>
              </div>
            </div>
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs font-semibold">
              Dados em tempo real
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm text-muted-foreground">Carregando transações...</span>
            </div>
          ) : error ? (
            <div className="text-center p-12 space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-red-500" />
              <div>
                <h3 className="text-lg font-semibold text-card-foreground">Erro ao carregar extrato</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button variant="outline" onClick={handleApplyFilters}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Tentar novamente
              </Button>
            </div>
          ) : paginatedTransactions.length === 0 ? (
            <div className="text-center p-12 space-y-4">
              <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold text-card-foreground">Nenhum registro encontrado</h3>
                <p className="text-sm text-muted-foreground">
                  Ajuste os filtros para encontrar outras movimentações.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="hidden lg:block">
                <div className="max-h-[70vh] overflow-y-auto scrollbar-thin">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/40 backdrop-blur-sm z-10">
                      <TableRow className="border-b border-border">
                        <TableHead className="w-[160px]">Data/Hora</TableHead>
                        <TableHead className="w-[160px]">Valor</TableHead>
                        <TableHead className="min-w-[200px]">Pagador</TableHead>
                        <TableHead className="min-w-[200px]">Beneficiário</TableHead>
                        <TableHead className="w-[140px]">Status</TableHead>
                        <TableHead className="min-w-[200px]">Descrição</TableHead>
                        <TableHead className="w-[160px]">End-to-End</TableHead>
                        <TableHead className="w-[120px] text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTransactions.map((transaction) => (
                        <TableRow
                          key={transaction.id}
                          className="cursor-pointer hover:bg-muted/20 transition-colors"
                          onClick={() => handleRowClick(transaction)}
                        >
                          <TableCell className="font-medium text-sm">
                            {formatDateTime(transaction.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span
                                className={cn(
                                  "font-semibold text-sm font-mono",
                                  transaction.type === "FUNDING" ? "text-emerald-600" : "text-red-600"
                                )}
                              >
                                {transaction.type === "FUNDING" ? "+" : "-"}
                                {formatCurrency(transaction.amount, transaction.currency)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {transaction.type === "FUNDING" ? "Entrada" : "Saída"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="space-y-1">
                              <p className="font-medium text-card-foreground">
                                {transaction.payerName}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {formatDocument(transaction.payerTaxId)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Banco: {transaction.payerBankName || transaction.bankName}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="space-y-1">
                              <p className="font-medium text-card-foreground">
                                {transaction.payeeName}
                              </p>
                              {transaction.payeeDocument && (
                                <p className="text-xs text-muted-foreground font-mono">
                                  {formatDocument(transaction.payeeDocument)}
                                </p>
                              )}
                              {transaction.payeeBankName && (
                                <p className="text-xs text-muted-foreground">
                                  Banco: {transaction.payeeBankName}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{renderStatusBadge(transaction.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {transaction.description || "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">
                                {transaction.endToEndId}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleCopy(transaction.endToEndId, "End-to-End");
                                }}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 text-xs border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toast.info("Funcionalidade OTC em construção");
                                }}
                              >
                                <Check className="mr-1 h-3 w-3" /> OTC
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="lg:hidden space-y-4 p-4">
                {paginatedTransactions.map((transaction) => (
                  <Card
                    key={transaction.id}
                    onClick={() => handleRowClick(transaction)}
                    className="border border-border hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(transaction.createdAt)}
                        </span>
                        {renderStatusBadge(transaction.status)}
                      </div>
                      <div>
                        <span
                          className={cn(
                            "text-lg font-semibold font-mono",
                            transaction.type === "FUNDING" ? "text-emerald-600" : "text-red-600"
                          )}
                        >
                          {transaction.type === "FUNDING" ? "+" : "-"}
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {transaction.type === "FUNDING" ? "Entrada" : "Saída"} • {transaction.payerBankName}
                        </p>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="font-semibold text-card-foreground">Pagador</p>
                          <p>{transaction.payerName}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {formatDocument(transaction.payerTaxId)}
                          </p>
                        </div>
                        <div>
                          <p className="font-semibold text-card-foreground">Beneficiário</p>
                          <p>{transaction.payeeName}</p>
                          {transaction.payeeDocument && (
                            <p className="text-xs text-muted-foreground font-mono">
                              {formatDocument(transaction.payeeDocument)}
                            </p>
                          )}
                          {transaction.payeeBankName && (
                            <p className="text-xs text-muted-foreground">{transaction.payeeBankName}</p>
                          )}
                        </div>
                        {transaction.description && (
                          <p className="text-xs text-muted-foreground">
                            {transaction.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-muted-foreground">
                          {transaction.endToEndId}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-xs"
                          onClick={(event) => {
                            event.stopPropagation();
                            toast.info("Funcionalidade OTC em construção");
                          }}
                        >
                          OTC
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="border-t border-border bg-muted/20 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  Mostrando {showingFrom ? `${showingFrom}–${showingTo}` : "0"} de {totalRecordsDisplay} registros
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || isLoading}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm font-medium">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || isLoading}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="pix">
      <Card className="relative overflow-hidden border border-border shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-emerald-600/10 pointer-events-none" />
        <CardHeader className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <SendHorizontal className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-card-foreground">Enviar PIX - Revy</CardTitle>
              <p className="text-sm text-muted-foreground">
                Transfira valores usando a conta operacional (UUID {REVY_ACCOUNT_UUID})
              </p>
            </div>
          </div>
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">REVY</Badge>
        </CardHeader>
        <CardContent className="relative space-y-5">
          <div className="p-3 bg-muted/30 rounded-lg border border-border/60">
            <div className="flex flex-wrap items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm font-medium">Conta Operacional Revy</p>
                <p className="text-xs text-muted-foreground font-mono">
                  CNPJ: {formatDocument("12.345.678/0001-90")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Saldo disponível</p>
                <p className="text-base font-semibold">{formattedBalance}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-card-foreground">Chave PIX destinário</Label>
              <Input
                placeholder="email@exemplo.com, CPF, CNPJ, celular..."
                value={pixForm.key}
                onChange={(event) => setPixForm((prev) => ({ ...prev, key: event.target.value }))}
                disabled={isSendingPix}
                className="h-11 rounded-xl border-border bg-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-card-foreground">Valor (BRL)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="1500.00"
                value={pixForm.amount}
                onChange={(event) => setPixForm((prev) => ({ ...prev, amount: event.target.value }))}
                disabled={isSendingPix}
                className="h-11 rounded-xl border-border bg-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-card-foreground">PIN transacional</Label>
              <Input
                type="password"
                placeholder="******"
                value={pixForm.pin}
                onChange={(event) => setPixForm((prev) => ({ ...prev, pin: event.target.value }))}
                disabled={isSendingPix}
                className="h-11 rounded-xl border-border bg-input"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>• O débito ocorre após o webhook da Revy confirmar a transação.</span>
            <span>• Tenant OTC • Conta operacional ID 33.</span>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleSendPix}
              disabled={isSendingPix}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl px-6 py-3"
            >
              {isSendingPix ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando PIX...
                </>
              ) : (
                <>
                  <SendHorizontal className="mr-2 h-4 w-4" />
                  Enviar PIX
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setPixForm({ key: "", amount: "", pin: "" })}
              disabled={isSendingPix}
              className="rounded-xl px-6 py-3 font-semibold border-border"
            >
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="keys">
          <Card className="bg-card border border-border shadow-sm">
            <CardContent className="p-6 text-center space-y-3">
              <Key className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Integração de chaves PIX Revy está em desenvolvimento.
              </p>
              <Button variant="outline" disabled>
                Em breve
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Detalhes da transação
            </DialogTitle>
            <DialogDescription>
              Dados oficiais sincronizados via Ledger Revy
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Data/Hora</p>
                  <p className="text-sm font-medium">
                    {formatDateTime(selectedTransaction.createdAt)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      selectedTransaction.type === "FUNDING" ? "text-emerald-600" : "text-red-600"
                    )}
                  >
                    {selectedTransaction.type === "FUNDING" ? "+" : "-"}
                    {formatCurrency(selectedTransaction.amount, selectedTransaction.currency)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  {renderStatusBadge(selectedTransaction.status)}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Código de reconciliação</p>
                  <p className="text-sm font-mono">
                    {selectedTransaction.reconciliationId}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Pagador</p>
                  <p className="text-sm font-medium">
                    {selectedTransaction.payerName}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {formatDocument(selectedTransaction.payerTaxId)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Beneficiário</p>
                  <p className="text-sm font-medium">
                    {selectedTransaction.payeeName}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">End-to-End</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono">
                      {selectedTransaction.endToEndId}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleCopy(selectedTransaction.endToEndId, "End-to-End")}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Transaction ID</p>
                  <p className="text-sm font-mono">
                    {selectedTransaction.transactionId}
                  </p>
                </div>
              </div>
              {selectedTransaction.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedTransaction.description}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sincronizar extrato IP Revy</DialogTitle>
            <DialogDescription>
              Escolha o período que deseja sincronizar com a futura integração.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-card-foreground">Data inicial</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !syncRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {syncRange.from ? (
                      format(syncRange.from, "PPP", { locale: ptBR })
                    ) : (
                      "Selecionar data"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={syncRange.from}
                    onSelect={(date) =>
                      setSyncRange((prev) => ({ ...prev, from: date || prev.from }))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-card-foreground">Data final</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !syncRange.to && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {syncRange.to ? (
                      format(syncRange.to, "PPP", { locale: ptBR })
                    ) : (
                      "Selecionar data"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={syncRange.to}
                    onSelect={(date) =>
                      setSyncRange((prev) => ({ ...prev, to: date || prev.to }))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSyncDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSync}>
              Sincronizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
