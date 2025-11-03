import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Search, RefreshCcw, Eye, Loader2 } from "lucide-react";
import { ledgerApi } from "@/services/ledger-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Account {
  id: number;
  tenantId: number;
  userId: number | null;
  accountType: string;
  accountPurpose: string;
  currency: string;
  balance: string;
  creditLimit: string;
  tenant?: {
    name: string;
    slug: string;
  };
  user?: {
    email: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export default function ContasPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    tenantId: "",
    accountType: "ALL",
    currency: "ALL",
  });

  useEffect(() => {
    fetchAccounts();
  }, [filters, pagination.page]);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const response = await ledgerApi.listAccounts({
        page: pagination.page,
        limit: pagination.limit,
        tenantId: filters.tenantId ? parseInt(filters.tenantId) : undefined,
        accountType: filters.accountType !== "ALL" ? filters.accountType : undefined,
        currency: filters.currency !== "ALL" ? filters.currency : undefined,
      });
      
      setAccounts(response.data || []);
      setPagination({
        ...pagination,
        total: response.pagination?.total || 0,
        totalPages: response.pagination?.totalPages || 0,
      });
    } catch (error: any) {
      // Erro já tratado pelo ledgerApi
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
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

  const handleViewDetails = (accountId: number) => {
    toast.info(`Visualizar detalhes da conta ${accountId}`);
    // TODO: Implementar modal de detalhes
  };

  const handleClearFilters = () => {
    setFilters({
      tenantId: "",
      accountType: "ALL",
      currency: "ALL",
    });
    setPagination({ ...pagination, page: 1 });
  };

  const getAccountTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      USER: "bg-blue-500/20 text-blue-500 border-blue-500/40",
      OPERATIONAL: "bg-purple-500/20 text-purple-500 border-purple-500/40",
      LIQUIDITY_POOL: "bg-green-500/20 text-green-500 border-green-500/40",
    };
    return colors[type] || "bg-gray-500/20 text-gray-400 border-gray-500/40";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Filtros */}
      <Card className="p-4 lg:p-6 bg-background border border-[rgba(255,255,255,0.1)]">
        <div className="space-y-3 lg:space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 lg:gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Tenant ID
              </label>
              <Input
                placeholder="ID do tenant..."
                value={filters.tenantId}
                onChange={(e) => setFilters({ ...filters, tenantId: e.target.value })}
                className="h-10 bg-background border-2 focus:border-[rgba(0,105,209,0.6)]"
                type="number"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Tipo de Conta
              </label>
              <Select
                value={filters.accountType}
                onValueChange={(value) => setFilters({ ...filters, accountType: value })}
              >
                <SelectTrigger className="h-10 bg-background border-2 focus:border-[rgba(0,105,209,0.6)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="USER">Usuário</SelectItem>
                  <SelectItem value="OPERATIONAL">Operacional</SelectItem>
                  <SelectItem value="LIQUIDITY_POOL">Pool de Liquidez</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Moeda
              </label>
              <Select
                value={filters.currency}
                onValueChange={(value) => setFilters({ ...filters, currency: value })}
              >
                <SelectTrigger className="h-10 bg-background border-2 focus:border-[rgba(0,105,209,0.6)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas</SelectItem>
                  <SelectItem value="BRL">BRL</SelectItem>
                  <SelectItem value="BTC">BTC</SelectItem>
                  <SelectItem value="USDT">USDT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                onClick={fetchAccounts}
                disabled={loading}
                className="h-10 flex-1"
              >
                <RefreshCcw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Atualizar
              </Button>
              <Button
                variant="outline"
                onClick={handleClearFilters}
                disabled={loading}
                className="h-10 bg-black border border-[#0069d1] text-white hover:bg-[#0069d1] hover:text-white transition-all duration-200 rounded-md px-3 lg:px-4"
              >
                Limpar
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabela de Contas */}
      <Card className="bg-background border border-[rgba(255,255,255,0.1)]">
        {loading && accounts.length === 0 ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#0069d1]" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma conta encontrada</p>
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
                    Tenant
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                    Moeda
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                    Saldo
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                    Limite Crédito
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                    Criado em
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account, index) => (
                  <tr
                    key={account.id}
                    className={cn(
                      "border-b hover:bg-muted/30 transition-colors",
                      index % 2 === 0 ? "bg-[#181818]" : "bg-[#1E1E1E]"
                    )}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-[#0069d1]" />
                        <span className="font-medium">{account.id}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge className={cn("text-xs", getAccountTypeBadge(account.accountType))}>
                        {account.accountType}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <span className="text-sm">{account.tenant?.name || account.tenantId}</span>
                    </td>
                    <td className="p-3">
                      <span className="text-sm font-mono">{account.currency}</span>
                    </td>
                    <td className="p-3">
                      <span className={cn(
                        "text-sm font-bold",
                        parseFloat(account.balance) >= 0 ? "text-green-500" : "text-red-500"
                      )}>
                        {formatCurrency(account.balance)}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(account.creditLimit)}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-sm text-muted-foreground">
                        {formatDate(account.createdAt)}
                      </span>
                    </td>
                    <td className="p-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(account.id)}
                        className="h-7 px-2"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t bg-muted/20">
            <div className="text-sm text-muted-foreground">
              Mostrando {((pagination.page - 1) * pagination.limit) + 1} -{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} de{" "}
              {pagination.total}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page === 1 || loading}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {pagination.page} de {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page >= pagination.totalPages || loading}
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

