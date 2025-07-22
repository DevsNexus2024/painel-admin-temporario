import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Activity
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

// Importar testes globais para disponibilizar no console
import "./testGlobal";

export default function PaymentsPage() {
  return (
    <div className="min-h-screen bg-background">
      <TopBarPayments />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
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
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg py-3 px-6 font-medium transition-all duration-200 flex items-center gap-2"
              >
                <Key className="h-4 w-4" />
                <span className="text-sm">Chaves PIX</span>
                <Badge variant="secondary" className="ml-2 text-xs px-2 py-0">2</Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Extrato - Largura Total */}
          <TabsContent value="extract" className="mt-0">
            <div className="w-full">
              <ExtractTable />
            </div>
          </TabsContent>

          {/* Ações PIX - Layout Compacto */}
          <TabsContent value="actions" className="mt-0">
            <div className="max-w-4xl mx-auto">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Enviar por Chave */}
                <Card className="relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-blue-600/5"></div>
                  <CardHeader className="relative pb-4">
                    <CardTitle className="text-lg flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <SendHorizontal className="h-5 w-5 text-blue-600" />
                      </div>
                      Enviar PIX
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
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-purple-600/5"></div>
                  <CardHeader className="relative pb-4">
                    <CardTitle className="text-lg flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/10">
                        <QrCode className="h-5 w-5 text-purple-600" />
                      </div>
                      QR Code
                    </CardTitle>
                    <CardDescription>
                      Pagamento via QR Code PIX
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative">
                    <PayQRForm />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Chaves PIX */}
          <TabsContent value="keys" className="mt-0">
            <div className="max-w-4xl mx-auto">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Minhas Chaves */}
                <Card className="relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-green-600/5"></div>
                  <CardHeader className="relative pb-4">
                    <CardTitle className="text-lg flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-500/10">
                        <Key className="h-5 w-5 text-green-600" />
                      </div>
                      Minhas Chaves PIX
                    </CardTitle>
                    <CardDescription>
                      Gerencie suas chaves cadastradas
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative">
                    <ListPixKeysForm />
                  </CardContent>
                </Card>

                {/* Criar Nova Chave */}
                <Card className="relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-orange-600/5"></div>
                  <CardHeader className="relative pb-4">
                    <CardTitle className="text-lg flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-orange-500/10">
                        <Plus className="h-5 w-5 text-orange-600" />
                      </div>
                      Nova Chave PIX
                    </CardTitle>
                    <CardDescription>
                      Cadastre uma nova chave PIX
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative">
                    <CreatePixKeyForm />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 