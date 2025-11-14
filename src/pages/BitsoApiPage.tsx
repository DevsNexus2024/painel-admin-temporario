import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, SendHorizontal } from "lucide-react";

// Componentes Bitso API
import TopBarBitsoApi from "@/components/TopBarBitsoApi";
import ExtractTabBitsoApi from "@/components/ExtractTabBitsoApi";
import MoneyRainEffect from "@/components/MoneyRainEffect";
import BitsoPixActions from "@/components/BitsoPixActions";

// WebSocket Hook
import { useFilteredBitsoWebSocket } from "@/hooks/useFilteredBitsoWebSocket";

export default function BitsoApiPage() {
  // WebSocket para efeitos visuais - contexto API mostra tudo
  const { showMoneyEffect, newTransaction, transactionQueue } = useFilteredBitsoWebSocket({
    context: 'api',
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
      <TopBarBitsoApi />

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
            <ExtractTabBitsoApi />
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

