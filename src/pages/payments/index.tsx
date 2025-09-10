import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CreditCard, 
  FileText, 
  Key, 
  SendHorizontal, 
  QrCode, 
  Plus,
  TrendingUp,
  Clock,
  DollarSign,
  Activity,
  AlertCircle,
  Ban
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DashboardStats } from "@/components/DashboardStats";
import TopBarPayments from "@/components/TopBarPayments";
import SendByKeyForm from "./SendByKeyForm";
import PayQRForm from "./PayQRForm";
import CreatePixKeyForm from "./CreatePixKeyForm";
import ListPixKeysForm from "./ListPixKeysForm";
import PendingTable from "./PendingTable";
import ExtractTable from "./ExtractTable";
import BitsoPixActions from "@/components/BitsoPixActions";

// Importar testes globais para disponibilizar no console
import "./testGlobal";

// Hook para verificar conta ativa
import { useState, useEffect } from "react";
import { useBankFeatures } from "@/hooks/useBankFeatures";
// 🧪 TEMPORÁRIO: Indicador simples
import SimpleProviderIndicator from "@/components/SimpleProviderIndicator";

export default function PaymentsPage() {
  const [activeAccount, setActiveAccount] = useState<any>(null);
  
  // 🏦 USAR NOVO HOOK PARA VERIFICAR FEATURES DO BANCO
  const bankFeatures = useBankFeatures();

  useEffect(() => {
    // Verificar conta ativa do apiRouter
    const checkActiveAccount = () => {
      try {
        const apiRouter = (window as any).apiRouter;
        if (apiRouter?.getCurrentAccount) {
          const account = apiRouter.getCurrentAccount();
          setActiveAccount(account);
        }
      } catch (error) {
        console.log('ApiRouter não disponível ainda');
      }
    };

    checkActiveAccount();
    
    // Verificar periodicamente mudanças de conta
    const interval = setInterval(checkActiveAccount, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const isBitsoActive = activeAccount?.provider === 'bitso';

  // 🎨 Função para obter badge do provedor
  const getProviderBadge = () => {
    if (bankFeatures.provider === 'bitso') {
      return (
        <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs font-medium">
          Bitso
        </Badge>
      );
    } else if (bankFeatures.provider === 'bmp') {
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-medium">
          BMP
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBarPayments />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* 🧪 TEMPORÁRIO: Indicador simples de provider */}
        <SimpleProviderIndicator />
        
        {/* Layout Principal - Tabs no Topo */}
        <Tabs defaultValue="extract" className="w-full">
          <div className="flex items-center justify-between mb-6">
            <TabsList className="grid grid-cols-3 w-fit bg-muted/30 p-1 h-auto">
              <TabsTrigger 
                value="extract" 
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg py-3 px-6 font-medium transition-all duration-200 flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                <span className="text-sm">Extrato</span>
              </TabsTrigger>
              <TabsTrigger 
                value="actions" 
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg py-3 px-6 font-medium transition-all duration-200 flex items-center gap-2"
              >
                <SendHorizontal className="h-4 w-4" />
                <span className="text-sm">Ações PIX</span>
              </TabsTrigger>
              <TabsTrigger 
                value="keys" 
                disabled={!bankFeatures.hasPixKeys}
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg py-3 px-6 font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Key className="h-4 w-4" />
                <span className="text-sm">Chaves PIX</span>
                {bankFeatures.hasPixKeys ? (
                  <Badge variant="secondary" className="ml-2 text-xs px-2 py-0">2</Badge>
                ) : (
                  <Ban className="h-3 w-3 ml-2 text-muted-foreground" />
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Extrato - Largura Total */}
          <TabsContent value="extract" className="mt-0">
            <div className="w-full">
              {/* ✅ REMOVIDO: Card extra como solicitado pelo usuário */}
              <ExtractTable />
            </div>
          </TabsContent>

          {/* Ações PIX - Layout Mais Largo */}
          <TabsContent value="actions" className="mt-0">
            <div className="w-full max-w-7xl mx-auto">
              <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
                {/* Enviar por Chave */}
                <Card className="relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-blue-600/5"></div>
                  <CardHeader className="relative pb-4">
                    <CardTitle className="text-lg flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <SendHorizontal className="h-5 w-5 text-blue-600" />
                      </div>
                      Enviar PIX
                      {/* ✅ Badge do provedor atualizado dinamicamente */}
                      {getProviderBadge()}
                    </CardTitle>
                    <CardDescription>
                      Transferência por chave PIX
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative">
                    <SendByKeyForm />
                  </CardContent>
                </Card>

                {/* Pagar QR Code */}
                <Card className="relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-green-600/5"></div>
                  <CardHeader className="relative pb-4">
                    <CardTitle className="text-lg flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-500/10">
                        <QrCode className="h-5 w-5 text-green-600" />
                      </div>
                      Pagar QR Code
                      {/* ✅ Badge do provedor atualizado dinamicamente */}
                      {getProviderBadge()}
                      {!bankFeatures.hasQrCodePayment && (
                        <Badge variant="secondary" className="bg-red-100 text-red-700 border-red-200">
                          Indisponível
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Pagamento via código QR
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative">
                    {bankFeatures.hasQrCodePayment ? (
                      <PayQRForm />
                    ) : (
                      <Alert className="border-amber-200 bg-amber-50">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-800">
                          <strong>Funcionalidade não disponível para {bankFeatures.displayName}</strong>
                          <br />
                          Esta conta suporta apenas envio PIX por chave. Use "Enviar PIX" ao lado.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Chaves PIX - Layout Vertical */}
          <TabsContent value="keys" className="mt-0">
            <div className="w-full max-w-7xl mx-auto">
              {bankFeatures.hasPixKeys ? (
                <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
                  {/* Criar Chave */}
                  <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-purple-600/5"></div>
                    <CardHeader className="relative pb-4">
                      <CardTitle className="text-lg flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                          <Plus className="h-5 w-5 text-purple-600" />
                        </div>
                        Criar Chave PIX
                        {/* ✅ Badge do provedor atualizado dinamicamente */}
                        {getProviderBadge()}
                      </CardTitle>
                      <CardDescription>
                        Registrar nova chave PIX
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="relative">
                      <CreatePixKeyForm />
                    </CardContent>
                  </Card>

                  {/* Listar Chaves */}
                  <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-amber-600/5"></div>
                    <CardHeader className="relative pb-4">
                      <CardTitle className="text-lg flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/10">
                          <Key className="h-5 w-5 text-amber-600" />
                        </div>
                        Minhas Chaves PIX
                        {/* ✅ Badge do provedor atualizado dinamicamente */}
                        {getProviderBadge()}
                      </CardTitle>
                      <CardDescription>
                        Chaves registradas na conta
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="relative">
                      <ListPixKeysForm />
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="p-8 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 rounded-full bg-amber-100">
                        <Ban className="h-8 w-8 text-amber-600" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-amber-800">
                          Gerenciamento de Chaves PIX não disponível
                        </h3>
                        <div className="flex items-center justify-center gap-2 mb-4">
                          <span className="text-amber-700">para conta</span>
                          {getProviderBadge()}
                        </div>
                        <p className="text-amber-700 max-w-md">
                          A conta <strong>{bankFeatures.displayName}</strong> não suporta criação e gerenciamento de chaves PIX através desta interface.
                        </p>
                        <p className="text-sm text-amber-600 mt-4">
                          Para enviar PIX, use a aba "Ações PIX" → "Enviar PIX"
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 