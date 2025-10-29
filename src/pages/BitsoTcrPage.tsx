import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, SendHorizontal } from "lucide-react";

// Componentes Bitso TCR
import TopBarBitsoTcr from "@/components/TopBarBitsoTcr";
import ExtractTabBitsoTcr from "@/components/ExtractTabBitsoTcr";
import MoneyRainEffect from "@/components/MoneyRainEffect";
import BitsoPixActions from "@/components/BitsoPixActions";

// WebSocket Hook
import { useBitsoWebSocket } from "@/hooks/useBitsoWebSocket";

export default function BitsoTcrPage() {
  // WebSocket para efeitos visuais
  const { showMoneyEffect, newTransaction, transactionQueue } = useBitsoWebSocket();

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
      <TopBarBitsoTcr />

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
            <ExtractTabBitsoTcr />
          </TabsContent>

          {/* ABA: Ações PIX (Enviar, QR Dinâmico, QR Estático) */}
          <TabsContent value="pix">
            <BitsoPixActions />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
