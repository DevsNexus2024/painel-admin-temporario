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
 *  - sem "Sincronizar": o backend não endereça esta conta no sync (ver comentário
 *    em ExtractTabBrasilCashContaDedicada);
 *  - sem MoneyRainEffect/WebSocket: o socket disponível é da TCR;
 *  - saldo em falha visível: não há caminho para endereçá-lo hoje.
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
