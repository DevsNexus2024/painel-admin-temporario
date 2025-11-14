import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, ArrowRightLeft } from "lucide-react";
import FailedPixManagement from "@/components/support/FailedPixManagement";
import BitsoReconciliationTab from "@/components/BitsoReconciliationTab";

export default function SupportPage() {
  return (
    <div className="w-full min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Suporte</h1>
          <p className="text-muted-foreground">
            Ferramentas de suporte para gerenciar operações e resolver problemas
          </p>
        </div>

        <Tabs defaultValue="failed-pix" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="failed-pix" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              PIX Falhados
            </TabsTrigger>
            <TabsTrigger value="reconciliation" className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Reconciliação Bitso
            </TabsTrigger>
          </TabsList>

          <TabsContent value="failed-pix">
            <FailedPixManagement />
          </TabsContent>

          <TabsContent value="reconciliation">
            <BitsoReconciliationTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

