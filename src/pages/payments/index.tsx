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

export default function PaymentsPage() {
  return (
    <div className="min-h-screen bg-background">
      <TopBarPayments />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Layout Principal - Responsivo */}
        <div className="grid gap-6 lg:gap-8 grid-cols-1 xl:grid-cols-[420px_1fr]">
          
          {/* Painel Esquerdo - Ações PIX */}
          <div className="space-y-6">
            {/* Ações Rápidas */}
            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5"></div>
              <CardHeader className="relative pb-4">
                <CardTitle className="text-lg sm:text-xl flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <SendHorizontal className="h-5 w-5 text-primary" />
                  </div>
                  Ações PIX
                </CardTitle>
                <CardDescription>
                  Escolha uma das opções abaixo para realizar transações
                </CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <Tabs defaultValue="send-key" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/30 p-1 h-auto">
                    <TabsTrigger 
                      value="send-key" 
                      className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg py-3 px-2 text-xs sm:text-sm font-medium transition-all duration-200"
                    >
                      <SendHorizontal className="h-4 w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Enviar</span>
                      <span className="sm:hidden">Env</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="pay-qr" 
                      className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg py-3 px-2 text-xs sm:text-sm font-medium transition-all duration-200"
                    >
                      <QrCode className="h-4 w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">QR Code</span>
                      <span className="sm:hidden">QR</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="send-key" className="mt-0">
                    <SendByKeyForm />
                  </TabsContent>

                  <TabsContent value="pay-qr" className="mt-0">
                    <PayQRForm />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Painel Direito - Visualizações */}
          <div className="space-y-6">
            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/20"></div>
              <CardHeader className="relative pb-4">
                <CardTitle className="text-lg sm:text-xl flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Activity className="h-5 w-5 text-accent" />
                  </div>
                  Movimentações
                </CardTitle>
                <CardDescription>
                  Acompanhe suas transações, pendências e chaves PIX
                </CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <Tabs defaultValue="extract" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/30 p-1 h-auto">
                    <TabsTrigger 
                      value="extract" 
                      className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg py-3 px-4 font-medium transition-all duration-200 flex items-center gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      <span className="text-xs sm:text-sm">Extrato</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="keys" 
                      className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg py-3 px-4 font-medium transition-all duration-200 flex items-center gap-2"
                    >
                      <Key className="h-4 w-4" />
                      <span className="text-xs sm:text-sm">Chaves</span>
                      <Badge variant="secondary" className="ml-auto text-xs px-2 py-0">2</Badge>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="extract" className="mt-0">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-muted-foreground">Histórico de Transações</h3>

                      </div>
                      <ExtractTable />
                    </div>
                  </TabsContent>

                  <TabsContent value="keys" className="mt-0">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-muted-foreground">Minhas Chaves PIX</h3>

                      </div>
                      <ListPixKeysForm />
                      
                      {/* Divisor */}
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-border" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">
                            Criar Nova Chave
                          </span>
                        </div>
                      </div>
                      
                      <CreatePixKeyForm />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>


      </div>
    </div>
  );
} 