import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Landmark, ArrowLeft, DollarSign, FileText, Loader2, RefreshCcw, CreditCard } from "lucide-react";
import { ledgerApi } from "@/services/ledger-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import TopBarContasOrganizacoes from "@/components/TopBarContasOrganizacoes";
import SaldoContaTab from "./tabs/SaldoContaTab";
import ExtratoContaTab from "./tabs/ExtratoContaTab";

interface Account {
  id: number | string;
  tenantId: number | string;
  userId: number | string | null;
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
  metadata?: any;
}

export default function ContaDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(false);

  const tenantId = searchParams.get('tenantId');

  useEffect(() => {
    if (id) {
      fetchAccountDetails();
    }
  }, [id, tenantId]);

  const fetchAccountDetails = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const accountIdNum = parseInt(id);
      const tenantIdNum = tenantId ? parseInt(tenantId) : undefined;
      
      // Buscar lista de contas e encontrar a específica
      const response = await ledgerApi.listAccounts({
        limit: 1000,
        tenantId: tenantIdNum,
      });
      
      const accountsList = response.data || [];
      const foundAccount = accountsList.find((acc: Account) => {
        const accId = typeof acc.id === 'string' ? parseInt(acc.id) : acc.id;
        return accId === accountIdNum;
      });
      
      if (foundAccount) {
        setAccount(foundAccount);
      } else {
        toast.error(`Conta com ID ${id} não encontrada`);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar detalhes da conta");
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

  const getAccountTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      USER: "bg-blue-500/20 text-blue-500 border-blue-500/40",
      OPERATIONAL: "bg-purple-500/20 text-purple-500 border-purple-500/40",
      LIQUIDITY_POOL: "bg-green-500/20 text-green-500 border-green-500/40",
      SUSPENSE: "bg-gray-500/20 text-gray-400 border-gray-500/40",
    };
    return colors[type] || "bg-gray-500/20 text-gray-400 border-gray-500/40";
  };

  if (loading && !account) {
    return (
      <div className="w-full min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0069d1]" />
      </div>
    );
  }

  if (!account && !loading) {
    return (
      <div className="w-full min-h-screen bg-background flex items-center justify-center">
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <Landmark className="h-12 w-12 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold mb-2">Conta não encontrada</h2>
              <p className="text-muted-foreground mb-4">
                A conta solicitada não foi encontrada ou você não tem permissão para acessá-la.
              </p>
              <Button onClick={() => navigate("/contas-organizacoes")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!account) {
    return null;
  }

  return (
    <div className="w-full min-h-screen bg-background">
      {/* Top Bar com Resumo */}
      <TopBarContasOrganizacoes />

      {/* Header da Conta */}
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => {
              if (account.tenantId) {
                navigate(`/contas-organizacoes/organizacao/${account.tenantId}`);
              } else {
                navigate("/contas-organizacoes");
              }
            }}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>

          <Card className="p-6 bg-background border border-[rgba(255,255,255,0.1)]">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-2xl bg-[#0069d1] shadow-xl">
                  <Landmark className="h-8 w-8 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold text-foreground">Conta #{account.id}</h1>
                    <Badge className={cn("text-xs", getAccountTypeBadge(account.accountType))}>
                      {account.accountType}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm mb-3">{account.accountPurpose || "Sem descrição"}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Moeda: <span className="font-mono font-semibold">{account.currency}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className={cn(
                        "text-sm font-bold",
                        parseFloat(account.balance) >= 0 ? "text-green-500" : "text-red-500"
                      )}>
                        Saldo: {formatCurrency(account.balance)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Criado em {formatDate(account.createdAt)}
                      </span>
                    </div>
                  </div>
                  {account.tenant && (
                    <div className="mt-2">
                      <span className="text-xs text-muted-foreground">
                        Organização: <span className="font-semibold">{account.tenant.name}</span>
                      </span>
                    </div>
                  )}
                  {account.user && (
                    <div className="mt-2">
                      <span className="text-xs text-muted-foreground">
                        Usuário: <span className="font-semibold">{account.user.name || account.user.email}</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                onClick={fetchAccountDetails}
                disabled={loading}
              >
                <RefreshCcw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Atualizar
              </Button>
            </div>
          </Card>
        </div>

        {/* Tabs de Navegação */}
        <Tabs defaultValue="saldo" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 border-b border-border rounded-none bg-background h-auto">
            <TabsTrigger 
              value="saldo" 
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-[#0069d1]"
            >
              <DollarSign className="h-4 w-4" />
              Saldo
            </TabsTrigger>
            <TabsTrigger 
              value="extrato" 
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-[#0069d1]"
            >
              <FileText className="h-4 w-4" />
              Extrato
            </TabsTrigger>
          </TabsList>

          <TabsContent value="saldo" className="mt-6">
            <SaldoContaTab accountId={account.id} tenantId={account.tenantId} />
          </TabsContent>

          <TabsContent value="extrato" className="mt-6">
            <ExtratoContaTab accountId={account.id} tenantId={account.tenantId} accountName={`Conta #${account.id}`} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

