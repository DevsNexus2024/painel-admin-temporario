import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { useBrasilCashOtc, BRASILCASH_OTC_ACCOUNTS } from "@/contexts/BrasilCashOtcContext";

export default function AccountSelectorBrasilCashOtc() {
  const { selectedAccount, setSelectedAccount } = useBrasilCashOtc();

  const handleAccountChange = (accountId: string) => {
    const account = BRASILCASH_OTC_ACCOUNTS.find(acc => acc.id === accountId);
    if (!account) {
      return;
    }

    if (!account.available) {
      toast.error('Conta indisponível no momento.', {
        description: 'Selecione outra conta para continuar',
      });
      return;
    }

    setSelectedAccount(account);
    toast.success(`Conta alterada para: ${account.name}`);
  };

  return (
    <Card className="p-4 lg:p-6 bg-background border border-[rgba(255,255,255,0.1)] shadow-lg">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-500/10">
            <Building2 className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Conta BrasilCash OTC</h3>
            <p className="text-sm text-muted-foreground">Selecione a conta para consultar</p>
          </div>
        </div>
        
        <div className="w-full lg:w-auto lg:min-w-[400px]">
          <Select value={selectedAccount.id} onValueChange={handleAccountChange}>
            <SelectTrigger className="h-12 bg-background border-2 focus:border-orange-500">
              <div className="flex items-center gap-2 w-full">
                <Building2 className="h-4 w-4 text-orange-600" />
                <div className="flex-1 text-left">
                  <div className="font-medium">{selectedAccount.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    OTC ID: {selectedAccount.otcId}
                  </div>
                </div>
              </div>
            </SelectTrigger>
            <SelectContent>
              {BRASILCASH_OTC_ACCOUNTS.map((account) => (
                <SelectItem key={account.id} value={account.id} disabled={!account.available}>
                  <div className="flex items-center gap-3 w-full">
                    <div className={`p-1.5 rounded-lg ${
                      account.available 
                        ? 'bg-green-500/10' 
                        : 'bg-red-500/10'
                    }`}>
                      <Building2 className={`h-4 w-4 ${
                        account.available 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{account.name}</span>
                        {!account.available && (
                          <span className="text-xs text-red-500">Indisponível</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground font-mono mt-0.5">
                        OTC ID: {account.otcId}
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
