import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, ArrowDownCircle, ArrowUpCircle, CreditCard, DollarSign, Info } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { TransactionSearchForm } from "@/components/TransactionSearchForm";
import { TransactionTable } from "@/components/TransactionTable";
import { FinancialSummaryCard } from "@/components/FinancialSummaryCard";
import { Transaction } from "@/types/transaction";
import { formatCurrency } from "@/utils/date";
import { ExportData } from "@/services/pdfExport";
import { Skeleton } from "primereact/skeleton";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import "@/styles/skeleton.css";

interface SearchParams {
    accountNumber: string;
    startDate: number;
    endDate: number;
}

export default function ExtratoTcr() {
    const [searchParams, setSearchParams] = useState<SearchParams | null>(null);
    const { data, isLoading, error } = useTransactions({
        accountNumber: searchParams?.accountNumber || "",
        startDate: searchParams?.startDate || 0,
        endDate: searchParams?.endDate || 0,
        enabled: !!searchParams,
    });
    const [saldoApi, setSaldoApi] = useState<string | null>(null);
    const [isLoadingSaldo, setIsLoadingSaldo] = useState(false);

    const transactions = data?.response?.transactions || [];

    // Log para debug - quantos registros foram retornados
    console.log(`[ExtratoTcr] Total de transações retornadas: ${transactions.length}`);
    console.log(`[ExtratoTcr] Data da API completa:`, data);

    // Calcular saldos e estatísticas
    const calculateStats = () => {
        let totalEntries = 0;
        let totalExits = 0;
        let totalFees = 0;
        let lastBalance = "0";

        transactions.forEach((transaction: Transaction) => {
            if (transaction.side === 'in') {
                totalEntries += parseFloat(transaction.amount);
            } else {
                totalExits += parseFloat(transaction.amount);
            }
            totalFees += parseFloat(transaction.fee);

            // Atualizar o último saldo conhecido
            if (transaction.balanceAfter) {
                lastBalance = transaction.balanceAfter;
            }
        });

        const balance = parseFloat(lastBalance);
        const netFlow = totalEntries - totalExits;

        return {
            balance,
            totalEntries,
            totalExits,
            totalFees,
            netFlow,
        };
    };

    const stats = calculateStats();

    // Preparar dados para exportação
    const exportData: ExportData | undefined = searchParams ? {
        transactions,
        searchParams,
        stats,
        saldoApi: saldoApi || undefined
    } : undefined;



    const handleSearch = async (values: SearchParams) => {
        setSearchParams(values);
        setIsLoadingSaldo(true);
        setSaldoApi(null);
        try {
            const response = await fetch(`https://vps80270.cloudpublic.com.br/api/b8cash/consultarSaldo?accountNumber=${values.accountNumber}`, {
                headers: {
                    'x-api-enterprise': 'tcr'
                }
            });
            if (!response.ok) {
                let errorMsg = 'Erro ao consultar saldo';
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.message || errorData.mensagem || `Erro ${response.status}`;
                } catch (e) {
                    errorMsg = `Erro ${response.status} ao consultar saldo`;
                }
                throw new Error(errorMsg);
            }
            const data = await response.json();

            // Extrai e formata o saldo disponível da resposta da API
            if (data.response?.success && data.response?.data?.available !== undefined) {
                const availableBalanceString = data.response.data.available;
                const availableBalance = parseFloat(availableBalanceString);

                if (isNaN(availableBalance)) {
                    console.error("Falha ao converter saldo para número. Valor recebido:", availableBalanceString);
                    setSaldoApi('Inválido'); // Indica valor inválido na UI
                } else {
                    setSaldoApi(formatCurrency(availableBalance));
                }
            } else {
                throw new Error(data.response?.message || data.mensagem || "Formato de resposta inesperado do saldo.");
            }

        } catch (e) {
            console.error("Erro ao buscar saldo:", e);
            setSaldoApi(null);
        } finally {
            setIsLoadingSaldo(false);
        }
    };

    // Componente de Skeleton para os cards de resumo financeiro
    const SummarySkeleton = () => (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="overflow-hidden">
                    <CardContent className="p-0">
                        <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <Skeleton width="40%" height="20px" className="rounded-md" />
                                <Skeleton shape="circle" size="32px" />
                            </div>
                            <Skeleton width="60%" height="36px" className="rounded-md mt-2" />
                            <Skeleton width="80%" height="16px" className="rounded-md" />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );

    // Componente de Skeleton da tabela de transações com estilo moderno
    const TableSkeleton = () => (
        <div className="space-y-4">
            {/* Cabeçalho da tabela com visual mais moderno */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Skeleton width="120px" height="36px" className="rounded-md" />
                    <Skeleton width="160px" height="36px" className="rounded-md" />
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton width="140px" height="36px" className="rounded-md" />
                    <Skeleton width="90px" height="36px" className="rounded-md" />
                </div>
            </div>

            {/* Cabeçalho das colunas */}
            <div className="grid grid-cols-7 gap-4 mb-2">
                <Skeleton width="90%" height="36px" className="table-header" />
                <Skeleton width="95%" height="36px" className="table-header" />
                <Skeleton width="90%" height="36px" className="table-header" />
                <Skeleton width="95%" height="36px" className="table-header" />
                <Skeleton width="90%" height="36px" className="table-header" />
                <Skeleton width="95%" height="36px" className="table-header" />
                <Skeleton width="80%" height="36px" className="table-header" />
            </div>

            {/* Linhas da tabela com variação de largura para efeito mais realista */}
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="grid grid-cols-7 gap-4">
                    <Skeleton width={`${85 + Math.random() * 15}%`} height="48px" className="table-row" />
                    <Skeleton width={`${85 + Math.random() * 15}%`} height="48px" className="table-row" />
                    <Skeleton width={`${85 + Math.random() * 15}%`} height="48px" className="table-row" />
                    <Skeleton width={`${85 + Math.random() * 15}%`} height="48px" className="table-row" />
                    <Skeleton width={`${85 + Math.random() * 15}%`} height="48px" className="table-row" />
                    <Skeleton width={`${85 + Math.random() * 15}%`} height="48px" className="table-row" />
                    <Skeleton width={`${70 + Math.random() * 20}%`} height="48px" className="table-row" />
                </div>
            ))}

            {/* Paginação */}
            <div className="flex justify-between items-center mt-6">
                <Skeleton width="120px" height="32px" className="rounded-md" />
                <div className="flex gap-2">
                    <Skeleton width="36px" height="36px" className="rounded-md" />
                    <Skeleton width="36px" height="36px" className="rounded-md" />
                    <Skeleton width="36px" height="36px" className="rounded-md" />
                    <Skeleton width="36px" height="36px" className="rounded-md" />
                    <Skeleton width="36px" height="36px" className="rounded-md" />
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Extrato TCR</h1>
                <p className="text-muted-foreground">
                    Consulte o extrato de transações da conta TCR
                </p>
            </div>

            <Tabs defaultValue="transactions" className="space-y-6">
                <div className="flex justify-between items-center">
                    <TabsList>
                        <TabsTrigger value="transactions">Transações</TabsTrigger>
                        <TabsTrigger value="reports">Relatórios</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="transactions" className="space-y-6">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle>Filtros de Pesquisa</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <TransactionSearchForm onSearch={handleSearch} isLoading={isLoading} />
                        </CardContent>
                    </Card>

                    {searchParams && (
                        <>
                            {isLoading ? (
                                <>
                                    <SummarySkeleton />
                                    <Card className="overflow-hidden">
                                        <CardHeader className="pb-3">
                                            <CardTitle>Transações</CardTitle>
                                        </CardHeader>
                                        <CardContent className="py-4">
                                            <TableSkeleton />
                                        </CardContent>
                                    </Card>
                                </>
                            ) : (
                                <>
                                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                                        <FinancialSummaryCard
                                            title="Saldo Total"
                                            value={isLoadingSaldo ? 'Carregando...' : (saldoApi !== null ? saldoApi : 'Erro ao buscar')}
                                            description="Saldo atual da conta (API)"
                                            icon={<Wallet className="h-5 w-5" />}
                                        />
                                        <FinancialSummaryCard
                                            title="Entradas"
                                            value={formatCurrency(stats.totalEntries)}
                                            description="Total de créditos no período"
                                            icon={<ArrowDownCircle className="h-5 w-5 text-green-500" />}
                                        />
                                        <FinancialSummaryCard
                                            title="Saídas"
                                            value={formatCurrency(stats.totalExits)}
                                            description="Total de débitos no período"
                                            icon={<ArrowUpCircle className="h-5 w-5 text-red-500" />}
                                        />
                                        <FinancialSummaryCard
                                            title="Taxas"
                                            value={formatCurrency(stats.totalFees)}
                                            description="Total de taxas no período"
                                            icon={<DollarSign className="h-5 w-5 text-yellow-500" />}
                                        />
                                    </div>

                                    {error ? (
                                        <Card>
                                            <CardContent className="py-10">
                                                <div className="flex flex-col items-center gap-4 text-center">
                                                    <div className="rounded-full bg-destructive/10 p-3">
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            width="24"
                                                            height="24"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            className="h-6 w-6 text-destructive"
                                                        >
                                                            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                                                            <path d="m9.09 9 5.82 5.82"></path>
                                                            <path d="m14.91 9-5.82 5.82"></path>
                                                        </svg>
                                                    </div>
                                                    <h3 className="text-lg font-semibold">Erro ao carregar transações</h3>
                                                    <p className="text-sm text-muted-foreground">
                                                        Ocorreu um erro ao tentar carregar as transações. Por favor, tente novamente.
                                                    </p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ) : transactions.length === 0 ? (
                                        <Card>
                                            <CardContent className="py-10">
                                                <div className="flex flex-col items-center gap-4 text-center">
                                                    <div className="rounded-full bg-primary/10 p-3">
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            width="24"
                                                            height="24"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            className="h-6 w-6 text-primary"
                                                        >
                                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                                        </svg>
                                                    </div>
                                                    <h3 className="text-lg font-semibold">Nenhuma transação encontrada</h3>
                                                    <p className="text-sm text-muted-foreground">
                                                        Não foram encontradas transações para o período selecionado.
                                                    </p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ) : (
                                        <TransactionTable data={transactions} exportData={exportData} />
                                    )}
                                </>
                            )}
                        </>
                    )}
                </TabsContent>

                <TabsContent value="reports" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Relatórios</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">Funcionalidade em desenvolvimento.</p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
} 