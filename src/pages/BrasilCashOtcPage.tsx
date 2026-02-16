import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, SendHorizontal } from "lucide-react";

// Componentes BrasilCash OTC
import TopBarBrasilCashOtc from "@/components/TopBarBrasilCashOtc";
import ExtractTabBrasilCashOtc from "@/components/ExtractTabBrasilCashOtc";
import MoneyRainEffect from "@/components/MoneyRainEffect";
import BrasilCashOtcPixActions from "@/components/BrasilCashOtcPixActions";
import AccountSelectorBrasilCashOtc from "@/components/AccountSelectorBrasilCashOtc";

// Context
import { BrasilCashOtcProvider, useBrasilCashOtc } from "@/contexts/BrasilCashOtcContext";

// WebSocket Hook
import { useFilteredBitsoWebSocket } from "@/hooks/useFilteredBitsoWebSocket";

// Componente interno que usa o contexto
function BrasilCashOtcContent() {
  const { selectedAccount } = useBrasilCashOtc();
  
  // WebSocket filtrado para OTC
  const { showMoneyEffect, newTransaction, transactionQueue } = useFilteredBitsoWebSocket({
    context: 'otc',
    otcId: selectedAccount.otcId,
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
      <TopBarBrasilCashOtc />

      {/* Conteúdo Principal */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Seleção da Conta OTC */}
        <AccountSelectorBrasilCashOtc />
        
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
            <ExtractTabBrasilCashOtc />
          </TabsContent>

          {/* ABA: Ações PIX */}
          <TabsContent value="pix">
            <BrasilCashOtcPixActions />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Export default que envolve tudo no BrasilCashOtcProvider
export default function BrasilCashOtcPage() {
  return (
    <BrasilCashOtcProvider>
      <BrasilCashOtcContent />
    </BrasilCashOtcProvider>
  );
}
