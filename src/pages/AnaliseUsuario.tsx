/**
 * 📊 Página de Análise Detalhada do Usuário BRBTC
 * 
 * Tela completa para análise de todas as movimentações de um usuário específico.
 * Exibe dashboard, filtros, tabelas e gráficos de forma organizada e responsiva.
 */

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ArrowLeft, 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Bitcoin, 
  Repeat, 
  Download,
  Calendar,
  Filter,
  Search,
  RefreshCw,
  User,
  Activity,
  PieChart,
  LineChart,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  Construction,
  ExternalLink,
  Copy,
  Eye
} from "lucide-react";
import { toast } from "sonner";
import { 
  getAllUserData,
  type CryptoDepositsResponse,
  type CryptoWithdrawsResponse,
  type TradesResponse,
  type FiatDepositsResponse,
  type FiatWithdrawsResponse,
  type InternalDepositsResponse,
  type InternalWithdrawsResponse
} from "@/services/brbtcAnalise";

interface AnaliseUsuarioParams extends Record<string, string> {
  id: string;
}

// ============================== UTILITÁRIOS ==============================

/**
 * Formatar timestamp unix para data legível
 */
const formatarData = (timestamp: number | undefined | null): string => {
  // ✅ CORREÇÃO: Verificar se timestamp existe e é válido
  if (!timestamp || isNaN(timestamp)) {
    return new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  return new Date(timestamp * 1000).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Formatar valor monetário
 */
const formatarValor = (valor: string | number | undefined | null, moeda: string = 'BRL'): string => {
  // ✅ CORREÇÃO: Verificar se valor existe antes de processar
  if (valor === undefined || valor === null || valor === '') {
    return moeda === 'BRL' ? 'R$ 0,00' : '0';
  }
  
  const num = typeof valor === 'string' ? parseFloat(valor) : valor;
  
  // ✅ CORREÇÃO: Verificar se a conversão foi válida
  if (isNaN(num)) {
    return moeda === 'BRL' ? 'R$ 0,00' : '0';
  }
  
  if (moeda === 'BRL') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(num);
  }
  return `${num} ${moeda}`;
};

/**
 * Obter badge de status
 */
const getStatusBadge = (status: string | undefined | null) => {
  // ✅ CORREÇÃO: Verificar se status existe antes de usar
  if (!status) {
    return (
      <Badge variant="outline" className="bg-gray-500/20 text-gray-800">
        N/A
      </Badge>
    );
  }

  const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", color: string }> = {
    'credited': { variant: "default", color: "bg-green-500/100/20 text-green-400" },
    'sent': { variant: "default", color: "bg-blue-500/100/20 text-blue-400" },
    'filled': { variant: "default", color: "bg-green-500/100/20 text-green-400" },
    'pending': { variant: "secondary", color: "bg-yellow-500/20 text-yellow-400" },
    'cancelled': { variant: "destructive", color: "bg-red-500/100/20 text-red-400" },
    'failed': { variant: "destructive", color: "bg-red-500/100/20 text-red-400" }
  };

  const config = statusMap[status.toLowerCase()] || { variant: "outline" as const, color: "bg-gray-500/20 text-gray-400" };
  
  return (
    <Badge variant={config.variant} className={config.color}>
      {status}
    </Badge>
  );
};

/**
 * Copiar texto para clipboard
 */
const copiarTexto = (texto: string, label: string = 'Texto') => {
  navigator.clipboard.writeText(texto);
  toast.success(`${label} copiado!`);
};

// ============================== FUNÇÕES DE EXPORTAÇÃO ==============================

/**
 * 🇧🇷 Formatar valor para CSV brasileiro (vírgula como decimal)
 */
const formatarValorCSV = (valor: string | number | undefined | null): string => {
  if (valor === undefined || valor === null || valor === '') return '0,00';
  
  const num = typeof valor === 'string' ? parseFloat(valor) : valor;
  if (isNaN(num)) return '0,00';
  
  return num.toFixed(2).replace('.', ',');
};

/**
 * 🇧🇷 Formatar data para CSV brasileiro (dd/mm/aaaa hh:mm)
 */
const formatarDataCSV = (timestamp: number | undefined | null): string => {
  if (!timestamp || isNaN(timestamp)) {
    return new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  return new Date(timestamp * 1000).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * 🇧🇷 Escapar texto para CSV (aspas duplas e quebras de linha)
 */
const escaparTextoCSV = (texto: string | undefined | null): string => {
  if (!texto) return '';
  
  // Substituir aspas duplas por aspas duplas escapadas e envolver em aspas se necessário
  const textoLimpo = texto.toString().replace(/"/g, '""');
  
  // Se contém vírgula, ponto e vírgula, quebra de linha ou aspas, envolver em aspas
  if (textoLimpo.includes(',') || textoLimpo.includes(';') || textoLimpo.includes('\n') || textoLimpo.includes('"')) {
    return `"${textoLimpo}"`;
  }
  
  return textoLimpo;
};

/**
 * 📊 Converter array de objetos para CSV brasileiro
 */
const converterParaCSV = (dados: any[], headers: string[]): string => {
  if (!dados || dados.length === 0) return headers.join(';') + '\n';
  
  const csvHeaders = headers.join(';');
  const csvRows = dados.map(item => 
    headers.map(header => {
      const valor = item[header] || '';
      return escaparTextoCSV(valor.toString());
    }).join(';')
  );
  
  return [csvHeaders, ...csvRows].join('\n');
};

/**
 * 💾 Gerar e fazer download do arquivo CSV
 */
const baixarCSV = (conteudo: string, nomeArquivo: string) => {
  // Adicionar BOM para UTF-8 (necessário para acentos no Excel)
  const BOM = '\uFEFF';
  const csvComBOM = BOM + conteudo;
  
  const blob = new Blob([csvComBOM], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', nomeArquivo);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

export default function AnaliseUsuario() {
  const { id } = useParams<AnaliseUsuarioParams>();
  const navigate = useNavigate();
  const [idUsuarioAtual, setIdUsuarioAtual] = useState<number>(parseInt(id || '32', 10));
  const [inputIdUsuario, setInputIdUsuario] = useState<string>(id || '32');

  // Estados principais
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [filtros, setFiltros] = useState({
    max_records: 100,
    startDate: '',
    endDate: ''
  });
  
  // Estados para dados brutos (sem filtro) e filtrados
  const [dadosBrutos, setDadosBrutos] = useState<any>(null);

  // Estados dos dados
  const [dadosUsuario, setDadosUsuario] = useState<{
    cryptoDeposits: CryptoDepositsResponse | null;
    cryptoWithdraws: CryptoWithdrawsResponse | null;
    trades: TradesResponse | null;
    fiatDeposits: FiatDepositsResponse | null;
    fiatWithdraws: FiatWithdrawsResponse | null;
    internalDeposits: InternalDepositsResponse | null;
    internalWithdraws: InternalWithdrawsResponse | null;
    errors: any[];
  } | null>(null);

  // ============================== CÁLCULOS FINANCEIROS ==============================

  /**
   * 💰 Calcular totais financeiros DETALHADOS por categoria e moeda
   */
  const calcularTotaisFinanceiros = () => {
    if (!dadosUsuario) return null;

    // ===== ANÁLISE DE CRYPTO DEPOSITS POR MOEDA =====
    const depositosCrypto = dadosUsuario.cryptoDeposits?.dados?.depositos || [];
    const depositosCryptoPorMoeda = {
      BRL: 0,
      USDT: 0,
      BTC: 0,
      ETH: 0,
      outros: 0,
      count: depositosCrypto.length
    };

    depositosCrypto.forEach(dep => {
      const valor = parseFloat(dep.amount || '0');
      const moeda = (dep.coin || '').toUpperCase();
      
      if (!isNaN(valor)) {
        if (moeda === 'BRL') depositosCryptoPorMoeda.BRL += valor;
        else if (moeda === 'USDT') depositosCryptoPorMoeda.USDT += valor;
        else if (moeda === 'BTC') depositosCryptoPorMoeda.BTC += valor;
        else if (moeda === 'ETH') depositosCryptoPorMoeda.ETH += valor;
        else depositosCryptoPorMoeda.outros += valor;
      }
    });

    // ===== ANÁLISE DE CRYPTO WITHDRAWS POR MOEDA =====
    const saquesCrypto = dadosUsuario.cryptoWithdraws?.dados?.saques || [];
    const saquesCryptoPorMoeda = {
      BRL: 0,
      USDT: 0,
      BTC: 0,
      ETH: 0,
      outros: 0,
      count: saquesCrypto.length
    };

    saquesCrypto.forEach(saque => {
      const valor = parseFloat(saque.amount || '0');
      const moeda = (saque.coin || '').toUpperCase();
      
      if (!isNaN(valor)) {
        if (moeda === 'BRL') saquesCryptoPorMoeda.BRL += valor;
        else if (moeda === 'USDT') saquesCryptoPorMoeda.USDT += valor;
        else if (moeda === 'BTC') saquesCryptoPorMoeda.BTC += valor;
        else if (moeda === 'ETH') saquesCryptoPorMoeda.ETH += valor;
        else saquesCryptoPorMoeda.outros += valor;
      }
    });

    // ===== ANÁLISE DETALHADA DE TRADES (CORRIGIDA) =====
    const trades = dadosUsuario.trades?.dados?.trades || [];
    const tradesDetalhado = {
      // Totais gerais (sempre em BRL - moeda base)
      volumeTotal: 0,
      totalCompras: 0, // BRL gasto comprando crypto
      totalVendas: 0,  // BRL recebido vendendo crypto
      count: trades.length,
      
      // Por tipo de crypto negociada
      pares: {} as Record<string, { 
        compras: number,    // BRL gasto comprando esta crypto
        vendas: number,     // BRL recebido vendendo esta crypto  
        volume: number,     // Volume total BRL deste par
        countCompras: number,
        countVendas: number,
        cryptoComprada: number,  // Quantidade de crypto comprada
        cryptoVendida: number    // Quantidade de crypto vendida
      }>
    };

    trades.forEach(trade => {
      const valorBRL = parseFloat(trade.total || '0');       // Sempre em BRL
      const quantidadeCrypto = parseFloat(trade.amount || '0'); // Quantidade da crypto
      const par = trade.pair || '';
      const tipo = trade.side; // buy = comprou crypto, sell = vendeu crypto
      
      if (!isNaN(valorBRL)) {
        tradesDetalhado.volumeTotal += valorBRL;
        
        // Lógica corrigida baseada nos dados reais:
        if (tipo === 'buy') {
          // COMPROU crypto com BRL (saída de BRL)
          tradesDetalhado.totalCompras += valorBRL;
        } else if (tipo === 'sell') {
          // VENDEU crypto por BRL (entrada de BRL)
          tradesDetalhado.totalVendas += valorBRL;
        }

        // Agrupar por par de moedas
        if (!tradesDetalhado.pares[par]) {
          tradesDetalhado.pares[par] = { 
            compras: 0, 
            vendas: 0, 
            volume: 0, 
            countCompras: 0, 
            countVendas: 0,
            cryptoComprada: 0,
            cryptoVendida: 0
          };
        }
        
        if (tipo === 'buy') {
          tradesDetalhado.pares[par].compras += valorBRL;
          tradesDetalhado.pares[par].countCompras++;
          tradesDetalhado.pares[par].cryptoComprada += quantidadeCrypto;
        } else if (tipo === 'sell') {
          tradesDetalhado.pares[par].vendas += valorBRL;
          tradesDetalhado.pares[par].countVendas++;
          tradesDetalhado.pares[par].cryptoVendida += quantidadeCrypto;
        }
        
        tradesDetalhado.pares[par].volume += valorBRL;
      }
    });

    // ===== DEPÓSITOS FIAT (apenas BRL) =====
    const depositosFiat = dadosUsuario.fiatDeposits?.dados?.depositos || [];
    const totalDepositosFiat = depositosFiat.reduce((acc, dep) => {
      const valor = parseFloat(dep.value || '0');
      return acc + (isNaN(valor) ? 0 : valor);
    }, 0);

    // ===== SAQUES FIAT (apenas BRL) =====
    const saquesFiat = dadosUsuario.fiatWithdraws?.dados?.saques || [];
    const totalSaquesFiat = saquesFiat.reduce((acc, saque) => {
      const valor = parseFloat(saque.value || '0');
      return acc + (isNaN(valor) ? 0 : valor);
    }, 0);

    // ===== TRANSFERÊNCIAS INTERNAS RECEBIDAS =====
    const transferenciasRecebidas = dadosUsuario.internalDeposits?.dados?.depositos || [];
    const totalTransferenciasRecebidas = transferenciasRecebidas.reduce((acc, trans) => {
      const valor = parseFloat(trans.amount || '0');
      return acc + (isNaN(valor) ? 0 : valor);
    }, 0);

    // ===== TRANSFERÊNCIAS INTERNAS ENVIADAS =====
    const transferenciasEnviadas = dadosUsuario.internalWithdraws?.dados?.saques || [];
    const totalTransferenciasEnviadas = transferenciasEnviadas.reduce((acc, trans) => {
      const valor = parseFloat(trans.amount || '0');
      return acc + (isNaN(valor) ? 0 : valor);
    }, 0);

    // ===== BALANÇOS CORRIGIDOS (APENAS BRL) =====
    
    // Balanço BRL (TODAS as operações são em BRL)
    const entradasBRL = totalDepositosFiat + totalTransferenciasRecebidas + tradesDetalhado.totalVendas; // Depósitos fiat + transferências recebidas + vendas de crypto
    const saidasBRL = totalSaquesFiat + totalTransferenciasEnviadas + tradesDetalhado.totalCompras; // Saques fiat + transferências enviadas + compras de crypto
    const balancoBRL = entradasBRL - saidasBRL;

    // Balanço Geral (igual ao BRL, já que tudo é BRL)
    const totalEntradas = entradasBRL;
    const totalSaidas = saidasBRL;
    const saldoLiquido = balancoBRL;
    const volumeTotal = tradesDetalhado.volumeTotal + totalDepositosFiat + totalSaquesFiat + totalTransferenciasRecebidas + totalTransferenciasEnviadas;

    // Estatísticas dos pares mais negociados
    const paresEstatisticas = Object.entries(tradesDetalhado.pares)
      .map(([par, dados]) => ({
        par,
        ...dados,
        saldoCrypto: dados.cryptoComprada - dados.cryptoVendida, // Saldo líquido da crypto
        saldoBRL: dados.vendas - dados.compras // Saldo líquido em BRL deste par
      }))
      .sort((a, b) => b.volume - a.volume); // Ordenar por volume decrescente

    // ===== BALANÇO FINANCEIRO GERAL COM JUSTIFICATIVAS =====
    
    // 💰 SALDO REAL EM BRL
    const saldoRealBRL = {
      // Entradas de BRL
      depositosFiat: totalDepositosFiat,
      transferenciasRecebidas: totalTransferenciasRecebidas,
      vendasCrypto: tradesDetalhado.totalVendas,
      totalEntradas: totalDepositosFiat + totalTransferenciasRecebidas + tradesDetalhado.totalVendas,
      
      // Saídas de BRL
      saquesFiat: totalSaquesFiat,
      transferenciasEnviadas: totalTransferenciasEnviadas,
      comprasCrypto: tradesDetalhado.totalCompras,
      totalSaidas: totalSaquesFiat + totalTransferenciasEnviadas + tradesDetalhado.totalCompras,
      
      // Saldo final
      saldoFinal: (totalDepositosFiat + totalTransferenciasRecebidas + tradesDetalhado.totalVendas) - (totalSaquesFiat + totalTransferenciasEnviadas + tradesDetalhado.totalCompras)
    };

    // 💎 SALDO REAL EM CRYPTO (por moeda)
    const saldoRealCrypto = {
      USDT: {
        deposits: depositosCryptoPorMoeda.USDT,
        withdraws: saquesCryptoPorMoeda.USDT,
        comprado: paresEstatisticas.find(p => p.par === 'USDTBRL')?.cryptoComprada || 0,
        vendido: paresEstatisticas.find(p => p.par === 'USDTBRL')?.cryptoVendida || 0,
        saldo: (depositosCryptoPorMoeda.USDT + (paresEstatisticas.find(p => p.par === 'USDTBRL')?.cryptoComprada || 0)) - 
               (saquesCryptoPorMoeda.USDT + (paresEstatisticas.find(p => p.par === 'USDTBRL')?.cryptoVendida || 0))
      },
      BTC: {
        deposits: depositosCryptoPorMoeda.BTC,
        withdraws: saquesCryptoPorMoeda.BTC,
        comprado: paresEstatisticas.find(p => p.par.includes('BTC'))?.cryptoComprada || 0,
        vendido: paresEstatisticas.find(p => p.par.includes('BTC'))?.cryptoVendida || 0,
        saldo: (depositosCryptoPorMoeda.BTC + (paresEstatisticas.find(p => p.par.includes('BTC'))?.cryptoComprada || 0)) - 
               (saquesCryptoPorMoeda.BTC + (paresEstatisticas.find(p => p.par.includes('BTC'))?.cryptoVendida || 0))
      },
      ETH: {
        deposits: depositosCryptoPorMoeda.ETH,
        withdraws: saquesCryptoPorMoeda.ETH,
        comprado: paresEstatisticas.find(p => p.par.includes('ETH'))?.cryptoComprada || 0,
        vendido: paresEstatisticas.find(p => p.par.includes('ETH'))?.cryptoVendida || 0,
        saldo: (depositosCryptoPorMoeda.ETH + (paresEstatisticas.find(p => p.par.includes('ETH'))?.cryptoComprada || 0)) - 
               (saquesCryptoPorMoeda.ETH + (paresEstatisticas.find(p => p.par.includes('ETH'))?.cryptoVendida || 0))
      }
    };

    return {
      // Depósitos crypto detalhados
      cryptoDeposits: depositosCryptoPorMoeda,
      
      // Saques crypto detalhados
      cryptoWithdraws: saquesCryptoPorMoeda,
      
      // Trades detalhados (corrigido)
      trades: tradesDetalhado,
      
      // Estatísticas dos pares negociados
      paresEstatisticas,
      
      // Depósitos/Saques fiat
      fiatDeposits: {
        total: totalDepositosFiat,
        count: depositosFiat.length
      },
      fiatWithdraws: {
        total: totalSaquesFiat,
        count: saquesFiat.length
      },
      
      // Transferências (recebidas)
      internalTransfers: {
        total: totalTransferenciasRecebidas,
        count: transferenciasRecebidas.length
      },
      
      // Transferências (enviadas)
      internalWithdraws: {
        total: totalTransferenciasEnviadas,
        count: transferenciasEnviadas.length
      },
      
      // Balanços corrigidos (apenas BRL, já que todos os trades são contra BRL)
      balances: {
        BRL: {
          entradas: entradasBRL,
          saidas: saidasBRL,
          saldo: balancoBRL
        },
        geral: {
          totalEntradas,
          totalSaidas,
          saldoLiquido,
          volumeTotal
        }
      },
      
      // ✅ NOVO: Saldos Reais com Justificativas
      saldosReais: {
        BRL: saldoRealBRL,
        crypto: saldoRealCrypto
      }
    };
  };

  // Calcular totais sempre que os dados mudarem
  const totaisFinanceiros = calcularTotaisFinanceiros();

  // 🚀 FUNÇÃO REVOLUCIONÁRIA: Extrato Cronológico Completo com Saldo Anterior/Posterior
  const handleExportar = () => {
    if (!dadosUsuario) {
      toast.error('Nenhum dado para exportar', {
        description: 'Carregue os dados do usuário primeiro'
      });
      return;
    }

    toast.info('Gerando extrato cronológico...', {
      description: 'Preparando extrato completo com evolução de saldo'
    });

    try {
      // ===== PASSO 1: COLETAR TODAS AS MOVIMENTAÇÕES =====
      interface MovimentacaoUnificada {
        timestamp: number;
        data: string;
        hora: string;
        tipo: string;
        descricao: string;
        entrada: number;  // Valores positivos (soma ao saldo)
        saida: number;    // Valores negativos (subtrai do saldo)
        moeda: string;
        detalhes: string;
      }

      const todasMovimentacoes: MovimentacaoUnificada[] = [];

      // 1. CRYPTO DEPOSITS
      dadosUsuario.cryptoDeposits?.dados?.depositos?.forEach(dep => {
        todasMovimentacoes.push({
          timestamp: dep.timestamp || 0,
          data: formatarDataCSV(dep.timestamp).split(' ')[0],
          hora: formatarDataCSV(dep.timestamp).split(' ')[1] || '',
          tipo: 'Depósito Crypto',
          descricao: `Depósito de ${dep.coin?.toUpperCase() || 'CRYPTO'}`,
          entrada: parseFloat(dep.amount || '0'),
          saida: 0,
          moeda: dep.coin?.toUpperCase() || 'CRYPTO',
          detalhes: `Status: ${dep.status || 'N/A'}`
        });
      });

      // 2. CRYPTO WITHDRAWS
      dadosUsuario.cryptoWithdraws?.dados?.saques?.forEach(saque => {
        todasMovimentacoes.push({
          timestamp: saque.timestamp || 0,
          data: formatarDataCSV(saque.timestamp).split(' ')[0],
          hora: formatarDataCSV(saque.timestamp).split(' ')[1] || '',
          tipo: 'Saque Crypto',
          descricao: `Saque de ${saque.coin?.toUpperCase() || 'CRYPTO'}`,
          entrada: 0,
          saida: parseFloat(saque.amount || '0'),
          moeda: saque.coin?.toUpperCase() || 'CRYPTO',
          detalhes: `Status: ${saque.status || 'N/A'}`
        });
      });

      // 3. TRADES
      dadosUsuario.trades?.dados?.trades?.forEach(trade => {
        const isBuy = trade.side === 'buy';
        todasMovimentacoes.push({
          timestamp: trade.timestamp || 0,
          data: formatarDataCSV(trade.timestamp).split(' ')[0],
          hora: formatarDataCSV(trade.timestamp).split(' ')[1] || '',
          tipo: isBuy ? 'Compra Crypto' : 'Venda Crypto',
          descricao: `${isBuy ? 'Comprou' : 'Vendeu'} ${trade.pair || 'CRYPTO'}`,
          entrada: isBuy ? 0 : parseFloat(trade.total || '0'),  // Venda = entrada de BRL
          saida: isBuy ? parseFloat(trade.total || '0') : 0,    // Compra = saída de BRL
          moeda: 'BRL',
          detalhes: `${trade.amount || '0'} ${trade.pair?.split('BRL')[0] || ''} | Status: ${trade.status || 'N/A'}`
        });
      });

      // 4. FIAT DEPOSITS
      dadosUsuario.fiatDeposits?.dados?.depositos?.forEach(dep => {
        todasMovimentacoes.push({
          timestamp: dep.timestamp || 0,
          data: formatarDataCSV(dep.timestamp).split(' ')[0],
          hora: formatarDataCSV(dep.timestamp).split(' ')[1] || '',
          tipo: 'Depósito Fiat',
          descricao: `Depósito BRL via ${dep.bank || 'Banco'}`,
          entrada: parseFloat(dep.value || '0'),
          saida: 0,
          moeda: 'BRL',
          detalhes: `Status: ${dep.status || 'N/A'}`
        });
      });

      // 5. FIAT WITHDRAWS
      dadosUsuario.fiatWithdraws?.dados?.saques?.forEach(saque => {
        todasMovimentacoes.push({
          timestamp: saque.timestamp || 0,
          data: formatarDataCSV(saque.timestamp).split(' ')[0],
          hora: formatarDataCSV(saque.timestamp).split(' ')[1] || '',
          tipo: 'Saque Fiat',
          descricao: `Saque BRL para ${saque.bank || 'Banco'}`,
          entrada: 0,
          saida: parseFloat(saque.value || '0'),
          moeda: 'BRL',
          detalhes: `Status: ${saque.status || 'N/A'}`
        });
      });

      // 6. TRANSFERÊNCIAS INTERNAS RECEBIDAS
      dadosUsuario.internalDeposits?.dados?.depositos?.forEach(trans => {
        todasMovimentacoes.push({
          timestamp: trans.timestamp || 0,
          data: formatarDataCSV(trans.timestamp).split(' ')[0],
          hora: formatarDataCSV(trans.timestamp).split(' ')[1] || '',
          tipo: 'Transferência Recebida',
          descricao: `Recebeu ${trans.coin?.toUpperCase() || 'BRL'} de outro usuário`,
          entrada: parseFloat(trans.amount || '0'),
          saida: 0,
          moeda: trans.coin?.toUpperCase() || 'BRL',
          detalhes: `De: ${trans.fromUserDocument || 'N/A'}`
        });
      });

      // 7. TRANSFERÊNCIAS INTERNAS ENVIADAS
      dadosUsuario.internalWithdraws?.dados?.saques?.forEach(trans => {
        todasMovimentacoes.push({
          timestamp: trans.timestamp || 0,
          data: formatarDataCSV(trans.timestamp).split(' ')[0],
          hora: formatarDataCSV(trans.timestamp).split(' ')[1] || '',
          tipo: 'Transferência Enviada',
          descricao: `Enviou ${trans.coin?.toUpperCase() || 'BRL'} para outro usuário`,
          entrada: 0,
          saida: parseFloat(trans.amount || '0'),
          moeda: trans.coin?.toUpperCase() || 'BRL',
          detalhes: `Para: ${trans.toUserDocument || 'N/A'}`
        });
      });

      // ===== PASSO 2: ORDENAR CRONOLOGICAMENTE =====
      todasMovimentacoes.sort((a, b) => a.timestamp - b.timestamp); // Mais antiga primeiro

      // ===== PASSO 3: CALCULAR SALDOS ANTERIOR E POSTERIOR =====
      let saldoBRL = 0;
      let saldoUSDT = 0;
      let saldoBTC = 0;
      let saldoETH = 0;

      const movimentacoesComSaldo = todasMovimentacoes.map(mov => {
        // Saldo ANTERIOR (antes da operação)
        const saldoAnteriorBRL = saldoBRL;
        const saldoAnteriorUSDT = saldoUSDT;
        const saldoAnteriorBTC = saldoBTC;
        const saldoAnteriorETH = saldoETH;

        // Aplicar a movimentação aos saldos
        if (mov.moeda === 'BRL') {
          saldoBRL += mov.entrada - mov.saida;
        } else if (mov.moeda === 'USDT') {
          saldoUSDT += mov.entrada - mov.saida;
        } else if (mov.moeda === 'BTC') {
          saldoBTC += mov.entrada - mov.saida;
        } else if (mov.moeda === 'ETH') {
          saldoETH += mov.entrada - mov.saida;
        }

        // Saldo POSTERIOR (depois da operação)
        const saldoPosteriorBRL = saldoBRL;
        const saldoPosteriorUSDT = saldoUSDT;
        const saldoPosteriorBTC = saldoBTC;
        const saldoPosteriorETH = saldoETH;

        return {
          ...mov,
          saldoAnterior: mov.moeda === 'BRL' ? saldoAnteriorBRL : 
                        mov.moeda === 'USDT' ? saldoAnteriorUSDT :
                        mov.moeda === 'BTC' ? saldoAnteriorBTC : saldoAnteriorETH,
          saldoPosterior: mov.moeda === 'BRL' ? saldoPosteriorBRL : 
                         mov.moeda === 'USDT' ? saldoPosteriorUSDT :
                         mov.moeda === 'BTC' ? saldoPosteriorBTC : saldoPosteriorETH
        };
      });

      // ===== PASSO 4: GERAR CSV CRONOLÓGICO =====
      let csvCompleto = '';
      const dataExportacao = new Date().toLocaleString('pt-BR');
      
      // ===== CABEÇALHO DO EXTRATO CRONOLÓGICO =====
      csvCompleto += `╔══════════════════════════════════════════════════════════════════════════════╗\n`;
      csvCompleto += `║  EXTRATO CRONOLÓGICO COMPLETO - SISTEMA BRBTC                              ║\n`;
      csvCompleto += `║  🚀 Todas as movimentações ordenadas por data/hora                        ║\n`;
      csvCompleto += `╚══════════════════════════════════════════════════════════════════════════════╝\n`;
      csvCompleto += `\n`;
      csvCompleto += `Exportado em;${dataExportacao}\n`;
      csvCompleto += `Usuário (ID);${idUsuarioAtual}\n`;
      csvCompleto += `Total de Movimentações;${movimentacoesComSaldo.length}\n`;
      csvCompleto += `Período;${filtros.startDate || 'Início'} até ${filtros.endDate || 'Hoje'}\n`;
      csvCompleto += `\n`;
      
      // ===== RESUMO DE SALDOS FINAIS =====
      csvCompleto += `SALDOS FINAIS (após todas as movimentações)\n`;
      csvCompleto += `Moeda;Saldo Final\n`;
      csvCompleto += `BRL;${formatarValorCSV(saldoBRL)}\n`;
      csvCompleto += `USDT;${saldoUSDT.toFixed(2)}\n`;
      csvCompleto += `BTC;${saldoBTC.toFixed(8)}\n`;
      csvCompleto += `ETH;${saldoETH.toFixed(8)}\n`;
      csvCompleto += `\n`;
      
      // ===== EXTRATO CRONOLÓGICO (TODAS AS MOVIMENTAÇÕES) =====
      csvCompleto += `EXTRATO CRONOLÓGICO DETALHADO\n`;
      csvCompleto += `Data;Hora;Tipo de Operação;Descrição;Entrada;Saída;Moeda;Saldo Anterior;Saldo Posterior;Detalhes\n`;
      
      movimentacoesComSaldo.forEach(mov => {
        const entradaFormatada = mov.entrada > 0 ? formatarValorCSV(mov.entrada) : '-';
        const saidaFormatada = mov.saida > 0 ? formatarValorCSV(mov.saida) : '-';
        
        // Formatar saldos de acordo com a moeda
        const formatarSaldo = (valor: number, moeda: string) => {
          if (moeda === 'BRL') return formatarValorCSV(valor);
          if (moeda === 'USDT') return valor.toFixed(2);
          return valor.toFixed(8); // BTC, ETH
        };
        
        csvCompleto += `${mov.data};`;
        csvCompleto += `${mov.hora};`;
        csvCompleto += `${escaparTextoCSV(mov.tipo)};`;
        csvCompleto += `${escaparTextoCSV(mov.descricao)};`;
        csvCompleto += `${entradaFormatada};`;
        csvCompleto += `${saidaFormatada};`;
        csvCompleto += `${mov.moeda};`;
        csvCompleto += `${formatarSaldo(mov.saldoAnterior, mov.moeda)};`;
        csvCompleto += `${formatarSaldo(mov.saldoPosterior, mov.moeda)};`;
        csvCompleto += `${escaparTextoCSV(mov.detalhes)}\n`;
      });
      
      csvCompleto += `\n`;
      
      // ===== ESTATÍSTICAS POR TIPO DE OPERAÇÃO =====
      csvCompleto += `ESTATÍSTICAS POR TIPO DE OPERAÇÃO\n`;
      csvCompleto += `Tipo;Quantidade;Total (BRL equivalente)\n`;
      
      const estatisticasPorTipo = movimentacoesComSaldo.reduce((acc, mov) => {
        if (!acc[mov.tipo]) {
          acc[mov.tipo] = { count: 0, total: 0 };
        }
        acc[mov.tipo].count++;
        acc[mov.tipo].total += (mov.entrada - mov.saida);
        return acc;
      }, {} as Record<string, { count: number; total: number }>);
      
      Object.entries(estatisticasPorTipo).forEach(([tipo, stats]) => {
        csvCompleto += `${escaparTextoCSV(tipo)};${stats.count};${formatarValorCSV(stats.total)}\n`;
      });
      
      csvCompleto += `\n`;
      
      // ===== RODAPÉ =====
      csvCompleto += `╔══════════════════════════════════════════════════════════════════════════════╗\n`;
      csvCompleto += `║  OBSERVAÇÕES IMPORTANTES                                                   ║\n`;
      csvCompleto += `╠══════════════════════════════════════════════════════════════════════════════╣\n`;
      csvCompleto += `║  • Todas as movimentações estão em ordem cronológica                       ║\n`;
      csvCompleto += `║  • Saldo Anterior = Saldo ANTES da operação ser aplicada                  ║\n`;
      csvCompleto += `║  • Saldo Posterior = Saldo DEPOIS da operação ser aplicada                ║\n`;
      csvCompleto += `║  • Entrada = Valores que SOMAM ao saldo                                   ║\n`;
      csvCompleto += `║  • Saída = Valores que SUBTRAEM do saldo                                  ║\n`;
      csvCompleto += `║  • Saldos são separados por moeda (BRL, USDT, BTC, ETH)                   ║\n`;
      csvCompleto += `╚══════════════════════════════════════════════════════════════════════════════╝\n`;
      
      // ===== DOWNLOAD DO ARQUIVO =====
      const nomeArquivo = `extrato_cronologico_usuario_${idUsuarioAtual}_${new Date().toISOString().split('T')[0]}.csv`;
      baixarCSV(csvCompleto, nomeArquivo);
      
      toast.success('🚀 Extrato Cronológico Gerado! 🎉', {
        description: `${movimentacoesComSaldo.length} movimentações ordenadas com saldo anterior/posterior`
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro na exportação', {
        description: `Falha ao gerar extrato cronológico: ${errorMessage}`
      });
    }
  };

  // ✨ NOVA FUNÇÃO: Alternar ID do usuário
  const handleAlterarIdUsuario = () => {
    const novoId = parseInt(inputIdUsuario, 10);
    if (isNaN(novoId) || novoId <= 0) {
      toast.error('ID inválido', {
        description: 'Digite um ID de usuário válido (número positivo)'
      });
      return;
    }

    if (novoId === idUsuarioAtual) {
      toast.info('Mesmo ID', {
        description: 'O ID informado é o mesmo que já está sendo analisado'
      });
      return;
    }

    // Atualizar estado e URL
    setIdUsuarioAtual(novoId);
    navigate(`/analise-usuario/${novoId}`, { replace: true });
    
    toast.success('ID alterado!', {
      description: `Carregando dados do usuário ${novoId}...`
    });
  };

  // Validar ID do usuário e sincronizar com URL
  useEffect(() => {
    const urlId = parseInt(id || '0', 10);
    if (urlId !== idUsuarioAtual) {
      setIdUsuarioAtual(urlId);
      setInputIdUsuario(id || '');
    }
  }, [id, idUsuarioAtual]);

  // Validar ID do usuário
  useEffect(() => {
    if (!idUsuarioAtual || idUsuarioAtual <= 0) {
      toast.error('ID do usuário inválido');
      navigate(-1);
      return;
    }
  }, [idUsuarioAtual, navigate]);

  // Carregar dados do usuário (apenas quando max_records muda)
  const carregarDados = async () => {
    if (!idUsuarioAtual) return;

    setIsLoading(true);
    try {
      const dados = await getAllUserData(idUsuarioAtual, { 
        max_records: filtros.max_records 
      });
      setDadosBrutos(dados);
      
      if (dados.errors.length > 0) {
        toast.warning('Alguns dados não puderam ser carregados', {
          description: `${dados.errors.length} API(s) falharam`
        });
      } else {
        toast.success(`${filtros.max_records} registros carregados com sucesso!`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro ao carregar dados do usuário', {
        description: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filtrar dados no frontend por data
  const filtrarDadosPorData = (dados: any) => {
    if (!dados || (!filtros.startDate && !filtros.endDate)) {
      return dados;
    }

    const filtrarArray = (array: any[], timestampField = 'timestamp') => {
      if (!array) return array;
      
      return array.filter(item => {
        const timestamp = item[timestampField];
        if (!timestamp) return true;
        
        const itemDate = new Date(timestamp * 1000);
        const startDate = filtros.startDate ? new Date(filtros.startDate) : null;
        const endDate = filtros.endDate ? new Date(filtros.endDate + 'T23:59:59') : null;
        
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
        
        return true;
      });
    };

    return {
      ...dados,
      cryptoDeposits: dados.cryptoDeposits ? {
        ...dados.cryptoDeposits,
        dados: {
          ...dados.cryptoDeposits.dados,
          depositos: filtrarArray(dados.cryptoDeposits.dados?.depositos)
        }
      } : null,
      cryptoWithdraws: dados.cryptoWithdraws ? {
        ...dados.cryptoWithdraws,
        dados: {
          ...dados.cryptoWithdraws.dados,
          saques: filtrarArray(dados.cryptoWithdraws.dados?.saques)
        }
      } : null,
      trades: dados.trades ? {
        ...dados.trades,
        dados: {
          ...dados.trades.dados,
          trades: filtrarArray(dados.trades.dados?.trades)
        }
      } : null,
      fiatDeposits: dados.fiatDeposits ? {
        ...dados.fiatDeposits,
        dados: {
          ...dados.fiatDeposits.dados,
          depositos: filtrarArray(dados.fiatDeposits.dados?.depositos)
        }
      } : null,
      fiatWithdraws: dados.fiatWithdraws ? {
        ...dados.fiatWithdraws,
        dados: {
          ...dados.fiatWithdraws.dados,
          saques: filtrarArray(dados.fiatWithdraws.dados?.saques)
        }
      } : null,
      internalDeposits: dados.internalDeposits ? {
        ...dados.internalDeposits,
        dados: {
          ...dados.internalDeposits.dados,
          depositos: filtrarArray(dados.internalDeposits.dados?.depositos)
        }
      } : null,
      internalWithdraws: dados.internalWithdraws ? {
        ...dados.internalWithdraws,
        dados: {
          ...dados.internalWithdraws.dados,
          saques: filtrarArray(dados.internalWithdraws.dados?.saques)
        }
      } : null
    };
  };

  // Aplicar filtros nos dados brutos
  useEffect(() => {
    if (dadosBrutos) {
      const dadosFiltrados = filtrarDadosPorData(dadosBrutos);
      setDadosUsuario(dadosFiltrados);
    }
  }, [dadosBrutos, filtros.startDate, filtros.endDate]);

  // Carregar dados na inicialização e quando max_records muda
  useEffect(() => {
    carregarDados();
  }, [idUsuarioAtual, filtros.max_records]); // Recarrega apenas quando ID ou max_records mudam

  // Função para aplicar filtros (apenas recarrega se max_records mudou)
  const aplicarFiltros = () => {
    // Filtros de data são aplicados automaticamente via useEffect
    // Só recarrega se max_records mudou
    if (dadosBrutos) {
      const dadosFiltrados = filtrarDadosPorData(dadosBrutos);
      setDadosUsuario(dadosFiltrados);
      toast.success('Filtros aplicados!');
    }
  };

  // Função para limpar filtros
  const limparFiltros = () => {
    setFiltros({ max_records: 100, startDate: '', endDate: '' });
  };


  // Calcular estatísticas do dashboard
  const calcularEstatisticas = () => {
    if (!dadosUsuario) return null;

    const stats = {
      totalCryptoDeposits: dadosUsuario.cryptoDeposits?.dados?.total_registros || 0,
      totalCryptoWithdraws: dadosUsuario.cryptoWithdraws?.dados?.total_registros || 0,
      totalTrades: dadosUsuario.trades?.dados?.total_registros || 0,
      totalFiatDeposits: dadosUsuario.fiatDeposits?.dados?.total_registros || 0,
      totalFiatWithdraws: dadosUsuario.fiatWithdraws?.dados?.total_registros || 0,
      totalInternalDeposits: dadosUsuario.internalDeposits?.dados?.total_registros || 0,
      totalInternalWithdraws: dadosUsuario.internalWithdraws?.dados?.total_registros || 0,
      nomeUsuario: dadosUsuario.cryptoDeposits?.dados?.usuario?.nome || 
                  dadosUsuario.trades?.dados?.usuario?.nome || 
                  'Usuário não identificado',
      emailUsuario: dadosUsuario.cryptoDeposits?.dados?.usuario?.email || 
                   dadosUsuario.trades?.dados?.usuario?.email || 
                   'Email não disponível',
      idBrasilBitcoin: dadosUsuario.cryptoDeposits?.dados?.usuario?.id_brasil_bitcoin || 
                      dadosUsuario.trades?.dados?.usuario?.id_brasil_bitcoin || 
                      'N/A',
      // 🚀 NOVO: Informações de paginação
      paginationInfo: {
        cryptoDeposits: dadosUsuario.cryptoDeposits?.dados?.paginated || false,
        cryptoWithdraws: dadosUsuario.cryptoWithdraws?.dados?.paginated || false,
        trades: dadosUsuario.trades?.dados?.paginated || false,
        fiatDeposits: dadosUsuario.fiatDeposits?.dados?.paginated || false,
        fiatWithdraws: dadosUsuario.fiatWithdraws?.dados?.paginated || false,
        internalDeposits: dadosUsuario.internalDeposits?.dados?.paginated || false,
        internalWithdraws: dadosUsuario.internalWithdraws?.dados?.paginated || false,
        anyPaginated: [
          dadosUsuario.cryptoDeposits?.dados?.paginated,
          dadosUsuario.cryptoWithdraws?.dados?.paginated,
          dadosUsuario.trades?.dados?.paginated,
          dadosUsuario.fiatDeposits?.dados?.paginated,
          dadosUsuario.fiatWithdraws?.dados?.paginated,
          dadosUsuario.internalDeposits?.dados?.paginated,
          dadosUsuario.internalWithdraws?.dados?.paginated
        ].some(Boolean)
      }
    };

    return stats;
  };

  const estatisticas = calcularEstatisticas();

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      {/* Header da Página */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-blue-400" />
              Análise do Usuário {idUsuarioAtual}
            </h1>
            {estatisticas && (
              <div className="mt-1">
                <p className="text-muted-foreground">
                  {estatisticas.nomeUsuario} • {estatisticas.emailUsuario}
                </p>
                {/* ⚡ OTIMIZADO: Indicador de rota especial otimizada */}
                {estatisticas.paginationInfo.anyPaginated && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-500/100/20 text-green-400 rounded-md text-xs">
                      <Activity className="h-3 w-3" />
                      <span className="font-medium">Rota Otimizada Ativa (3x mais rápida)</span>
                    </div>
                    <div className="text-xs text-green-400">
                      Chamadas paralelas + delay 50ms - TODOS os registros carregados
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* ✨ NOVO: Seletor de ID do usuário */}
          <Card className="bg-blue-500/100/10 border-blue-500/30">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-blue-400" />
                <Label htmlFor="id-usuario" className="text-sm font-medium text-blue-400">
                  Alterar ID:
                </Label>
                <Input
                  id="id-usuario"
                  type="number"
                  placeholder="ID do usuário"
                  value={inputIdUsuario}
                  onChange={(e) => setInputIdUsuario(e.target.value)}
                  className="w-24 h-8 text-center"
                  min="1"
                />
                <Button 
                  onClick={handleAlterarIdUsuario}
                  disabled={isLoading || !inputIdUsuario || parseInt(inputIdUsuario, 10) === idUsuarioAtual}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Search className="h-3 w-3 mr-1" />
                  Analisar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Button 
            onClick={carregarDados} 
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
          <Button 
            onClick={handleExportar}
            variant="outline" 
            size="sm"
            disabled={!dadosUsuario}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de Consulta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="max_records">Máximo de Registros (API)</Label>
              <Select 
                value={filtros.max_records.toString()} 
                onValueChange={(value) => setFiltros(prev => ({ ...prev, max_records: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100 registros</SelectItem>
                  <SelectItem value="250">250 registros</SelectItem>
                  <SelectItem value="500">500 registros</SelectItem>
                  <SelectItem value="1000">1.000 registros</SelectItem>
                  <SelectItem value="2500">2.500 registros</SelectItem>
                  <SelectItem value="5000">5.000 registros</SelectItem>
                  <SelectItem value="10000">10.000 registros</SelectItem>
                  <SelectItem value="25000">25.000 registros (máximo)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                ⚠️ Valores altos podem demorar mais para carregar
              </p>
            </div>

            <div>
              <Label htmlFor="startDate">Data Início (Filtro Local)</Label>
              <Input
                id="startDate"
                type="date"
                value={filtros.startDate}
                onChange={(e) => setFiltros(prev => ({ ...prev, startDate: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                📅 Filtra registros já carregados
              </p>
            </div>

            <div>
              <Label htmlFor="endDate">Data Fim (Filtro Local)</Label>
              <Input
                id="endDate"
                type="date"
                value={filtros.endDate}
                onChange={(e) => setFiltros(prev => ({ ...prev, endDate: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                📅 Filtra registros já carregados
              </p>
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={aplicarFiltros} disabled={isLoading} className="flex-1">
                <Search className="h-4 w-4 mr-2" />
                Aplicar Filtros
              </Button>
              <Button onClick={limparFiltros} variant="outline">
                Limpar
              </Button>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
            <div className="flex items-start gap-2">
              <div className="text-blue-400 mt-0.5">ℹ️</div>
              <div className="text-sm text-blue-400">
                <p className="font-medium mb-1">Como funcionam os filtros:</p>
                <ul className="space-y-1 text-xs">
                  <li>• <strong>Máximo de Registros:</strong> Define quantos registros buscar da API (requer nova consulta)</li>
                  <li>• <strong>Filtros de Data:</strong> Filtram os registros já carregados no navegador (instantâneo)</li>
                  <li>• Para períodos específicos, carregue mais registros primeiro, depois filtre por data</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            <span className="text-lg">Carregando dados do usuário...</span>
          </div>
        </div>
      )}

      {/* Conteúdo Principal - Tabs */}
      {!isLoading && dadosUsuario && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="dashboard">
              <PieChart className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="crypto-deposits">
              <TrendingUp className="h-4 w-4 mr-2" />
              Depósitos Crypto
            </TabsTrigger>
            <TabsTrigger value="crypto-withdraws">
              <TrendingDown className="h-4 w-4 mr-2" />
              Saques Crypto
            </TabsTrigger>
            <TabsTrigger value="trades">
              <LineChart className="h-4 w-4 mr-2" />
              Trades
            </TabsTrigger>
            <TabsTrigger value="fiat-deposits">
              <DollarSign className="h-4 w-4 mr-2" />
              Depósitos Fiat
            </TabsTrigger>
            <TabsTrigger value="fiat-withdraws">
              <DollarSign className="h-4 w-4 mr-2" />
              Saques Fiat
            </TabsTrigger>
            <TabsTrigger value="internal">
              <Repeat className="h-4 w-4 mr-2" />
              Transferências Int
            </TabsTrigger>
            <TabsTrigger value="internal-withdraws">
              <TrendingDown className="h-4 w-4 mr-2" />
              Saques Internos
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {estatisticas && (
              <>
                {/* Cards de Estatísticas */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-400" />
                        <div>
                          <p className="text-sm text-muted-foreground">Depósitos Crypto</p>
                          <p className="text-2xl font-bold">{estatisticas.totalCryptoDeposits}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-5 w-5 text-red-400" />
                        <div>
                          <p className="text-sm text-muted-foreground">Saques Crypto</p>
                          <p className="text-2xl font-bold">{estatisticas.totalCryptoWithdraws}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2">
                        <LineChart className="h-5 w-5 text-blue-400" />
                        <div>
                          <p className="text-sm text-muted-foreground">Trades</p>
                          <p className="text-2xl font-bold">{estatisticas.totalTrades}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-green-400" />
                        <div>
                          <p className="text-sm text-muted-foreground">Depósitos Fiat</p>
                          <p className="text-2xl font-bold">{estatisticas.totalFiatDeposits}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-red-400" />
                        <div>
                          <p className="text-sm text-muted-foreground">Saques Fiat</p>
                          <p className="text-2xl font-bold">{estatisticas.totalFiatWithdraws}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2">
                        <Repeat className="h-5 w-5 text-purple-400" />
                        <div>
                          <p className="text-sm text-muted-foreground">Transferências Int</p>
                          <p className="text-2xl font-bold">{estatisticas.totalInternalDeposits}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-5 w-5 text-orange-400" />
                        <div>
                          <p className="text-sm text-muted-foreground">Saques Internos</p>
                          <div className="flex items-center gap-2">
                            <p className="text-2xl font-bold">{estatisticas.totalInternalWithdraws}</p>
                            {estatisticas.paginationInfo.internalWithdraws && (
                              <div className="text-xs bg-blue-500/100/20 text-blue-400 px-1 py-0.5 rounded">
                                TODOS
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* ===== NOVA SEÇÃO: BALANÇO FINANCEIRO CORRIGIDO ===== */}
                {totaisFinanceiros && (
                  <>
                    {/* Balanço Financeiro Principal */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Balanço BRL (Principal) */}
                      <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-green-400">
                            💵 Balanço Financeiro (BRL)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-3 bg-green-500/100/20 rounded-lg">
                              <p className="text-sm text-green-400 font-medium">Entradas BRL</p>
                              <p className="text-xl font-bold text-green-400">
                                {formatarValor(totaisFinanceiros.balances.BRL.entradas)}
                              </p>
                              <p className="text-xs text-green-400">Depósitos + Transferências + Vendas</p>
                            </div>
                            <div className="text-center p-3 bg-red-500/100/20 rounded-lg">
                              <p className="text-sm text-red-400 font-medium">Saídas BRL</p>
                              <p className="text-xl font-bold text-red-400">
                                {formatarValor(totaisFinanceiros.balances.BRL.saidas)}
                              </p>
                              <p className="text-xs text-red-400">Saques + Compras Crypto</p>
                            </div>
                          </div>
                          
                          <div className="text-center p-4 bg-gray-800/50 rounded-lg border-2 border-dashed border-green-500/40">
                            <p className="text-sm text-gray-400 font-medium">Saldo Líquido</p>
                            <p className={`text-2xl font-bold ${
                              totaisFinanceiros.balances.BRL.saldo > 0 ? 'text-green-400' : 
                              totaisFinanceiros.balances.BRL.saldo < 0 ? 'text-red-400' : 'text-gray-400'
                            }`}>
                              {formatarValor(totaisFinanceiros.balances.BRL.saldo)}
                            </p>
                            <div className="flex items-center justify-center gap-1 mt-1">
                              {totaisFinanceiros.balances.BRL.saldo > 0 ? (
                                <>
                                  <CheckCircle className="h-4 w-4 text-green-400" />
                                  <span className="text-xs text-green-400">Saldo Positivo</span>
                                </>
                              ) : totaisFinanceiros.balances.BRL.saldo < 0 ? (
                                <>
                                  <AlertTriangle className="h-4 w-4 text-red-400" />
                                  <span className="text-xs text-red-400">Saldo Negativo</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="h-4 w-4 text-gray-400" />
                                  <span className="text-xs text-gray-400">Saldo Neutro</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Detalhes BRL */}
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-green-400">📥 Depósitos Fiat:</span>
                              <span className="font-bold">{formatarValor(totaisFinanceiros.fiatDeposits.total)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-blue-400">🔄 Transferências Recebidas:</span>
                              <span className="font-bold">{formatarValor(totaisFinanceiros.internalTransfers.total)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-green-400">💰 Vendas Crypto:</span>
                              <span className="font-bold">{formatarValor(totaisFinanceiros.trades.totalVendas)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-red-400">📤 Saques Fiat:</span>
                              <span className="font-bold">{formatarValor(totaisFinanceiros.fiatWithdraws.total)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-orange-400">📤 Transferências Enviadas:</span>
                              <span className="font-bold">{formatarValor(totaisFinanceiros.internalWithdraws.total)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-red-400">🛒 Compras Crypto:</span>
                              <span className="font-bold">{formatarValor(totaisFinanceiros.trades.totalCompras)}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Pares de Trading */}
                      <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-blue-400">
                            📊 Pares Mais Negociados
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {totaisFinanceiros.paresEstatisticas && totaisFinanceiros.paresEstatisticas.length > 0 ? (
                            totaisFinanceiros.paresEstatisticas.slice(0, 4).map((par, index) => (
                              <div key={par.par} className="p-3 bg-gray-800/50 rounded-lg border border-gray-600/50">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="font-bold text-blue-400">#{index + 1} {par.par}</span>
                                  <span className="text-sm text-gray-400">{formatarValor(par.volume)}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="text-green-400">
                                    💰 Vendas: {formatarValor(par.vendas)}
                                  </div>
                                  <div className="text-red-400">
                                    🛒 Compras: {formatarValor(par.compras)}
                                  </div>
                                  <div className="text-blue-400">
                                    📈 Crypto: {par.cryptoComprada.toFixed(2)}
                                  </div>
                                  <div className="text-purple-400">
                                    📉 Crypto: {par.cryptoVendida.toFixed(2)}
                                  </div>
                                </div>
                                <div className="text-center mt-2 pt-2 border-t">
                                  <span className={`text-sm font-bold ${
                                    par.saldoBRL > 0 ? 'text-green-400' : 
                                    par.saldoBRL < 0 ? 'text-red-400' : 'text-gray-400'
                                  }`}>
                                    Saldo: {formatarValor(par.saldoBRL)}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8 text-gray-400">
                              <LineChart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                              <p>Nenhuma negociação encontrada</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Análise Detalhada de Conversões (Corrigida) */}
                    <Card className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border-purple-500/30">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-purple-800">
                          <LineChart className="h-6 w-6" />
                          Análise Detalhada das Conversões
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Resumo Geral */}
                          <div className="text-center p-4 bg-gray-800/50 rounded-lg border">
                            <h3 className="text-lg font-bold text-purple-800 mb-2">Resumo Geral</h3>
                            <p className="text-3xl font-bold text-purple-400">{totaisFinanceiros.trades.count}</p>
                            <p className="text-sm text-gray-400 mt-1">Operações realizadas</p>
                            <div className="mt-3 space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-green-400">💰 Vendas (BRL recebido):</span>
                                <span className="font-bold">{formatarValor(totaisFinanceiros.trades.totalVendas)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-red-400">🛒 Compras (BRL gasto):</span>
                                <span className="font-bold">{formatarValor(totaisFinanceiros.trades.totalCompras)}</span>
                              </div>
                              <div className="flex justify-between text-sm border-t pt-1">
                                <span className="text-purple-400">📊 Volume Total:</span>
                                <span className="font-bold">{formatarValor(totaisFinanceiros.trades.volumeTotal)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Saldo de Trading */}
                          <div className="text-center p-4 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-lg border">
                            <h3 className="text-lg font-bold text-orange-800 mb-2">Saldo de Trading</h3>
                            <p className={`text-3xl font-bold ${
                              (totaisFinanceiros.trades.totalVendas - totaisFinanceiros.trades.totalCompras) > 0 ? 'text-green-400' : 
                              (totaisFinanceiros.trades.totalVendas - totaisFinanceiros.trades.totalCompras) < 0 ? 'text-red-400' : 'text-gray-400'
                            }`}>
                              {formatarValor(totaisFinanceiros.trades.totalVendas - totaisFinanceiros.trades.totalCompras)}
                            </p>
                            <p className="text-sm text-gray-400 mt-1">Vendas - Compras</p>
                            <div className="mt-3 space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-blue-400">📈 Pares Únicos:</span>
                                <span className="font-bold">{Object.keys(totaisFinanceiros.trades.pares).length}</span>
                              </div>
                              {totaisFinanceiros.paresEstatisticas && totaisFinanceiros.paresEstatisticas.length > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-blue-400">🏆 Mais Negociado:</span>
                                  <span className="font-bold">{totaisFinanceiros.paresEstatisticas[0].par}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-center gap-1 mt-2">
                                {(totaisFinanceiros.trades.totalVendas - totaisFinanceiros.trades.totalCompras) > 0 ? (
                                  <>
                                    <CheckCircle className="h-4 w-4 text-green-400" />
                                    <span className="text-xs text-green-400">Lucro no Trading</span>
                                  </>
                                ) : (totaisFinanceiros.trades.totalVendas - totaisFinanceiros.trades.totalCompras) < 0 ? (
                                  <>
                                    <AlertTriangle className="h-4 w-4 text-red-400" />
                                    <span className="text-xs text-red-400">Prejuízo no Trading</span>
                                  </>
                                ) : (
                                  <>
                                    <Clock className="h-4 w-4 text-gray-400" />
                                    <span className="text-xs text-gray-400">Trading Neutro</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* ===== NOVO: BALANÇO FINANCEIRO GERAL COM JUSTIFICATIVAS ===== */}
                    {totaisFinanceiros?.saldosReais && (
                      <Card className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border-amber-500/30">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-amber-900">
                            <PieChart className="h-6 w-6" />
                            💰 Balanço Financeiro Geral (Saldos Reais)
                          </CardTitle>
                          <p className="text-sm text-amber-400 mt-1">
                            Análise completa de todos os registros com justificativas detalhadas
                          </p>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          
                          {/* SALDO REAL EM BRL */}
                          <div className="bg-gray-800/50 rounded-lg p-4 border-2 border-green-500/30">
                            <h3 className="text-lg font-bold text-green-400 mb-3 flex items-center gap-2">
                              💵 SALDO REAL EM BRL
                            </h3>
                            
                            {/* Entradas BRL */}
                            <div className="bg-green-500/10 rounded p-3 mb-3">
                              <p className="text-sm font-bold text-green-400 mb-2">✅ ENTRADAS DE BRL:</p>
                              <div className="space-y-1 text-xs text-green-400 ml-4">
                                <div className="flex justify-between">
                                  <span>📥 Depósitos Fiat (bancos externos):</span>
                                  <span className="font-bold">{formatarValor(totaisFinanceiros.saldosReais.BRL.depositosFiat)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>🔄 Transferências Recebidas (de outros usuários):</span>
                                  <span className="font-bold">{formatarValor(totaisFinanceiros.saldosReais.BRL.transferenciasRecebidas)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>💰 Vendas de Crypto (converteu crypto → BRL):</span>
                                  <span className="font-bold">{formatarValor(totaisFinanceiros.saldosReais.BRL.vendasCrypto)}</span>
                                </div>
                                <div className="flex justify-between border-t border-green-500/40 pt-1 mt-1">
                                  <span className="font-bold">TOTAL DE ENTRADAS:</span>
                                  <span className="font-bold text-green-400">{formatarValor(totaisFinanceiros.saldosReais.BRL.totalEntradas)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Saídas BRL */}
                            <div className="bg-red-500/10 rounded p-3 mb-3">
                              <p className="text-sm font-bold text-red-400 mb-2">❌ SAÍDAS DE BRL:</p>
                              <div className="space-y-1 text-xs text-red-400 ml-4">
                                <div className="flex justify-between">
                                  <span>📤 Saques Fiat (retirou para bancos):</span>
                                  <span className="font-bold">{formatarValor(totaisFinanceiros.saldosReais.BRL.saquesFiat)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>📤 Transferências Enviadas (para outros usuários):</span>
                                  <span className="font-bold">{formatarValor(totaisFinanceiros.saldosReais.BRL.transferenciasEnviadas)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>🛒 Compras de Crypto (converteu BRL → crypto):</span>
                                  <span className="font-bold">{formatarValor(totaisFinanceiros.saldosReais.BRL.comprasCrypto)}</span>
                                </div>
                                <div className="flex justify-between border-t border-red-500/40 pt-1 mt-1">
                                  <span className="font-bold">TOTAL DE SAÍDAS:</span>
                                  <span className="font-bold text-red-400">{formatarValor(totaisFinanceiros.saldosReais.BRL.totalSaidas)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Saldo Final BRL */}
                            <div className={`rounded-lg p-4 border-2 ${
                              totaisFinanceiros.saldosReais.BRL.saldoFinal > 0 ? 'bg-green-500/100/20 border-green-500/50' : 
                              totaisFinanceiros.saldosReais.BRL.saldoFinal < 0 ? 'bg-red-500/100/20 border-red-500/50' : 'bg-gray-500/20 border-gray-500/50'
                            }`}>
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-sm">🎯 SALDO REAL EM BRL:</span>
                                <span className={`text-2xl font-bold ${
                                  totaisFinanceiros.saldosReais.BRL.saldoFinal > 0 ? 'text-green-400' : 
                                  totaisFinanceiros.saldosReais.BRL.saldoFinal < 0 ? 'text-red-400' : 'text-gray-300'
                                }`}>
                                  {formatarValor(totaisFinanceiros.saldosReais.BRL.saldoFinal)}
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 mt-1 text-center">
                                Fórmula: ({formatarValor(totaisFinanceiros.saldosReais.BRL.totalEntradas)} entradas) - ({formatarValor(totaisFinanceiros.saldosReais.BRL.totalSaidas)} saídas)
                              </p>
                            </div>
                          </div>

                          {/* SALDO REAL EM CRYPTO */}
                          <div className="bg-gray-800/50 rounded-lg p-4 border-2 border-blue-500/30">
                            <h3 className="text-lg font-bold text-blue-400 mb-3 flex items-center gap-2">
                              💎 SALDO REAL EM CRYPTO
                            </h3>

                            {/* USDT */}
                            <div className="mb-3 p-3 bg-blue-500/10 rounded">
                              <p className="text-sm font-bold text-blue-400 mb-2">🪙 USDT (Tether):</p>
                              <div className="space-y-1 text-xs ml-4">
                                <div className="flex justify-between text-green-400">
                                  <span>📥 Depósitos USDT:</span>
                                  <span className="font-bold">{totaisFinanceiros.saldosReais.crypto.USDT.deposits.toFixed(2)} USDT</span>
                                </div>
                                <div className="flex justify-between text-green-400">
                                  <span>🛒 Comprado (com BRL):</span>
                                  <span className="font-bold">{totaisFinanceiros.saldosReais.crypto.USDT.comprado.toFixed(2)} USDT</span>
                                </div>
                                <div className="flex justify-between text-red-400">
                                  <span>📤 Saques USDT:</span>
                                  <span className="font-bold">{totaisFinanceiros.saldosReais.crypto.USDT.withdraws.toFixed(2)} USDT</span>
                                </div>
                                <div className="flex justify-between text-red-400">
                                  <span>💰 Vendido (por BRL):</span>
                                  <span className="font-bold">{totaisFinanceiros.saldosReais.crypto.USDT.vendido.toFixed(2)} USDT</span>
                                </div>
                                <div className="flex justify-between border-t border-blue-300 pt-1 mt-1">
                                  <span className="font-bold">🎯 SALDO USDT:</span>
                                  <span className={`font-bold text-lg ${totaisFinanceiros.saldosReais.crypto.USDT.saldo > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {totaisFinanceiros.saldosReais.crypto.USDT.saldo.toFixed(2)} USDT
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* BTC */}
                            {(totaisFinanceiros.saldosReais.crypto.BTC.deposits > 0 || totaisFinanceiros.saldosReais.crypto.BTC.saldo !== 0) && (
                              <div className="mb-3 p-3 bg-yellow-50 rounded">
                                <p className="text-sm font-bold text-yellow-400 mb-2">₿ BTC (Bitcoin):</p>
                                <div className="space-y-1 text-xs ml-4">
                                  <div className="flex justify-between">
                                    <span>Depósitos + Compras - Saques - Vendas:</span>
                                    <span className="font-bold text-lg text-yellow-400">
                                      {totaisFinanceiros.saldosReais.crypto.BTC.saldo.toFixed(8)} BTC
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* ETH */}
                            {(totaisFinanceiros.saldosReais.crypto.ETH.deposits > 0 || totaisFinanceiros.saldosReais.crypto.ETH.saldo !== 0) && (
                              <div className="p-3 bg-purple-50 rounded">
                                <p className="text-sm font-bold text-purple-400 mb-2">Ξ ETH (Ethereum):</p>
                                <div className="space-y-1 text-xs ml-4">
                                  <div className="flex justify-between">
                                    <span>Depósitos + Compras - Saques - Vendas:</span>
                                    <span className="font-bold text-lg text-purple-400">
                                      {totaisFinanceiros.saldosReais.crypto.ETH.saldo.toFixed(8)} ETH
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* RESUMO FINAL */}
                          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg p-4 border-2 border-amber-500/50">
                            <h4 className="font-bold text-amber-900 mb-2 flex items-center gap-2">
                              📊 RESUMO INTERPRETATIVO:
                            </h4>
                            <div className="text-sm text-amber-800 space-y-1">
                              {totaisFinanceiros.saldosReais.BRL.saldoFinal > 0 ? (
                                <p>✅ O usuário tem <strong className="text-green-400">{formatarValor(totaisFinanceiros.saldosReais.BRL.saldoFinal)}</strong> em saldo positivo de BRL</p>
                              ) : totaisFinanceiros.saldosReais.BRL.saldoFinal < 0 ? (
                                <p>⚠️ O usuário tem <strong className="text-red-400">{formatarValor(Math.abs(totaisFinanceiros.saldosReais.BRL.saldoFinal))}</strong> em saldo negativo de BRL</p>
                              ) : (
                                <p>⚖️ O usuário tem saldo neutro em BRL</p>
                              )}
                              
                              {totaisFinanceiros.saldosReais.crypto.USDT.saldo > 0 && (
                                <p>💎 O usuário possui <strong className="text-blue-400">{totaisFinanceiros.saldosReais.crypto.USDT.saldo.toFixed(2)} USDT</strong> em carteira</p>
                              )}
                              
                              <p className="mt-2 pt-2 border-t border-amber-500/30">
                                💡 <strong>Justificativa:</strong> O saldo considera TODAS as operações: depósitos, transferências, vendas, saques e compras de crypto.
                              </p>
                            </div>
                          </div>

                        </CardContent>
                      </Card>
                    )}

                    {/* Depósitos e Saques por Moeda */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Depósitos por Moeda */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-green-400" />
                            Depósitos por Moeda
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="text-center p-3 bg-green-500/100/20 rounded">
                              <p className="text-sm text-green-400 font-medium">BRL (Fiat)</p>
                              <p className="text-lg font-bold text-green-400">
                                {formatarValor(totaisFinanceiros.fiatDeposits.total)}
                              </p>
                              <p className="text-xs text-gray-400">{totaisFinanceiros.fiatDeposits.count} depósitos</p>
                            </div>
                            <div className="text-center p-3 bg-blue-500/100/20 rounded">
                              <p className="text-sm text-blue-400 font-medium">BRL (Interno)</p>
                              <p className="text-lg font-bold text-blue-400">
                                {formatarValor(totaisFinanceiros.internalTransfers.total)}
                              </p>
                              <p className="text-xs text-gray-400">{totaisFinanceiros.internalTransfers.count} transferências</p>
                            </div>
                            <div className="text-center p-3 bg-orange-100 rounded">
                              <p className="text-sm text-orange-400 font-medium">USDT (Crypto)</p>
                              <p className="text-lg font-bold text-orange-800">
                                {totaisFinanceiros.cryptoDeposits.USDT.toFixed(2)}
                              </p>
                              <p className="text-xs text-gray-400">crypto deposits</p>
                            </div>
                          </div>
                          
                          <div className="border-t pt-3">
                            <h4 className="text-sm font-medium text-gray-300 mb-2">Outras Criptomoedas:</h4>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="p-2 bg-yellow-500/20 rounded text-xs">
                                <p className="font-bold text-yellow-400">BTC</p>
                                <p className="text-yellow-400">{totaisFinanceiros.cryptoDeposits.BTC.toFixed(4)}</p>
                              </div>
                              <div className="p-2 bg-purple-100 rounded text-xs">
                                <p className="font-bold text-purple-800">ETH</p>
                                <p className="text-purple-400">{totaisFinanceiros.cryptoDeposits.ETH.toFixed(4)}</p>
                              </div>
                              <div className="p-2 bg-gray-500/20 rounded text-xs">
                                <p className="font-bold text-gray-800">Outras</p>
                                <p className="text-gray-300">{totaisFinanceiros.cryptoDeposits.outros.toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Saques por Moeda */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <TrendingDown className="h-5 w-5 text-red-400" />
                            Saques por Moeda
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="text-center p-3 bg-red-500/100/20 rounded">
                              <p className="text-sm text-red-400 font-medium">BRL (Fiat)</p>
                              <p className="text-lg font-bold text-red-400">
                                {formatarValor(totaisFinanceiros.fiatWithdraws.total)}
                              </p>
                              <p className="text-xs text-gray-400">{totaisFinanceiros.fiatWithdraws.count} saques</p>
                            </div>
                            <div className="text-center p-3 bg-orange-100 rounded">
                              <p className="text-sm text-orange-400 font-medium">USDT (Crypto)</p>
                              <p className="text-lg font-bold text-orange-800">
                                {totaisFinanceiros.cryptoWithdraws.USDT.toFixed(2)}
                              </p>
                              <p className="text-xs text-gray-400">crypto withdraws</p>
                            </div>
                          </div>
                          
                          <div className="border-t pt-3">
                            <h4 className="text-sm font-medium text-gray-300 mb-2">Outras Criptomoedas:</h4>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="p-2 bg-yellow-500/20 rounded text-xs">
                                <p className="font-bold text-yellow-400">BTC</p>
                                <p className="text-yellow-400">{totaisFinanceiros.cryptoWithdraws.BTC.toFixed(4)}</p>
                              </div>
                              <div className="p-2 bg-purple-100 rounded text-xs">
                                <p className="font-bold text-purple-800">ETH</p>
                                <p className="text-purple-400">{totaisFinanceiros.cryptoWithdraws.ETH.toFixed(4)}</p>
                              </div>
                              <div className="p-2 bg-gray-500/20 rounded text-xs">
                                <p className="font-bold text-gray-800">Outras</p>
                                <p className="text-gray-300">{totaisFinanceiros.cryptoWithdraws.outros.toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )}

                {/* Informações do Usuário */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Informações do Usuário
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-sm text-muted-foreground">Nome</Label>
                        <p className="font-medium">{estatisticas.nomeUsuario}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Email</Label>
                        <p className="font-medium">{estatisticas.emailUsuario}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">ID Brasil Bitcoin</Label>
                        <p className="font-medium">{estatisticas.idBrasilBitcoin}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Depósitos Crypto Tab */}
          <TabsContent value="crypto-deposits">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-400" />
                    Depósitos de Criptomoedas
                  </span>
                  <Badge variant="outline">
                    {dadosUsuario.cryptoDeposits?.dados?.total_registros || 0} registros
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dadosUsuario.cryptoDeposits?.dados?.depositos && dadosUsuario.cryptoDeposits.dados.depositos.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Moeda</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Taxa</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Rede</TableHead>
                          <TableHead>Hash</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dadosUsuario.cryptoDeposits.dados.depositos.map((deposito, index) => (
                          <TableRow key={deposito.id || index}>
                            <TableCell className="font-mono text-sm">
                              {formatarData(deposito.timestamp)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Bitcoin className="h-4 w-4 text-orange-500" />
                                <span className="font-medium">{deposito.coin || 'N/A'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono">
                              {deposito.amount || '0'} {deposito.coin || 'N/A'}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-muted-foreground">
                              {deposito.fee || '0'} {deposito.coin || 'N/A'}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(deposito.status)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {deposito.networkName || deposito.network}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-32">
                              {deposito.hash ? (
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-xs text-muted-foreground truncate">
                                    {deposito.hash.substring(0, 8)}...
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copiarTexto(deposito.hash, 'Hash')}
                                    className="h-6 w-6 p-0"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {deposito.address && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copiarTexto(deposito.address, 'Endereço')}
                                    className="h-8 px-2"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                )}
                                {deposito.hash && deposito.network && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.open(`https://blockchair.com/${deposito.network}/transaction/${deposito.hash}`, '_blank')}
                                    className="h-8 px-2"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhum depósito de criptomoedas encontrado</p>
                    <p className="text-sm mt-2">
                      Os depósitos aparecerão aqui quando disponíveis
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Saques Crypto Tab */}
          <TabsContent value="crypto-withdraws">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-red-400" />
                    Saques de Criptomoedas
                  </span>
                  <Badge variant="outline">
                    {dadosUsuario.cryptoWithdraws?.dados?.total_registros || 0} registros
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dadosUsuario.cryptoWithdraws?.dados?.saques && dadosUsuario.cryptoWithdraws.dados.saques.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Moeda</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Taxa</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Destino</TableHead>
                          <TableHead>Hash</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dadosUsuario.cryptoWithdraws.dados.saques.map((saque, index) => (
                          <TableRow key={saque.id || index}>
                            <TableCell className="font-mono text-sm">
                              {formatarData(saque.timestamp)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Bitcoin className="h-4 w-4 text-orange-500" />
                                <span className="font-medium">{saque.coin || 'N/A'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono">
                              {saque.amount || '0'} {saque.coin || 'N/A'}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-muted-foreground">
                              {saque.fee || '0'} {saque.coin || 'N/A'}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(saque.status)}
                            </TableCell>
                            <TableCell className="max-w-32">
                              {saque.address ? (
                                <span className="font-mono text-xs text-muted-foreground truncate">
                                  {saque.address.substring(0, 12)}...
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">N/A</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-32">
                              {saque.hash ? (
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-xs text-muted-foreground truncate">
                                    {saque.hash.substring(0, 8)}...
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copiarTexto(saque.hash, 'Hash')}
                                    className="h-6 w-6 p-0"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {saque.hash && saque.network ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(`https://blockchair.com/${saque.network}/transaction/${saque.hash}`, '_blank')}
                                  className="h-8 px-2"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <TrendingDown className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhum saque de criptomoedas encontrado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trades Tab */}
          <TabsContent value="trades">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <LineChart className="h-5 w-5 text-blue-400" />
                    Negociações (Trades)
                  </span>
                  <Badge variant="outline">
                    {dadosUsuario.trades?.dados?.total_registros || 0} registros
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dadosUsuario.trades?.dados?.trades && dadosUsuario.trades.dados.trades.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Par</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Quantidade</TableHead>
                          <TableHead>Preço</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Markup</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dadosUsuario.trades.dados.trades.map((trade, index) => (
                          <TableRow key={trade.transactionId || index}>
                            <TableCell className="font-mono text-sm">
                              {formatarData(trade.timestamp)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {trade.pair || 'N/A'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={trade.side === 'buy' ? 'default' : 'destructive'}>
                                {trade.side === 'buy' ? 'Compra' : trade.side === 'sell' ? 'Venda' : 'N/A'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono">
                              {trade.amount || '0'}
                            </TableCell>
                            <TableCell className="font-mono">
                              {formatarValor(trade.priceWithoutMarkup)}
                            </TableCell>
                            <TableCell className="font-mono">
                              {formatarValor(trade.total)}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(trade.status)}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {trade.markup || '0'}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <LineChart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhuma negociação encontrada</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Depósitos Fiat Tab */}
          <TabsContent value="fiat-deposits">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-400" />
                    Depósitos Fiat (BRL)
                  </span>
                  <Badge variant="outline">
                    {dadosUsuario.fiatDeposits?.dados?.total_registros || 0} registros
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dadosUsuario.fiatDeposits?.dados?.depositos && dadosUsuario.fiatDeposits.dados.depositos.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Banco</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Documento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dadosUsuario.fiatDeposits.dados.depositos.map((deposito, index) => (
                          <TableRow key={deposito.id || index}>
                            <TableCell className="font-mono text-sm">
                              {formatarData(deposito.timestamp)}
                            </TableCell>
                            <TableCell className="font-mono">
                              {formatarValor(deposito.value)}
                            </TableCell>
                            <TableCell>
                              {deposito.bank || 'N/A'}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(deposito.status)}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {deposito.userDocument || 'N/A'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhum depósito fiat encontrado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Saques Fiat Tab */}
          <TabsContent value="fiat-withdraws">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-red-400" />
                    Saques Fiat (BRL)
                  </span>
                  <Badge variant="outline">
                    {dadosUsuario.fiatWithdraws?.dados?.total_registros || 0} registros
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dadosUsuario.fiatWithdraws?.dados?.saques && dadosUsuario.fiatWithdraws.dados.saques.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Taxa</TableHead>
                          <TableHead>Banco</TableHead>
                          <TableHead>Chave PIX</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dadosUsuario.fiatWithdraws.dados.saques.map((saque, index) => (
                          <TableRow key={saque.id || index}>
                            <TableCell className="font-mono text-sm">
                              {formatarData(saque.timestamp)}
                            </TableCell>
                            <TableCell className="font-mono">
                              {formatarValor(saque.value)}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {formatarValor(saque.withdrawFee)}
                            </TableCell>
                            <TableCell>
                              {saque.bank || 'N/A'}
                            </TableCell>
                            <TableCell className="max-w-32">
                              {saque.pixKey ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-sm truncate">
                                    {saque.pixKey}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {saque.pixKeyType || 'N/A'}
                                  </Badge>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(saque.status)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhum saque fiat encontrado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transferências Internas Tab */}
          <TabsContent value="internal">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Repeat className="h-5 w-5 text-purple-400" />
                    Transferências Internas
                  </span>
                  <Badge variant="outline">
                    {dadosUsuario.internalDeposits?.dados?.total_registros || 0} registros
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dadosUsuario.internalDeposits?.dados?.depositos && dadosUsuario.internalDeposits.dados.depositos.length > 0 ? (
                  <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Data/Hora</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Moeda</TableHead>
                            <TableHead>Tipo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dadosUsuario.internalDeposits.dados.depositos.map((transferencia, index) => (
                            <TableRow key={transferencia.id || index}>
                              <TableCell className="font-mono text-sm">
                                #{transferencia.id}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {formatarData(transferencia.timestamp)}
                              </TableCell>
                              <TableCell className="font-mono text-lg font-semibold">
                                {formatarValor(transferencia.amount)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="uppercase">
                                  {transferencia.coin?.toUpperCase() || 'BRL'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="bg-blue-500/10 text-blue-400">
                                  🔄 Transferência Interna
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Repeat className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhuma transferência interna encontrada</p>
                    {dadosUsuario.internalDeposits && (
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                        <strong>🔍 Debug API Response:</strong>
                        <pre className="mt-2 text-xs text-left overflow-x-auto">
                          {JSON.stringify(dadosUsuario.internalDeposits, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Saques Internos Tab */}
          <TabsContent value="internal-withdraws">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-orange-400" />
                    Saques Internos (Transferências Enviadas)
                  </span>
                  <Badge variant="outline">
                    {dadosUsuario.internalWithdraws?.dados?.total_registros || 0} registros
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dadosUsuario.internalWithdraws?.dados?.saques && dadosUsuario.internalWithdraws.dados.saques.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Moeda</TableHead>
                          <TableHead>Para (Documento)</TableHead>
                          <TableHead>Tipo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dadosUsuario.internalWithdraws.dados.saques.map((saque, index) => (
                          <TableRow key={saque.id || index}>
                            <TableCell className="font-mono text-sm">
                              #{saque.id}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {formatarData(saque.timestamp)}
                            </TableCell>
                            <TableCell className="font-mono text-lg font-semibold">
                              {formatarValor(saque.amount)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="uppercase">
                                {saque.coin?.toUpperCase() || 'BRL'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {saque.toUserDocument || 'N/A'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-orange-50 text-orange-400">
                                📤 Transferência Enviada
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <TrendingDown className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhum saque interno encontrado</p>
                    <p className="text-sm mt-2">
                      As transferências enviadas aparecerão aqui quando disponíveis
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Estado de Erro */}
      {!isLoading && !dadosUsuario && (
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Erro ao carregar dados</h3>
          <p className="text-muted-foreground mb-4">
            Não foi possível carregar os dados do usuário {idUsuarioAtual}
          </p>
          <Button onClick={carregarDados}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>
        </div>
      )}
    </div>
  );
}

