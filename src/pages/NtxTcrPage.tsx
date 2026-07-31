import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText } from "lucide-react";

// Componentes NTX Pay TCR
import TopBarNtxTcr from "@/components/TopBarNtxTcr";
import ExtractTabNtxTcr from "@/components/ExtractTabNtxTcr";

/**
 * Painel NTX Pay ↔ TCR — saldo + extrato + Compensar por linha.
 *
 * SEM aba de Ações PIX por decisão: Devolver/Bloquear não entram pra NTX/FyHub
 * (o modal de compensação recebe allowPixActions={false}). Todo dado do provider é
 * renderizado como filho JSX (auto-escapado) — NÃO usar document.write/
 * dangerouslySetInnerHTML com campo de terceiro (nome do pagador é atacável).
 */
export default function NtxTcrPage() {
  return (
    <div className="w-full min-h-screen bg-background">
      {/* Top Bar com Saldos */}
      <TopBarNtxTcr />

      {/* Conteúdo Principal */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="extract" className="w-full">
          <TabsList className="grid w-full grid-cols-1 mb-6">
            <TabsTrigger value="extract" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Extrato
            </TabsTrigger>
          </TabsList>

          {/* ABA: Extrato */}
          <TabsContent value="extract">
            <ExtractTabNtxTcr />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
