import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, SendHorizontal } from "lucide-react";

// Componentes BrasilCash TCR
import TopBarBrasilCashTcr from "@/components/TopBarBrasilCashTcr";
import ExtractTabBrasilCashTcr from "@/components/ExtractTabBrasilCashTcr";
import MoneyRainEffect from "@/components/MoneyRainEffect";
import BrasilCashPixActions from "@/components/BrasilCashPixActions";

// WebSocket Hook (mantendo compatibilidade por enquanto)
import { useFilteredBitsoWebSocket } from "@/hooks/useFilteredBitsoWebSocket";

export default function BrasilCashTcrPage() {
  // WebSocket filtrado para TCR (pode ser adaptado no futuro para BrasilCash)
  const { showMoneyEffect, newTransaction, transactionQueue } = useFilteredBitsoWebSocket({
    context: 'tcr',
    tenantId: 2,
  });

  return (
    <div className="w-full min-h-screen bg-background">
      {/* 🎉 Efeito Visual de Dinheiro com contador de fila */}
      {newTransaction && (
        <MoneyRainEffect 
          trigger={showMoneyEffect} 
          amount={newTransaction.amount}
          type={newTransaction.type}
          queueCount={transactionQueue.length}
        />
      )}
      
      {/* Top Bar com Saldos */}
      <TopBarBrasilCashTcr />

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
            <ExtractTabBrasilCashTcr />
          </TabsContent>

          {/* ABA: Ações PIX (Enviar, QR Dinâmico, QR Estático) */}
          <TabsContent value="pix">
            <BrasilCashPixActions />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

