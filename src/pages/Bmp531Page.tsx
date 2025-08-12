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
  AlertCircle,
  Ban
} from "lucide-react";
import TopBarBmp531 from "@/components/TopBarBmp531";
import SendByKeyFormBmp531 from "./payments/SendByKeyFormBmp531";
import PayQRFormBmp531 from "./payments/PayQRFormBmp531";
import CreatePixKeyFormBmp531 from "./payments/CreatePixKeyFormBmp531";
import ListPixKeysFormBmp531 from "./payments/ListPixKeysFormBmp531";
import ExtractTableBmp531 from "./payments/ExtractTableBmp531";

export default function Bmp531Page() {
  // BMP 531 sempre tem suporte completo a PIX
  const bankFeatures = {
    provider: 'bmp-531',
    displayName: 'BMP 531',
    hasPixKeys: true,
    hasQrCodePayment: true,
    hasExtract: true
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBarBmp531 />
      
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
              <ExtractTableBmp531 />
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
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-medium">
                        BMP 531
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Transferência por chave PIX
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative">
                    <SendByKeyFormBmp531 />
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
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-medium">
                        BMP 531
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Pagamento via código QR
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative">
                    <PayQRFormBmp531 />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Chaves PIX - Layout Vertical */}
          <TabsContent value="keys" className="mt-0">
            <div className="w-full max-w-7xl mx-auto">
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
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-medium">
                        BMP 531
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Registrar nova chave PIX
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative">
                    <CreatePixKeyFormBmp531 />
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
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-medium">
                        BMP 531
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Chaves registradas na conta
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative">
                    <ListPixKeysFormBmp531 />
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
