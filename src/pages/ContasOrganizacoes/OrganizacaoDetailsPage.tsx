import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, ArrowLeft, CreditCard, DollarSign, FileText, Users, Loader2, RefreshCcw } from "lucide-react";
import { ledgerApi } from "@/services/ledger-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import TopBarContasOrganizacoes from "@/components/TopBarContasOrganizacoes";
import ContasOrganizacaoTab from "./tabs/ContasOrganizacaoTab";
import SaldoOrganizacaoTab from "./tabs/SaldoOrganizacaoTab";

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

export default function OrganizacaoDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchTenantDetails();
    } else {
      toast.error("ID da organização não fornecido");
      navigate("/contas-organizacoes");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchTenantDetails = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      // Buscar lista de tenants e encontrar o específico
      const response = await ledgerApi.listTenants({ limit: 100 });
      
      // Estrutura da resposta: { success: true, data: [...] }
      const tenantsList = response.data || [];
      
      // IDs podem vir como string da API, comparar como string
      const foundTenant = tenantsList.find((t: Tenant) => {
        const tId = String(t.id);
        const searchId = String(id);
        return tId === searchId;
      });
      
      if (foundTenant) {
        setTenant(foundTenant);
      } else {
        toast.error(`Organização com ID ${id} não encontrada`);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar detalhes da organização");
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

  if (loading && !tenant) {
    return (
      <div className="w-full min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0069d1]" />
      </div>
    );
  }

  if (!tenant && !loading) {
    return (
      <div className="w-full min-h-screen bg-background flex items-center justify-center">
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold mb-2">Organização não encontrada</h2>
              <p className="text-muted-foreground mb-4">
                A organização solicitada não foi encontrada ou você não tem permissão para acessá-la.
              </p>
              <Button onClick={() => navigate("/contas-organizacoes")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para Organizações
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!tenant) {
    return null;
  }

  return (
    <div className="w-full min-h-screen bg-background">
      {/* Top Bar com Resumo */}
      <TopBarContasOrganizacoes />

      {/* Header da Organização */}
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/contas-organizacoes")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Organizações
          </Button>

          <Card className="p-6 bg-background border border-[rgba(255,255,255,0.1)]">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-2xl bg-[#0069d1] shadow-xl">
                  <Building2 className="h-8 w-8 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold text-foreground">{tenant.name}</h1>
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
                  </div>
                  <p className="text-muted-foreground text-sm font-mono">{tenant.slug}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {tenant._count?.tenantMembers || 0} membro{tenant._count?.tenantMembers !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {tenant._count?.accounts || 0} conta{tenant._count?.accounts !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Criado em {formatDate(tenant.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={fetchTenantDetails}
                disabled={loading}
              >
                <RefreshCcw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Atualizar
              </Button>
            </div>
          </Card>
        </div>

        {/* Tabs de Navegação */}
        <Tabs defaultValue="contas" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 border-b border-border rounded-none bg-background h-auto">
            <TabsTrigger 
              value="contas" 
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-[#0069d1]"
            >
              <CreditCard className="h-4 w-4" />
              Contas
            </TabsTrigger>
            <TabsTrigger 
              value="saldo" 
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-[#0069d1]"
            >
              <DollarSign className="h-4 w-4" />
              Saldo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contas" className="mt-6">
            <ContasOrganizacaoTab tenantId={tenant.id} />
          </TabsContent>

          <TabsContent value="saldo" className="mt-6">
            <SaldoOrganizacaoTab tenantId={tenant.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

