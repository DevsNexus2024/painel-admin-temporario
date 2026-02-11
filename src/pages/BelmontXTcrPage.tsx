import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, SendHorizontal } from "lucide-react";

// Componentes BelmontX TCR
import TopBarBelmontXTcr from "@/components/TopBarBelmontXTcr";
import ExtractTabBelmontXTcr from "@/components/ExtractTabBelmontXTcr";
import MoneyRainEffect from "@/components/MoneyRainEffect";
import BelmontXPixActionsTcr from "@/components/BelmontXPixActionsTcr";

// WebSocket Hook
import { useBelmontXRealtime } from "@/hooks/useBelmontXRealtime";

export default function BelmontXTcrPage() {
  // WebSocket para BelmontX TCR
  const { isConnected, lastEvent } = useBelmontXRealtime({
    tenantId: 2,
    onTransaction: (payload) => {
      // Callback será tratado internamente pelo hook
    },
  });

  // Determinar se deve mostrar efeito de dinheiro (similar ao Bitso)
  const showMoneyEffect = lastEvent !== null;
  const newTransaction = lastEvent ? {
    amount: String(lastEvent.data?.amount || 0),
    type: lastEvent.data?.cashInOrOut === "CASH IN" ? "funding" : "withdrawal" as "funding" | "withdrawal"
  } : null;

  return (
    <div className="w-full min-h-screen bg-background">
      {/* 🎉 Efeito Visual de Dinheiro */}
      {newTransaction && (
        <MoneyRainEffect 
          trigger={showMoneyEffect} 
          amount={newTransaction.amount}
          type={newTransaction.type}
        />
      )}
      
      {/* Top Bar com Saldos */}
      <TopBarBelmontXTcr />

      {/* Conteúdo Principal */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="extract" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="extract" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Extrato
            </TabsTrigger>
            <TabsTrigger value="pix" className="flex items-center gap-2">
              <SendHorizontal className="h-4 w-4" />
              Ações PIX
            </TabsTrigger>
          </TabsList>

          {/* ABA: Extrato */}
          <TabsContent value="extract">
            <ExtractTabBelmontXTcr />
          </TabsContent>

          {/* ABA: Ações PIX */}
          <TabsContent value="pix">
            <BelmontXPixActionsTcr />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
