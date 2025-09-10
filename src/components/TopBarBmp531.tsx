import { useState, useEffect } from "react";
import { RefreshCcw, SendHorizontal, DollarSign, Loader2, Lock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bmp531Service, type Bmp531SaldoResponse } from "@/services/bmp531";

export default function TopBarBmp531() {
  const [saldoData, setSaldoData] = useState<Bmp531SaldoResponse | null>(null);
  const [isLoadingSaldo, setIsLoadingSaldo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Os dados de saldo bloqueado já vêm do endpoint de saldo
  console.log('[SALDO DATA] saldoData completa:', saldoData);

  // Função para carregar saldo específico da BMP 531
  const loadSaldoBmp531 = async () => {
    setIsLoadingSaldo(true);
    setError(null);
    
    try {

      
      // ✅ Usar serviço centralizado BMP 531
      const data = await Bmp531Service.getSaldo();
      

      setSaldoData(data);
      
    } catch (error: any) {

      setError(error.message || "Erro ao carregar saldo");
      
      toast.error("Erro ao carregar saldo", {
        description: "Falha ao consultar saldo da conta BMP 531",
        duration: 3000
      });
    } finally {
      setIsLoadingSaldo(false);
    }
  };

  const handleRefresh = async () => {
    await loadSaldoBmp531();
    
    toast.success("Saldo atualizado!", {
      description: "BMP 531 - Saldo atualizado",
      duration: 3000
    });
  };

  // Carregar dados iniciais
  useEffect(() => {
    loadSaldoBmp531();
  }, []);

  const getSaldoDisplay = () => {
    if (isLoadingSaldo) {
      return (
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Carregando...</span>
        </div>
      );
    }
    
    if (error) {
      return "Erro ao carregar";
    }
    
    if (!saldoData) {
      return "R$ 0,00";
    }

    // Processar resposta BMP 531
    if (saldoData && typeof saldoData.saldoDisponivel === 'number') {
      const formatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency', 
        currency: 'BRL'
      }).format(saldoData.saldoDisponivel);
      
      return formatted;
    }

    if (saldoData && typeof saldoData.saldoDisponivel === 'number') {
      const formatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(saldoData.saldoDisponivel);
      
      return formatted;
    }

    return "R$ 0,00";
  };

  // ✅ Função para extrair saldo bloqueado do endpoint de saldo
  const getSaldoBloqueadoFromSaldo = (): number => {
    console.log('[SALDO BLOQUEADO] saldoData:', saldoData);
    return saldoData?.saldoBloqueado || 0;
  };

  // ✅ Função para calcular saldo total (disponível - bloqueado)
  const getSaldoTotalFromSaldo = (): number => {
    console.log('[SALDO TOTAL] saldoData:', saldoData);
    const disponivel = saldoData?.saldoDisponivel || 0;
    const bloqueado = saldoData?.saldoBloqueado || 0;
    return disponivel - bloqueado;
  };

  // ✅ Display do saldo bloqueado
  const getSaldoBloqueadoDisplay = () => {
    if (isLoadingSaldo) {
      return (
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Carregando...</span>
        </div>
      );
    }
    
    const valor = getSaldoBloqueadoFromSaldo();
    const formatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
    
    return formatted;
  };

  // ✅ Display do saldo total
  const getSaldoTotalDisplay = () => {
    if (isLoadingSaldo) {
      return (
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Carregando...</span>
        </div>
      );
    }
    
    const valor = getSaldoTotalFromSaldo();
    const formatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
    
    return formatted;
  };

  const getContaInfo = () => {
    if (saldoData?.dadosConta) {
      return (
        <div className="text-xs text-muted-foreground mt-1">
          <span>Banco {saldoData.dadosConta.banco || "270"}</span>
          <span className="mx-1">•</span>
          <span>Ag: {saldoData.dadosConta.agencia || "****"}</span>
          <span className="mx-1">•</span>
          <span>Conta: {saldoData.dadosConta.conta || "******"}-{saldoData.dadosConta.contaDigito || "*"}</span>
        </div>
      );
    }
    
    return (
      <div className="text-xs text-muted-foreground mt-1">
        <span>BMP 531</span>
        <span className="mx-1">•</span>
        <span>{saldoData?.moeda || 'BRL'}</span>
        <span className="mx-1">•</span>
        <span>{new Date().toLocaleTimeString()}</span>
      </div>
    );
  };

  return (
    <div className="sticky top-0 z-30 bg-tcr-dark/95 backdrop-blur-xl border-b border-border h-auto p-6">
      {/* Header principal */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 shadow-xl">
            <SendHorizontal className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
                                          <h1 className="text-2xl font-bold text-foreground">BMP 531 TCR</h1>
              <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-medium">
                Banco Master
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">Central de transferências PIX</p>
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
            <span className="ml-2 text-sm text-muted-foreground">
              {isLoadingSaldo ? "Atualizando..." : "Atualizar"}
            </span>
          </Button>
        </div>
      </div>

      {/* Cards de saldo - BMP 531 */}
      <div className="w-full max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card: Saldo Atual (do endpoint de saldo) */}
          <div className="bg-gradient-to-br from-card to-muted/20 rounded-2xl p-4 border border-border shadow-lg backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20">
                <DollarSign className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-muted-foreground text-sm">Saldo disponível</p>
                <p className={`font-bold text-lg font-mono mt-1 ${error ? 'text-destructive' : 'text-foreground'}`}>
                  {getSaldoDisplay()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Endpoint Saldo</p>
              </div>
            </div>
          </div>

          {/* Card: Saldo Bloqueado */}
          <div className="bg-gradient-to-br from-card to-muted/20 rounded-2xl p-4 border border-border shadow-lg backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-500/20">
                <Lock className="h-5 w-5 text-red-400" />
              </div>
              <div className="flex-1">
                <p className="text-muted-foreground text-sm">Saldo bloqueado</p>
                <p className="font-bold text-lg font-mono mt-1 text-foreground">
                  {getSaldoBloqueadoDisplay()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Do Extrato</p>
              </div>
            </div>
          </div>

          {/* Card: Saldo Total */}
          <div className="bg-gradient-to-br from-card to-muted/20 rounded-2xl p-4 border border-border shadow-lg backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/20">
                <CheckCircle className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-muted-foreground text-sm">Saldo total</p>
                <p className="font-bold text-lg font-mono mt-1 text-foreground">
                  {getSaldoTotalDisplay()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Disponível - Bloqueado</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Informações da conta */}
        <div className="mt-4 text-center">
          {getContaInfo()}
        </div>
      </div>
    </div>
  );
}
