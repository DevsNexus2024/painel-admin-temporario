import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Search, RefreshCcw, Eye, Edit, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ledgerApi } from "@/services/ledger-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Tenant {
  id: number | string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  _count?: {
    tenantMembers: number;
    accounts: number;
  };
}

export default function OrganizacoesPage() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    name: "",
    slug: "",
    status: "ALL" as "ALL" | "ACTIVE" | "SUSPENDED",
  });

  useEffect(() => {
    fetchTenants();
  }, [filters, pagination.page]);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const response = await ledgerApi.listTenants({
        page: pagination.page,
        limit: pagination.limit,
        name: filters.name || undefined,
        slug: filters.slug || undefined,
        status: filters.status !== "ALL" ? filters.status : undefined,
      });
      
      setTenants(response.data || []);
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

  const handleViewDetails = (tenantId: number) => {
    navigate(`/contas-organizacoes/organizacao/${tenantId}`);
  };

  const handleEdit = (tenantId: number) => {
    toast.info(`Editar organização ${tenantId}`);
    // TODO: Implementar modal de edição
  };

  const handleClearFilters = () => {
    setFilters({
      name: "",
      slug: "",
      status: "ALL",
    });
    setPagination({ ...pagination, page: 1 });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Filtros */}
      <Card className="p-4 lg:p-6 bg-background border border-[rgba(255,255,255,0.1)]">
        <div className="space-y-3 lg:space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome ou slug..."
                  value={filters.name}
                  onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                  className="pl-10 h-10 bg-background border-2 focus:border-[rgba(0,105,209,0.6)]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Status
              </label>
              <Select
                value={filters.status}
                onValueChange={(value: "ALL" | "ACTIVE" | "SUSPENDED") =>
                  setFilters({ ...filters, status: value })
                }
              >
                <SelectTrigger className="h-10 bg-background border-2 focus:border-[rgba(0,105,209,0.6)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="ACTIVE">Ativas</SelectItem>
                  <SelectItem value="SUSPENDED">Suspensas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                onClick={fetchTenants}
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
                Limpar Filtros
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabela de Organizações */}
      <Card className="bg-background border border-[rgba(255,255,255,0.1)]">
        {loading && tenants.length === 0 ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#0069d1]" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma organização encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b sticky top-0 z-10">
                <tr>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                    Nome
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                    Slug
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                    Membros
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                    Contas
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
                {tenants.map((tenant, index) => (
                  <tr
                    key={tenant.id}
                    className={cn(
                      "border-b hover:bg-muted/30 transition-colors",
                      index % 2 === 0 ? "bg-[#181818]" : "bg-[#1E1E1E]"
                    )}
                  >
                    <td className="p-3">
                      <div 
                        className="flex items-center gap-2 cursor-pointer hover:text-[#0069d1] transition-colors"
                        onClick={() => handleViewDetails(tenant.id)}
                      >
                        <Building2 className="h-4 w-4 text-[#0069d1]" />
                        <span className="font-medium">{tenant.name}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="text-sm text-muted-foreground font-mono">
                        {tenant.slug}
                      </span>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={tenant.status === "ACTIVE" ? "default" : "secondary"}
                        className={
                          tenant.status === "ACTIVE"
                            ? "bg-green-500/20 text-green-500 border-green-500/40"
                            : "bg-gray-500/20 text-gray-400 border-gray-500/40"
                        }
                      >
                        {tenant.status === "ACTIVE" ? "Ativa" : "Suspensa"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <span className="text-sm">{tenant._count?.tenantMembers || 0}</span>
                    </td>
                    <td className="p-3">
                      <span className="text-sm">{tenant._count?.accounts || 0}</span>
                    </td>
                    <td className="p-3">
                      <span className="text-sm text-muted-foreground">
                        {formatDate(tenant.createdAt)}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(tenant.id)}
                          className="h-7 px-2"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(tenant.id)}
                          className="h-7 px-2"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
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

