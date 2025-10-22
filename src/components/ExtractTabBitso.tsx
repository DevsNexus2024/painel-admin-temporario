import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Download, Filter, ArrowUpCircle, ArrowDownCircle, Loader2, FileText, Plus, Check, CheckSquare, X } from "lucide-react";
import { useBitsoExtrato } from "@/hooks/useBitsoExtrato";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import CreditExtractToOTCModal from "@/components/otc/CreditExtractToOTCModal";
import BulkCreditOTCModal from "@/components/otc/BulkCreditOTCModal";

export default function ExtractTabBitso() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({
    start: "",
    end: ""
  });

  // ✅ Estados para funcionalidade OTC
  const [creditOTCModalOpen, setCreditOTCModalOpen] = useState(false);
  const [selectedExtractRecord, setSelectedExtractRecord] = useState<any>(null);
  const [creditedRecords, setCreditedRecords] = useState<Set<string>>(new Set());

  // 🆕 Estados para crédito em lote
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [bulkOTCModalOpen, setBulkOTCModalOpen] = useState(false);

  const { extrato, loading, error, refetch } = useBitsoExtrato({
    start_date: dateFilter.start,
    end_date: dateFilter.end
  });

  const transactions = extrato?.transactions || [];

  // Filtrar transações pelo termo de busca
  const filteredTransactions = useMemo(() => {
    if (!searchTerm) return transactions;
    
    const term = searchTerm.toLowerCase();
    return transactions.filter((t: any) =>
      t.id?.toLowerCase().includes(term) ||
      t.description?.toLowerCase().includes(term) ||
      t.amount?.toString().includes(term)
    );
  }, [transactions, searchTerm]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('pt-BR');
    } catch {
      return dateString;
    }
  };

  const getTransactionIcon = (type: 'credit' | 'debit') => {
    if (type === 'credit') {
      return <ArrowDownCircle className="h-5 w-5 text-green-500" />;
    }
    return <ArrowUpCircle className="h-5 w-5 text-red-500" />;
  };

  const exportToCSV = () => {
    const headers = ['Data', 'Descrição', 'Tipo', 'Valor', 'ID'];
    const rows = filteredTransactions.map((t: any) => [
      formatDate(t.date),
      t.description,
      t.type === 'credit' ? 'Crédito' : 'Débito',
      t.amount,
      t.id
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `extrato-bitso-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // ✅ Funções para OTC
  const isRecordCredited = (transaction: any): boolean => {
    const recordKey = `bitso-${transaction.id}`;
    return creditedRecords.has(recordKey);
  };

  const handleCreditToOTC = async (transaction: any, event: React.MouseEvent) => {
    event.stopPropagation(); // Evitar que abra o modal de detalhes
    
    // Verificar se já foi creditado antes de abrir modal
    if (isRecordCredited(transaction)) {
      toast.error('Registro já creditado', {
        description: 'Este registro do extrato já foi creditado para um cliente OTC'
      });
      return;
    }
    
    setSelectedExtractRecord(transaction);
    setCreditOTCModalOpen(true);
  };

  const handleCloseCreditOTCModal = (wasSuccessful?: boolean) => {
    // Se operação foi realizada com sucesso, marcar como creditado
    if (wasSuccessful && selectedExtractRecord) {
      const recordKey = `bitso-${selectedExtractRecord.id}`;
      setCreditedRecords(prev => new Set(prev).add(recordKey));
    }
    
    setCreditOTCModalOpen(false);
    setSelectedExtractRecord(null);
  };

  // 🆕 Funções para modo lote
  const toggleTransactionSelection = (transactionId: string) => {
    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  };

  const selectAllVisibleCredits = () => {
    const creditTransactions = filteredTransactions
      .filter(t => t.type === 'credit' && !isRecordCredited(t))
      .map(t => t.id);
    
    setSelectedTransactions(new Set(creditTransactions));
    toast.success(`${creditTransactions.length} transações selecionadas`);
  };

  const clearSelection = () => {
    setSelectedTransactions(new Set());
  };

  const toggleBulkMode = () => {
    const newBulkMode = !bulkMode;
    setBulkMode(newBulkMode);
    
    if (!newBulkMode) {
      clearSelection();
    } else {
      toast.info('Modo seleção ativado - clique nas transações para selecioná-las');
    }
  };

  const handleBulkCredit = () => {
    if (selectedTransactions.size === 0) {
      toast.error('Selecione pelo menos uma transação');
      return;
    }
    
    setBulkOTCModalOpen(true);
  };

  const handleCloseBulkOTCModal = (wasSuccessful?: boolean, successfulIds?: string[]) => {
    if (wasSuccessful && successfulIds && successfulIds.length > 0) {
      // Marcar todas as transações creditadas com sucesso
      setCreditedRecords(prev => {
        const newSet = new Set(prev);
        successfulIds.forEach(id => newSet.add(`bitso-${id}`));
        return newSet;
      });
      
      // Limpar seleção
      clearSelection();
    }
    
    setBulkOTCModalOpen(false);
  };

  // Obter transações selecionadas
  const getSelectedTransactionsData = () => {
    return filteredTransactions.filter(t => selectedTransactions.has(t.id));
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por ID, descrição ou valor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Input
              type="date"
              value={dateFilter.start}
              onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
              className="w-40"
            />
            <Input
              type="date"
              value={dateFilter.end}
              onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
              className="w-40"
            />
          </div>

          <Button
            variant="outline"
            onClick={refetch}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
            <span className="ml-2">Filtrar</span>
          </Button>

          <Button
            variant="outline"
            onClick={exportToCSV}
            disabled={filteredTransactions.length === 0}
          >
            <Download className="h-4 w-4" />
            <span className="ml-2">Exportar</span>
          </Button>
        </div>
      </Card>

      {/* 🆕 Barra de Ações em Lote */}
      <Card className={cn(
        "p-4 transition-all",
        bulkMode ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : "border-border"
      )}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant={bulkMode ? "default" : "outline"}
              onClick={toggleBulkMode}
              className={bulkMode ? "bg-blue-600 hover:bg-blue-700" : ""}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              {bulkMode ? "Sair do Modo Lote" : "Modo Seleção em Lote"}
            </Button>
            
            {bulkMode && (
              <>
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  {selectedTransactions.size} selecionada{selectedTransactions.size !== 1 ? 's' : ''}
                </Badge>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllVisibleCredits}
                  disabled={filteredTransactions.filter(t => t.type === 'credit' && !isRecordCredited(t)).length === 0}
                >
                  Selecionar Todas Visíveis
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  disabled={selectedTransactions.size === 0}
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpar Seleção
                </Button>
              </>
            )}
          </div>
          
          {bulkMode && selectedTransactions.size > 0 && (
            <Button
              onClick={handleBulkCredit}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Creditar {selectedTransactions.size} em Lote
            </Button>
          )}
        </div>
      </Card>

      {/* Lista de Transações */}
      <div className="space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-3 text-muted-foreground">Carregando transações...</span>
          </div>
        )}

        {error && (
          <Card className="p-6 text-center">
            <p className="text-red-500">Erro ao carregar extrato: {error}</p>
            <Button onClick={refetch} className="mt-4" variant="outline">
              Tentar Novamente
            </Button>
          </Card>
        )}

        {!loading && !error && filteredTransactions.length === 0 && (
          <Card className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma transação encontrada</p>
          </Card>
        )}

        {!loading && !error && filteredTransactions.map((transaction: any) => (
          <Card 
            key={transaction.id} 
            className={cn(
              "p-4 transition-all cursor-pointer",
              bulkMode && selectedTransactions.has(transaction.id) 
                ? "border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                : "hover:bg-muted/50 border-border"
            )}
            onClick={() => {
              if (bulkMode && transaction.type === 'credit' && !isRecordCredited(transaction)) {
                toggleTransactionSelection(transaction.id);
              }
            }}
          >
            <div className="flex items-center gap-4">
              {/* 🆕 Checkbox (só aparece em modo lote e para créditos não creditados) */}
              {bulkMode && transaction.type === 'credit' && !isRecordCredited(transaction) && (
                <Checkbox
                  checked={selectedTransactions.has(transaction.id)}
                  onCheckedChange={() => toggleTransactionSelection(transaction.id)}
                  className="h-5 w-5"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              
              <div className="flex items-center justify-between flex-1">
                <div className="flex items-center gap-4">
                  {getTransactionIcon(transaction.type)}
                  <div>
                    <p className="font-medium">{transaction.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(transaction.date)} • ID: {transaction.id}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* ✅ Botão OTC apenas para transações de crédito (oculto no modo lote) */}
                  {!bulkMode && transaction.type === 'credit' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreditToOTC(transaction, e);
                      }}
                      disabled={isRecordCredited(transaction)}
                      className={cn(
                        "h-8 px-3 text-xs transition-all",
                        isRecordCredited(transaction)
                          ? "bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed"
                          : "bg-green-50 hover:bg-green-100 text-green-700 border-green-200 hover:border-green-300"
                      )}
                      title={isRecordCredited(transaction) ? "Já creditado para cliente OTC" : "Creditar para cliente OTC"}
                    >
                      {isRecordCredited(transaction) ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Creditado
                        </>
                      ) : (
                        <>
                          <Plus className="h-3 w-3 mr-1" />
                          OTC
                        </>
                      )}
                    </Button>
                  )}
                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.type === 'credit' ? '+' : '-'} {formatCurrency(transaction.amount)}
                    </p>
                    <Badge variant={transaction.type === 'credit' ? 'default' : 'secondary'} className="mt-1">
                      {transaction.type === 'credit' ? 'Crédito' : 'Débito'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Resumo */}
      {!loading && !error && filteredTransactions.length > 0 && (
        <Card className="p-4 bg-muted/30">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              Total de transações: <strong>{filteredTransactions.length}</strong>
            </span>
            <span className="text-sm text-muted-foreground">
              Período: {dateFilter.start || 'Todas'} até {dateFilter.end || 'Hoje'}
            </span>
          </div>
        </Card>
      )}

      {/* ✅ Modal para crédito OTC (individual) */}
      <CreditExtractToOTCModal
        isOpen={creditOTCModalOpen}
        onClose={handleCloseCreditOTCModal}
        extractRecord={selectedExtractRecord}
      />

      {/* 🆕 Modal para crédito OTC em lote */}
      <BulkCreditOTCModal
        isOpen={bulkOTCModalOpen}
        onClose={handleCloseBulkOTCModal}
        transactions={getSelectedTransactionsData()}
      />
    </div>
  );
}


