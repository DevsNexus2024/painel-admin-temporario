import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    BarChart3,
    RefreshCw,
    Activity,
    AlertCircle,
    CheckCircle2,
    Wifi,
    WifiOff
} from "lucide-react";
import { toast } from "sonner";

// Tipos baseados na resposta real da API - ATUALIZADO
interface CotacaoExchange {
    preco_compra: string;
    preco_venda: string;
    preco_compra_original: string;
    preco_venda_original: string;
}

interface ApiResponse {
    mensagem: string;
    response: {
        menor_valor_compra: string;
        maior_valor_venda: string;
        exchange_menor_valor_compra: string;
        exchange_maior_valor_venda: string;
        cotacoes_por_exchange: Record<string, CotacaoExchange>;
    };
}

// Mapeamento de logos das exchanges (OTIMIZADO - usando logos locais!)
const exchangeLogos: Record<string, string> = {
    'BINANCE': '/binance-logo.png',
    'BRASIL_BITCOIN': '/placeholder.svg', // usando placeholder local
    'FOXBIT': '/foxbit-logo.png',
    'SMARTPAY': '/smartpay-logo.png',
    'MERCADO_BITCOIN': '/placeholder.svg', // usando placeholder local  
    'BITSO': '/placeholder.svg', // usando placeholder local
    'NOVADAX': '/placeholder.svg' // usando placeholder local
};

// Função para obter logo da exchange - SEM REQUISIÇÕES EXTERNAS!
const getExchangeLogo = (exchangeName: string): string => {
    return exchangeLogos[exchangeName] || '/placeholder.svg'; // fallback para placeholder local
};

// API Externa direta (sem proxy) - OTIMIZADO!
const API_BASE_URL = `${import.meta.env.X_DIAGNOSTICO_API_URL}/trades/usuario`;

// Função para buscar cotação otimizada
const fetchCotacao = async (crypto: string, amount: number): Promise<ApiResponse> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    try {
        const response = await fetch(
            `${API_BASE_URL}/melhorCotacao?crypto=${crypto}&amount=${amount}`,
            {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
            }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        return response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
};

// Hook para debounce - OTIMIZAÇÃO!
const useDebounce = (value: any, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};

export default function Cotacoes() {
    const [crypto, setCrypto] = useState('USDT');
    const [amount, setAmount] = useState(100);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

    // Debounce para inputs - EVITA REQUISIÇÕES DESNECESSÁRIAS!
    const debouncedCrypto = useDebounce(crypto, 800);
    const debouncedAmount = useDebounce(amount, 800);

    // React Query SUPER OTIMIZADO!
    const {
        data: cotacaoData,
        isLoading,
        isError,
        error,
        refetch,
        isFetching,
        isSuccess
    } = useQuery({
        queryKey: ['cotacao', debouncedCrypto, debouncedAmount],
        queryFn: () => fetchCotacao(debouncedCrypto, debouncedAmount),
        refetchInterval: autoRefresh ? 5000 : false, // 5 segundos
        refetchIntervalInBackground: false, // Não atualizar em background
        staleTime: 4000, // Dados considerados frescos por 4s
        gcTime: 1000 * 60 * 10, // Cache por 10 minutos
        retry: 2, // Máximo 2 tentativas
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
        refetchOnWindowFocus: false,
        refetchOnMount: true,
        refetchOnReconnect: true,
    });

    // Atualizar timestamp quando dados mudam
    useEffect(() => {
        if (isSuccess && cotacaoData) {
            setLastUpdateTime(new Date());
        }
    }, [isSuccess, cotacaoData]);

    const toggleAutoRefresh = useCallback(() => {
        setAutoRefresh(prev => {
            const newValue = !prev;
            toast.info(newValue ? 'Atualização automática habilitada (5s)' : 'Atualização automática desabilitada');
            return newValue;
        });
    }, []);

    const handleRefresh = useCallback(() => {
        refetch();
        toast.info('Atualizando cotações...');
    }, [refetch]);

    // Função para garantir ordem consistente das exchanges e sempre incluir FOXBIT
    const getOrderedExchanges = (exchanges: Record<string, CotacaoExchange>) => {
        const exchangeOrder = ['BINANCE', 'BRASIL_BITCOIN', 'FOXBIT', 'SMARTPAY', 'MERCADO_BITCOIN', 'BITSO', 'NOVADAX'];
        const orderedEntries: [string, CotacaoExchange][] = [];
        
        // Primeiro, adicionar exchanges na ordem preferida
        exchangeOrder.forEach(exchangeName => {
            if (exchanges[exchangeName]) {
                orderedEntries.push([exchangeName, exchanges[exchangeName]]);
            } else if (exchangeName === 'FOXBIT') {
                // Se FOXBIT não estiver nos dados, adicionar com valores padrão para manter a linha
                orderedEntries.push([exchangeName, { 
                    preco_compra: '0.0000', 
                    preco_venda: '0.0000',
                    preco_compra_original: '0.0000',
                    preco_venda_original: '0.0000'
                }]);
            }
        });
        
        // Depois, adicionar qualquer exchange que não estava na lista
        Object.entries(exchanges).forEach(([name, data]) => {
            if (!exchangeOrder.includes(name)) {
                orderedEntries.push([name, data]);
            }
        });
        
        return orderedEntries;
    };

    // Usar dados diretos da API para atualização em tempo real
    const exchangesToRender = cotacaoData?.response?.cotacoes_por_exchange || {};

    // Formatação de tempo relativo
    const formatLastUpdate = (date: Date | null) => {
        if (!date) return '';
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
        
        if (diff < 60) return `${diff}s atrás`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
        return `${Math.floor(diff / 3600)}h atrás`;
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header otimizado */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <BarChart3 className="h-8 w-8 text-blue-500" />
                        Cotações em Tempo Real
                        {autoRefresh && (
                            <Badge variant="secondary" className="ml-2 animate-pulse">
                                <Wifi className="h-3 w-3 mr-1" />
                                LIVE
                            </Badge>
                        )}
                    </h1>
                    <p className="text-muted-foreground">
                        Consulte cotações de criptomoedas das principais exchanges - Com e Sem Taxa
                        {lastUpdateTime && (
                            <span className="ml-2 text-xs">
                                • Última atualização: {formatLastUpdate(lastUpdateTime)}
                            </span>
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant={autoRefresh ? "default" : "outline"}
                        size="sm"
                        onClick={toggleAutoRefresh}
                        className="flex items-center gap-2"
                    >
                        {autoRefresh ? (
                            <Wifi className="h-4 w-4 animate-pulse" />
                        ) : (
                            <WifiOff className="h-4 w-4" />
                        )}
                        {autoRefresh ? 'Auto (5s)' : 'Manual'}
                    </Button>
                    
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={isFetching}
                        className="flex items-center gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                        Atualizar
                    </Button>
                </div>
            </div>

            {/* Controles otimizados */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">
                        Configurações
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Criptomoeda</label>
                            <Input
                                value={crypto}
                                onChange={(e) => setCrypto(e.target.value.toUpperCase())}
                                placeholder="Ex: USDT, BTC, ETH"
                                maxLength={10}
                                disabled={isFetching}
                            />
                            {crypto !== debouncedCrypto && (
                                <p className="text-xs text-muted-foreground">
                                    Aguardando digitação...
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Quantidade</label>
                            <Input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(Number(e.target.value))}
                                min="1"
                                step="1"
                                disabled={isFetching}
                            />
                            {amount !== debouncedAmount && (
                                <p className="text-xs text-muted-foreground">
                                    Aguardando digitação...
                                </p>
                            )}
                        </div>

                        <div className="space-y-2 flex items-end">
                            <Button 
                                onClick={handleRefresh} 
                                className="w-full"
                                disabled={isFetching}
                            >
                                {isFetching ? (
                                    <>
                                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                        Consultando...
                                    </>
                                ) : (
                                    'Consultar Cotação'
                                )}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Status melhorado */}
            <div className="flex items-center gap-2 text-sm">
                {isLoading && (
                    <>
                        <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span>Carregando cotação...</span>
                    </>
                )}
                
                {isError && (
                    <>
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        <span className="text-red-500">
                            Erro: {error instanceof Error ? error.message : 'Erro desconhecido'}
                        </span>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleRefresh}
                            className="ml-2"
                        >
                            Tentar novamente
                        </Button>
                    </>
                )}
                
                {isSuccess && cotacaoData?.mensagem === 'OK' && (
                    <>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-green-500">
                            Cotação obtida para {debouncedCrypto}
                        </span>
                        {autoRefresh && (
                            <span className="text-muted-foreground">
                                • Próxima atualização em 5s
                            </span>
                        )}
                    </>
                )}
            </div>

            {/* Resultados */}
            {isSuccess && cotacaoData?.mensagem === 'OK' && (
                <div className="space-y-6">
                    {/* Melhores Cotações */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Melhores Cotações - {debouncedCrypto}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <h3 className="text-lg font-semibold text-green-600">Melhor Compra</h3>
                                    <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                                        <div className="flex items-center gap-3 mb-2">
                                            <img 
                                                src={getExchangeLogo(cotacaoData.response.exchange_menor_valor_compra)} 
                                                alt={cotacaoData.response.exchange_menor_valor_compra}
                                                className="w-8 h-8 rounded-full object-contain bg-white p-1"
                                                loading="lazy"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.src = '/placeholder.svg';
                                                }}
                                            />
                                            <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                                                {cotacaoData.response.exchange_menor_valor_compra}
                                            </span>
                                        </div>
                                        <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                                            R$ {parseFloat(cotacaoData.response.menor_valor_compra).toLocaleString('pt-BR', {
                                                minimumFractionDigits: 4,
                                                maximumFractionDigits: 4
                                            })}
                                        </p>
                                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                            (Valor com taxa incluída)
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h3 className="text-lg font-semibold text-red-600">Melhor Venda</h3>
                                    <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                                        <div className="flex items-center gap-3 mb-2">
                                            <img 
                                                src={getExchangeLogo(cotacaoData.response.exchange_maior_valor_venda)} 
                                                alt={cotacaoData.response.exchange_maior_valor_venda}
                                                className="w-8 h-8 rounded-full object-contain bg-white p-1"
                                                loading="lazy"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.src = '/placeholder.svg';
                                                }}
                                            />
                                            <span className="text-sm text-red-600 dark:text-red-400 font-medium">
                                                {cotacaoData.response.exchange_maior_valor_venda}
                                            </span>
                                        </div>
                                        <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                                            R$ {parseFloat(cotacaoData.response.maior_valor_venda).toLocaleString('pt-BR', {
                                                minimumFractionDigits: 4,
                                                maximumFractionDigits: 4
                                            })}
                                        </p>
                                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                            (Valor com taxa incluída)
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tabela de Cotações por Exchange */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Cotações Detalhadas por Exchange</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Valores com taxa incluem as taxas da exchange. Valores sem taxa são os preços originais.
                            </p>
                        </CardHeader>
                        <CardContent>
                            {/* Layout Desktop - Tabela Expandida */}
                            <div className="hidden lg:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Exchange</TableHead>
                                            <TableHead className="text-right text-green-600">Compra (Com Taxa)</TableHead>
                                            <TableHead className="text-right text-green-500">Compra (Sem Taxa)</TableHead>
                                            <TableHead className="text-right text-red-600">Venda (Com Taxa)</TableHead>
                                            <TableHead className="text-right text-red-500">Venda (Sem Taxa)</TableHead>
                                            <TableHead className="text-right">Spread</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {getOrderedExchanges(exchangesToRender).map(([exchange, data]) => {
                                            const compraComTaxa = parseFloat(data.preco_compra);
                                            const compraSemTaxa = parseFloat(data.preco_compra_original);
                                            const vendaComTaxa = parseFloat(data.preco_venda);
                                            const vendaSemTaxa = parseFloat(data.preco_venda_original);
                                            const spread = ((compraComTaxa - vendaComTaxa) / vendaComTaxa * 100);
                                            
                                            // Verificar se é FOXBIT sem dados válidos
                                            const isEmptyFoxbit = exchange === 'FOXBIT' && (compraComTaxa === 0 || vendaComTaxa === 0);
                                            
                                            return (
                                                <TableRow key={exchange} className={isEmptyFoxbit ? 'opacity-50' : ''}>
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <img 
                                                                src={getExchangeLogo(exchange)} 
                                                                alt={exchange}
                                                                className="w-6 h-6 rounded-full object-contain bg-white p-0.5"
                                                                loading="lazy"
                                                                onError={(e) => {
                                                                    const target = e.target as HTMLImageElement;
                                                                    target.src = '/placeholder.svg';
                                                                }}
                                                            />
                                                            {exchange}
                                                            {isEmptyFoxbit && <span className="text-xs text-muted-foreground">(aguardando...)</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-green-600 dark:text-green-400 font-semibold">
                                                        {isEmptyFoxbit ? (
                                                            <span className="text-muted-foreground">--</span>
                                                        ) : (
                                                            `R$ ${compraComTaxa.toLocaleString('pt-BR', {
                                                                minimumFractionDigits: 4,
                                                                maximumFractionDigits: 4
                                                            })}`
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right text-green-500 dark:text-green-300">
                                                        {isEmptyFoxbit ? (
                                                            <span className="text-muted-foreground">--</span>
                                                        ) : (
                                                            `R$ ${compraSemTaxa.toLocaleString('pt-BR', {
                                                                minimumFractionDigits: 4,
                                                                maximumFractionDigits: 4
                                                            })}`
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right text-red-600 dark:text-red-400 font-semibold">
                                                        {isEmptyFoxbit ? (
                                                            <span className="text-muted-foreground">--</span>
                                                        ) : (
                                                            `R$ ${vendaComTaxa.toLocaleString('pt-BR', {
                                                                minimumFractionDigits: 4,
                                                                maximumFractionDigits: 4
                                                            })}`
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right text-red-500 dark:text-red-300">
                                                        {isEmptyFoxbit ? (
                                                            <span className="text-muted-foreground">--</span>
                                                        ) : (
                                                            `R$ ${vendaSemTaxa.toLocaleString('pt-BR', {
                                                                minimumFractionDigits: 4,
                                                                maximumFractionDigits: 4
                                                            })}`
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {isEmptyFoxbit ? (
                                                            <Badge variant="outline">--</Badge>
                                                        ) : (
                                                            <Badge variant={spread < 1 ? "default" : spread < 2 ? "secondary" : "destructive"}>
                                                                {spread.toFixed(2)}%
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Layout Mobile/Tablet - Cards Expandidos */}
                            <div className="lg:hidden space-y-4">
                                {getOrderedExchanges(exchangesToRender).map(([exchange, data]) => {
                                    const compraComTaxa = parseFloat(data.preco_compra);
                                    const compraSemTaxa = parseFloat(data.preco_compra_original);
                                    const vendaComTaxa = parseFloat(data.preco_venda);
                                    const vendaSemTaxa = parseFloat(data.preco_venda_original);
                                    const spread = ((compraComTaxa - vendaComTaxa) / vendaComTaxa * 100);
                                    
                                    // Verificar se é FOXBIT sem dados válidos
                                    const isEmptyFoxbit = exchange === 'FOXBIT' && (compraComTaxa === 0 || vendaComTaxa === 0);
                                    
                                    return (
                                        <Card key={exchange} className={`border-2 ${isEmptyFoxbit ? 'opacity-50' : ''}`}>
                                            <CardContent className="pt-4">
                                                <div className="space-y-4">
                                                    {/* Nome da Exchange com logo */}
                                                    <div className="text-center">
                                                        <div className="flex items-center justify-center gap-2 mb-3">
                                                            <img 
                                                                src={getExchangeLogo(exchange)} 
                                                                alt={exchange}
                                                                className="w-8 h-8 rounded-full object-contain bg-white p-1"
                                                                loading="lazy"
                                                                onError={(e) => {
                                                                    const target = e.target as HTMLImageElement;
                                                                    target.src = '/placeholder.svg';
                                                                }}
                                                            />
                                                            <h3 className="font-bold text-lg">{exchange}</h3>
                                                            {isEmptyFoxbit && <span className="text-xs text-muted-foreground">(aguardando...)</span>}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Seção Compra */}
                                                    <div className="space-y-2">
                                                        <h4 className="text-sm font-semibold text-green-700 dark:text-green-300 text-center">
                                                            💰 COMPRA
                                                        </h4>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="text-center bg-green-100 dark:bg-green-950 p-3 rounded-lg border-2 border-green-300 dark:border-green-700">
                                                                <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">
                                                                    Com Taxa
                                                                </p>
                                                                <p className="text-sm font-bold text-green-600 dark:text-green-400">
                                                                    {isEmptyFoxbit ? (
                                                                        <span className="text-muted-foreground">--</span>
                                                                    ) : (
                                                                        `R$ ${compraComTaxa.toLocaleString('pt-BR', {
                                                                            minimumFractionDigits: 4,
                                                                            maximumFractionDigits: 4
                                                                        })}`
                                                                    )}
                                                                </p>
                                                            </div>
                                                            
                                                            <div className="text-center bg-green-50 dark:bg-green-900/50 p-3 rounded-lg border border-green-200 dark:border-green-600">
                                                                <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">
                                                                    Sem Taxa
                                                                </p>
                                                                <p className="text-sm font-bold text-green-500 dark:text-green-300">
                                                                    {isEmptyFoxbit ? (
                                                                        <span className="text-muted-foreground">--</span>
                                                                    ) : (
                                                                        `R$ ${compraSemTaxa.toLocaleString('pt-BR', {
                                                                            minimumFractionDigits: 4,
                                                                            maximumFractionDigits: 4
                                                                        })}`
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Seção Venda */}
                                                    <div className="space-y-2">
                                                        <h4 className="text-sm font-semibold text-red-700 dark:text-red-300 text-center">
                                                            💸 VENDA
                                                        </h4>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="text-center bg-red-100 dark:bg-red-950 p-3 rounded-lg border-2 border-red-300 dark:border-red-700">
                                                                <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">
                                                                    Com Taxa
                                                                </p>
                                                                <p className="text-sm font-bold text-red-600 dark:text-red-400">
                                                                    {isEmptyFoxbit ? (
                                                                        <span className="text-muted-foreground">--</span>
                                                                    ) : (
                                                                        `R$ ${vendaComTaxa.toLocaleString('pt-BR', {
                                                                            minimumFractionDigits: 4,
                                                                            maximumFractionDigits: 4
                                                                        })}`
                                                                    )}
                                                                </p>
                                                            </div>
                                                            
                                                            <div className="text-center bg-red-50 dark:bg-red-900/50 p-3 rounded-lg border border-red-200 dark:border-red-600">
                                                                <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">
                                                                    Sem Taxa
                                                                </p>
                                                                <p className="text-sm font-bold text-red-500 dark:text-red-300">
                                                                    {isEmptyFoxbit ? (
                                                                        <span className="text-muted-foreground">--</span>
                                                                    ) : (
                                                                        `R$ ${vendaSemTaxa.toLocaleString('pt-BR', {
                                                                            minimumFractionDigits: 4,
                                                                            maximumFractionDigits: 4
                                                                        })}`
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Spread */}
                                                    <div className="text-center pt-2 border-t">
                                                        <p className="text-xs text-muted-foreground mb-1">Spread</p>
                                                        {isEmptyFoxbit ? (
                                                            <Badge variant="outline">--</Badge>
                                                        ) : (
                                                            <Badge variant={spread < 1 ? "default" : spread < 2 ? "secondary" : "destructive"}>
                                                                {spread.toFixed(2)}%
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                </div>
            )}
        </div>
    );
}