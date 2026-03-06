import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, SendHorizontal, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

// Componentes BelmontX
import TopBarBelmontXOtc from "@/components/TopBarBelmontXOtc";
import ExtractTabBelmontXOtc from "@/components/ExtractTabBelmontXOtc";
import MoneyRainEffect from "@/components/MoneyRainEffect";
import BelmontXPixActions from "@/components/BelmontXPixActions";

// Contexto BelmontX OTC
import { BelmontXOtcProvider, useBelmontXOtc, BELMONTX_OTC_ACCOUNTS } from "@/contexts/BelmontXOtcContext";

// WebSocket Hook
import { useBelmontXRealtime } from "@/hooks/useBelmontXRealtime";

/** Seletor de conta BelmontX OTC (TTF / RXP) - similar ao CorpX */
function BelmontXOtcAccountSelector() {
  const { selectedAccount, setSelectedAccount } = useBelmontXOtc();

  const handleAccountChange = (accountId: string) => {
    const account = BELMONTX_OTC_ACCOUNTS.find((acc) => acc.id === accountId);
    if (!account || !account.available) {
      toast.error("Conta indisponível no momento.");
      return;
    }
    setSelectedAccount(account.id);
    toast.success(`Conta alterada para: ${account.label}`);
  };

  const currentAccount = BELMONTX_OTC_ACCOUNTS.find((a) => a.id === selectedAccount);

  return (
    <Card className="p-4 lg:p-6 bg-background border border-[rgba(255,255,255,0.1)] shadow-lg">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#9333ea]/10">
            <Building2 className="h-5 w-5 text-[#9333ea]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Conta BelmontX OTC</h3>
            <p className="text-sm text-muted-foreground">Selecione a conta para consultar</p>
          </div>
        </div>

        <div className="w-full lg:w-auto lg:min-w-[320px]">
          <Select value={selectedAccount} onValueChange={handleAccountChange}>
            <SelectTrigger className="h-12 bg-background border-2 focus:border-[#9333ea]">
              <div className="flex items-center gap-2 w-full">
                <Building2 className="h-4 w-4 text-[#9333ea]" />
                <div className="flex-1 text-left">
                  <div className="font-medium">{currentAccount?.label ?? selectedAccount.toUpperCase()}</div>
                  <div className="text-xs text-muted-foreground">
                    {currentAccount?.description ?? ""}
                  </div>
                </div>
              </div>
            </SelectTrigger>
            <SelectContent>
              {BELMONTX_OTC_ACCOUNTS.map((account) => (
                <SelectItem key={account.id} value={account.id} disabled={!account.available}>
                  <div className="flex items-center gap-3 w-full">
                    <div
                      className={`p-1.5 rounded-lg ${
                        account.available ? "bg-[#9333ea]/10" : "bg-red-500/10"
                      }`}
                    >
                      <Building2
                        className={`h-4 w-4 ${
                          account.available ? "text-[#9333ea]" : "text-red-600"
                        }`}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{account.label}</span>
                        {!account.available && (
                          <span className="text-xs text-red-500">Indisponível</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {account.description}
                      </div>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}

function BelmontXOtcContent() {
  // WebSocket para BelmontX OTC
  const { lastEvent } = useBelmontXRealtime({
    tenantId: 3,
    onTransaction: () => {},
  });

  const showMoneyEffect = lastEvent !== null;
  const newTransaction = lastEvent
    ? {
        amount: String(lastEvent.data?.amount || 0),
        type: (lastEvent.data?.cashInOrOut === "CASH IN" ? "funding" : "withdrawal") as
          | "funding"
          | "withdrawal",
      }
    : null;

  return (
    <div className="w-full min-h-screen bg-background">
      {newTransaction && (
        <MoneyRainEffect
          trigger={showMoneyEffect}
          amount={newTransaction.amount}
          type={newTransaction.type}
        />
      )}

      <TopBarBelmontXOtc />

      <div className="container mx-auto px-4 py-6 space-y-6">
        <BelmontXOtcAccountSelector />

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
            <ExtractTabBelmontXOtc />
          </TabsContent>

          {/* ABA: Ações PIX */}
          <TabsContent value="pix">
            <BelmontXPixActions />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function BelmontXOtcPage() {
  return (
    <BelmontXOtcProvider>
      <BelmontXOtcContent />
    </BelmontXOtcProvider>
  );
}
