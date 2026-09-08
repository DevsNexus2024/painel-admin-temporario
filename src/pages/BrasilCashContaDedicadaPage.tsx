import React from "react";

import TopBarBrasilCashContaDedicada from "@/components/TopBarBrasilCashContaDedicada";
import ExtractTabBrasilCashContaDedicada from "@/components/ExtractTabBrasilCashContaDedicada";

/**
 * Tela da conta BrasilCash DEDICADA de cliente.
 *
 * Espelha /brasilcash-tcr (extrato + Compensar), apontando para outra conta.
 *
 * Diferenças deliberadas em relação à tela TCR, todas por segurança de dinheiro:
 *  - sem aba "Ações PIX": esta tela é de leitura (extrato) + compensação;
 *  - "Sincronizar Extrato" existe, mas com o alvo FIXO na conta desta tela: o
 *    operador escolhe o período, nunca a conta (ver `handleSincronizar` em
 *    ExtractTabBrasilCashContaDedicada);
 *  - sem MoneyRainEffect/WebSocket: o socket disponível é da TCR;
 *  - saldo endereçado pelo `x-account-id` da conta (a conta decide a credencial
 *    no backend); em falha, a tela mostra a falha — nunca R$ 0,00.
 */
export default function BrasilCashContaDedicadaPage() {
  return (
    <div className="w-full min-h-screen bg-background">
      <TopBarBrasilCashContaDedicada />

      <div className="container mx-auto px-4 py-6">
        <ExtractTabBrasilCashContaDedicada />
      </div>
    </div>
  );
}
