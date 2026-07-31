import { useState, useEffect } from "react";
import { CheckCircle, FileText, Lock } from "lucide-react";
import { useNtxRealtime } from "@/hooks/useNtxRealtime";
import { getNtxBalance } from "@/services/ntx-realtime";
import { PROVIDER_THEMES } from "@/config/provider-theme";
import ProviderTopBar from "@/components/provider/ProviderTopBar";

const NTX_THEME = PROVIDER_THEMES.ntx;

export default function TopBarNtxTcr() {
  // Sem WebSocket na NTX (stub) — indicador fica Offline, refresh é manual
  const { isConnected, isReconnecting } = useNtxRealtime();
  // Valores em REAIS direto da API (a NTX NÃO é centavos — não dividir por 100)
  const [balanceData, setBalanceData] = useState({ net: '0', gross: '0', blocked: '0' });
  const [isLoadingSaldo, setIsLoadingSaldo] = useState(false);
  const [errorSaldo, setErrorSaldo] = useState<string | null>(null);

  const fetchSaldo = async () => {
    setIsLoadingSaldo(true);
    setErrorSaldo(null);

    try {
      const balance = await getNtxBalance();
      setBalanceData({
        net: (balance.netBalance ?? 0).toFixed(2),
        gross: (balance.grossBalance ?? 0).toFixed(2),
        blocked: (balance.blockedBalance ?? 0).toFixed(2),
      });
    } catch (err: any) {
      setErrorSaldo(err.message || 'Erro ao consultar saldo');
    } finally {
      setIsLoadingSaldo(false);
    }
  };

  useEffect(() => {
    fetchSaldo();
  }, []);

  return (
    <ProviderTopBar
      theme={NTX_THEME}
      title="NTX Pay → TCR"
      subtitle="Saldo e extrato da conta NTX Pay da TCR"
      isConnected={isConnected}
      isReconnecting={isReconnecting}
      loading={isLoadingSaldo}
      error={errorSaldo}
      onRefresh={fetchSaldo}
      cards={[
        { label: 'Saldo Líquido', icon: <CheckCircle className="h-[18px] w-[18px]" />, value: balanceData.net, color: 'rgb(56,209,0)' },
        { label: 'Saldo Bruto', icon: <FileText className="h-[18px] w-[18px]" />, value: balanceData.gross, color: 'rgb(0,105,209)' },
        { label: 'Bloqueado', icon: <Lock className="h-[18px] w-[18px]" />, value: balanceData.blocked, color: 'rgb(184,0,0)' },
      ]}
    />
  );
}
