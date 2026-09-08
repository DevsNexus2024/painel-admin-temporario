import React from "react";

import TopBarCorpXContaDedicada from "@/components/TopBarCorpXContaDedicada";
import ExtractTabCorpXContaDedicada from "@/components/ExtractTabCorpXContaDedicada";

/**
 * Tela da conta CorpX DEDICADA do Edition (cliente TCR 4142).
 *
 * Molde: /brasilcash-conta-dedicada — extrato de UMA conta + compensação, com a
 * função de suporte da TCR.
 *
 * Diferenças deliberadas em relação à /corpx, todas por segurança de dinheiro:
 *  - conta FIXA, fora do `CorpXContext`: sem seletor e sem consolidado, então a
 *    tela não tem como exibir dinheiro de outra conta — e continua de pé quando
 *    o Edition sair do seletor;
 *  - sem "Sincronizar Extrato": `POST /api/corpx/sync` é o único endpoint do
 *    controller sem RBAC e recebe o escopo pelo corpo (ver o comentário em
 *    ExtractTabCorpXContaDedicada);
 *  - sem crédito ao OTC: a conta saiu do OTC, o suporte aqui é o da TCR;
 *  - sem WebSocket/MoneyRainEffect: o realtime é escopado na conta selecionada
 *    do contexto global, que não é esta;
 *  - saldo em estado de falha explícito: nunca R$ 0,00 no lugar de "não deu".
 */
export default function CorpXContaDedicadaPage() {
  return (
    <div className="w-full min-h-screen bg-background">
      <TopBarCorpXContaDedicada />

      <div className="container mx-auto px-4 py-6">
        <ExtractTabCorpXContaDedicada />
      </div>
    </div>
  );
}
