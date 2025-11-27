import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Loader2, Wifi, WifiOff, CheckCircle, AlertCircle, FileText, Banknote, Lock, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useRevyRealtime } from "@/hooks/useRevyRealtime";
import AnimatedBalance from "@/components/AnimatedBalance";
import { fetchRevyTransactions } from "@/services/revy";

// Constantes para IP Revy TCR
const IP_REVY_TENANT_ID = 2;
const IP_REVY_ACCOUNT_ID = 26; // TODO: Confirmar accountId correto para TCR

export default function TopBarIpRevyTcr() {
  // WebSocket para IP Revy TCR
  const { isConnected, isReconnecting } = useRevyRealtime({
    tenantId: IP_REVY_TENANT_ID,
  });

  const [balanceData, setBalanceData] = useState({
    currency: 'BRL',
    total: '0',
    available: '0',
    locked: '0',
    pendingDeposit: '0',
    pendingWithdrawal: '0'
  });
  const [totalTransacoes, setTotalTransacoes] = useState<number>(0);
  const [isLoadingSaldo, setIsLoadingSaldo] = useState(false);
  const [errorSaldo, setErrorSaldo] = useState<string | null>(null);

  // Buscar saldo do último registro da API de extrato
  const fetchSaldo = async () => {
    setIsLoadingSaldo(true);
    setErrorSaldo(null);
    
    try {
      // ✅ Buscar SEM accountId para garantir que todos os postings sejam retornados
      // A LIQUIDITY_POOL sempre tem accountId "35" para TCR
      const response = await fetchRevyTransactions({
        tenantId: IP_REVY_TENANT_ID,
        // accountId: IP_REVY_ACCOUNT_ID, // Removido para garantir que todos os postings sejam retornados
        limit: 1,
        offset: 0,
        includePostings: true,
      });
      
      console.log('[IP-REVY-TCR] Resposta completa:', response);
      
      if (response?.data && response.data.length > 0) {
        const firstTransaction = response.data[0];
        
        console.log('[IP-REVY-TCR] Primeira transação:', {
          id: firstTransaction.id,
          journalType: firstTransaction.journalType || firstTransaction.type,
          postingsCount: firstTransaction.postings?.length,
          postings: firstTransaction.postings
        });
        
        // ✅ Buscar o posting da LIQUIDITY_POOL da última transação
        // Pode ser accountId "35" OU accountType "LIQUIDITY_POOL"
        const liquidityPoolPosting = firstTransaction.postings?.find(
          (p: any) => 
            p.account?.accountType === 'LIQUIDITY_POOL' || 
            p.accountId === '35' ||
            (p.account?.id === '35' && p.account?.accountType === 'LIQUIDITY_POOL')
        );
        
        // Debug: log para verificar estrutura
        if (!liquidityPoolPosting) {
          console.log('[IP-REVY-TCR] Postings disponíveis:', firstTransaction.postings?.map((p: any) => ({
            accountId: p.accountId,
            accountType: p.account?.accountType,
            accountIdFromAccount: p.account?.id,
            balance: p.account?.balance
          })));
        }
        
        if (liquidityPoolPosting?.account?.balance !== undefined && liquidityPoolPosting?.account?.balance !== null) {
          const balanceStr = String(liquidityPoolPosting.account.balance);
          const balance = parseFloat(balanceStr);
          const currency = liquidityPoolPosting.account.currency || 'BRL';
          
          console.log('[IP-REVY-TCR] ✅ Balance encontrado:', {
            balanceStr,
            balance,
            currency,
            accountId: liquidityPoolPosting.accountId,
            accountIdFromAccount: liquidityPoolPosting.account?.id,
            accountType: liquidityPoolPosting.account?.accountType
          });
          
          if (!isNaN(balance)) {
            setBalanceData({
              currency: currency,
              total: String(Math.abs(balance)),
              available: String(Math.abs(balance)),
              locked: '0',
              pendingDeposit: '0',
              pendingWithdrawal: '0'
            });
            setErrorSaldo(null); // Limpar erro se encontrou
          } else {
            console.warn('[IP-REVY-TCR] Balance inválido:', liquidityPoolPosting.account.balance);
            setErrorSaldo('Balance inválido na resposta da API');
          }
        } else {
          console.warn('[IP-REVY-TCR] Posting da LIQUIDITY_POOL não encontrado na transação:', {
            transactionId: firstTransaction.id,
            postingsCount: firstTransaction.postings?.length,
            postings: firstTransaction.postings
          });
          setErrorSaldo('Posting da LIQUIDITY_POOL não encontrado');
        }
        
        // Total de transações
        setTotalTransacoes(response.pagination?.total || response.total || 0);
      } else {
        // Se não houver transações, inicializar com zero
        setBalanceData({
          currency: 'BRL',
          total: '0',
          available: '0',
          locked: '0',
          pendingDeposit: '0',
          pendingWithdrawal: '0'
        });
        setTotalTransacoes(0);
      }
    } catch (err: any) {
      setErrorSaldo(err.message || 'Erro ao consultar saldo');
    } finally {
      setIsLoadingSaldo(false);
    }
  };

  // Carregar saldo ao montar
  useEffect(() => {
    fetchSaldo();
  }, []);

  const handleRefresh = () => {
    fetchSaldo();
  };

  const parseValue = (value: string): number => {
    const numValue = parseFloat(value);
    return isNaN(numValue) ? 0 : numValue;
  };

  const getStatusIcon = () => {
    if (isLoadingSaldo) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    if (errorSaldo) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  return (
    <div className="sticky top-0 z-30 bg-background border-b border-border h-auto p-6">
      {/* Header principal */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[#9333ea] shadow-xl">
            <Banknote className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <Banknote className="h-5 w-5 text-[#9333ea]" />
              <h1 className="text-2xl font-bold text-foreground">IP Revy</h1>
              <Badge className="bg-[rgba(147,51,234,0.2)] text-[#9333ea] border-[rgba(147,51,234,0.4)] text-xs font-medium">
                Banking
              </Badge>
              {getStatusIcon()}
              {/* Status WebSocket com estado de reconexão */}
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-md">
                    <Wifi className="h-3 w-3" />
                    <span className="text-xs font-medium">Tempo Real</span>
                  </div>
                ) : isReconnecting ? (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-xs font-medium">Reconectando...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 text-gray-600 border border-gray-200 rounded-md">
                    <WifiOff className="h-3 w-3" />
                    <span className="text-xs font-medium">Offline</span>
                  </div>
                )}
              </div>
            </div>
            <p className="text-muted-foreground text-sm">
              Central de transferências PIX {isConnected && '• Atualizações em tempo real'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleRefresh}
            disabled={isLoadingSaldo}
            className="hover:bg-muted rounded-xl"
          >
            {isLoadingSaldo ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <RefreshCcw className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="ml-2 text-sm">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Cards lado a lado - 5 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
        {/* Card 1: Total */}
        <div className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-[18px] w-[18px] text-[rgb(0,105,209)] group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">Total</span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-[rgb(0,105,209)] mt-1 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(balanceData.total)} /></div>
            )}
          </div>
        </div>

        {/* Card 2: Available */}
        <div className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-[18px] w-[18px] text-[rgb(56,209,0)] group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">Disponível</span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-[rgb(56,209,0)] mt-1 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(balanceData.available)} /></div>
            )}
          </div>
        </div>

        {/* Card 3: Locked */}
        <div className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="h-[18px] w-[18px] text-[rgb(184,0,0)] group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">Bloqueado</span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-[rgb(184,0,0)] mt-1 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(balanceData.locked)} /></div>
            )}
          </div>
        </div>

        {/* Card 4: Pending Deposit */}
        <div className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownCircle className="h-[18px] w-[18px] text-[#9333ea] group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">Depósito Pendente</span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-[#9333ea] mt-1 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(balanceData.pendingDeposit)} /></div>
            )}
          </div>
        </div>

        {/* Card 5: Pending Withdrawal */}
        <div className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpCircle className="h-[18px] w-[18px] text-[#9333ea] group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">Saque Pendente</span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-[#9333ea] mt-1 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(balanceData.pendingWithdrawal)} /></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
