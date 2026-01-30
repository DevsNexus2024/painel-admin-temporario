import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Filter, RefreshCw, Download, RotateCcw, AlertTriangle, DollarSign, Clock, ArrowUpDown, Plus, ArrowRightLeft } from 'lucide-react';
import jsPDF from 'jspdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useOTCStatement } from '@/hooks/useOTCStatement';
import { otcService } from '@/services/otc';
import { OTCTransaction, OTCBalanceHistory, TransactionType, TransactionStatus } from '@/types/otc';
import { formatTimestamp, formatOTCTimestamp } from '@/utils/date';
import { toast } from 'sonner';
import OTCOperationModal from '@/components/otc/OTCOperationModal';

interface AdminClientStatementProps {}

/**
 * Página dedicada para extrato administrativo do cliente OTC
 */
const AdminClientStatement: React.FC<AdminClientStatementProps> = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<string>('transactions');
  const [filters, setFilters] = useState({
    page: 1,
    limit: 1000, // Limite padrão de 1000 registros
    dateFrom: '',
    dateTo: '',
    hideReversals: false, // Admins podem ver operações de reversão
    operationType: undefined as 'conversion' | 'withdrawal' | 'credit' | undefined
  });

  // Estados para filtros adicionais
  const [showOnlyToday, setShowOnlyToday] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [searchDate, setSearchDate] = useState('');

  // Estados para reversão de operação
  const [reversalModalOpen, setReversalModalOpen] = useState(false);
  const [transactionToReverse, setTransactionToReverse] = useState<OTCTransaction | null>(null);
  const [isReversing, setIsReversing] = useState(false);
  const [reversalReason, setReversalReason] = useState('');

  // Estado para modal de operação
  const [operationModalOpen, setOperationModalOpen] = useState(false);

  // Estado para exportação PDF
  const [exportingPDF, setExportingPDF] = useState(false);

  // Função para exportar PDF do extrato administrativo
  const exportToPDF = async () => {
    if (!statement?.transacoes || !statement?.cliente) {
      toast.error('Nenhum dado disponível para exportar');
      return;
    }

    setExportingPDF(true);
    toast.info('Gerando PDF... Aguarde alguns segundos.');

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;

      // Configurar fonte
      pdf.setFont('helvetica');

      // === CABEÇALHO ===
      pdf.setFontSize(20);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'bold');
      pdf.text('EXTRATO ADMINISTRATIVO OTC', pageWidth / 2, yPosition + 10, { align: 'center' });
      
      pdf.setFontSize(11);
      pdf.setTextColor(60, 60, 60);
      pdf.setFont('helvetica', 'normal');
      const currentDate = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      pdf.text(`Relatório gerado em: ${currentDate}`, pageWidth / 2, yPosition + 18, { align: 'center' });
      
      // Linha divisória
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(1);
      pdf.line(margin, yPosition + 25, pageWidth - margin, yPosition + 25);
      yPosition += 35;

      // === INFORMAÇÕES DO CLIENTE ===
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DADOS DO CLIENTE', margin, yPosition);
      yPosition += 8;
      
      pdf.setDrawColor(0, 0, 0);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Nome: ${statement.cliente.name}`, margin, yPosition);
      yPosition += 5;
      pdf.text(`Documento: ${statement.cliente.document}`, margin, yPosition);
      yPosition += 5;
      pdf.text(`Chave PIX: ${statement.cliente.pix_key}`, margin, yPosition);
      yPosition += 5;
      
      // Saldos
      pdf.setTextColor(0, 128, 0); // Verde
      pdf.text(`Saldo BRL: R$ ${statement.cliente.current_balance.toFixed(2)}`, margin, yPosition);
      yPosition += 5;
      pdf.setTextColor(0, 0, 255); // Azul
      pdf.text(`Saldo USD: $ ${statement.cliente.usd_balance.toFixed(2)}`, margin, yPosition);
      yPosition += 10;

      // === TRANSAÇÕES ===
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'bold');
      pdf.text('HISTÓRICO DE TRANSAÇÕES', margin, yPosition);
      yPosition += 8;
      
      pdf.setDrawColor(0, 0, 0);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;

      // Cabeçalho da tabela
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Data', margin, yPosition);
      pdf.text('Tipo', margin + 30, yPosition);
      pdf.text('Valor', margin + 80, yPosition);
      pdf.text('Status', margin + 120, yPosition);
      pdf.text('Observações', margin + 150, yPosition);
      yPosition += 5;
      
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 3;

      // Transações
      const transacoes = filteredAndSortedTransactions.slice(0, 50); // Limitar a 50 transações
      pdf.setFont('helvetica', 'normal');
      
      for (const transaction of transacoes) {
        if (yPosition > pageHeight - 30) {
          pdf.addPage();
          yPosition = margin;
        }

        const date = new Date(transaction.date).toLocaleDateString('pt-BR');
        // Função simplificada para labels no PDF
        const getTransactionLabelPDF = (type: string, notes?: string) => {
          switch (type) {
            case 'deposit': return 'Depósito';
            case 'withdrawal': return 'Saque';
            case 'manual_credit': return 'Crédito Manual';
            case 'manual_debit': return 'Débito Manual';
            case 'manual_adjustment':
              if (notes?.includes('Conversão BRL→USD')) return 'Conversão BRL→USD';
              return 'Ajuste Manual';
            default: return type;
          }
        };
        const type = getTransactionLabelPDF(transaction.type, transaction.notes);
        
        // Determinar valor a exibir
        const usdValue = getUsdValueFromHistory(transaction.id);
        const isConversion = transaction.notes?.includes('Conversão BRL→USD');
        let valueText = '';
        
        if (isConversion && usdValue) {
          const brlValue = getBrlValueFromHistory(transaction.id);
          valueText = `-R$ ${Math.abs(brlValue || 0).toFixed(2)} +$ ${Math.abs(usdValue).toFixed(2)}`;
        } else if (transaction.amount === 0 && usdValue) {
          valueText = `${usdValue >= 0 ? '+' : ''}$ ${Math.abs(usdValue).toFixed(2)}`;
        } else {
          valueText = `${transaction.amount >= 0 ? '+' : ''}R$ ${Math.abs(transaction.amount).toFixed(2)}`;
        }

        pdf.setFontSize(8);
        pdf.text(date, margin, yPosition);
        pdf.text(type, margin + 30, yPosition);
        pdf.text(valueText, margin + 80, yPosition);
        pdf.text(transaction.status, margin + 120, yPosition);
        
        const notes = transaction.notes || '';
        const shortNotes = notes.length > 25 ? notes.substring(0, 25) + '...' : notes;
        pdf.text(shortNotes, margin + 150, yPosition);
        
        yPosition += 4;
      }

      // Salvar PDF
      pdf.save(`extrato-admin-${statement.cliente.name}-${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
      
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      // console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setExportingPDF(false);
    }
  };

  const {
    statement,
    isLoading,
    error,
    refetch
  } = useOTCStatement(clientId ? parseInt(clientId) : 0, filters);

  // Resetar filtros quando página carregar
  useEffect(() => {
    setShowOnlyToday(false);
    setSearchName('');
    setSearchValue('');
    setSearchDate('');
  }, [clientId]);

  // Atualizar filtros
  const updateFilters = (newFilters: Partial<typeof filters>) => {
    const updatedFilters = {
      ...filters,
      ...newFilters,
      page: newFilters.page || 1,
      hideReversals: newFilters.hideReversals !== undefined ? newFilters.hideReversals : filters.hideReversals
    };
    
    // console.log('[ADMIN-STATEMENT] Atualizando filtros:', {
    //   filtrosAnteriores: filters,
    //   novosFiltros: newFilters,
    //   filtrosFinais: updatedFilters
    // });

    // Log especial para filtros de data
    if (newFilters.dateFrom || newFilters.dateTo) {
      // console.log('[ADMIN-STATEMENT] Filtros de data sendo aplicados:', {
      //   dateFrom: updatedFilters.dateFrom,
      //   dateTo: updatedFilters.dateTo,
      //   dateFromReadable: updatedFilters.dateFrom ? new Date(updatedFilters.dateFrom).toString() : 'N/A',
      //   dateToReadable: updatedFilters.dateTo ? new Date(updatedFilters.dateTo).toString() : 'N/A'
      // });
    }
    
    setFilters(updatedFilters);
  };

  // Função para converter data do input para ISO string (mesma lógica do cliente)
  const convertDateToISO = (dateString: string, isEndDate = false): string => {
    if (!dateString) return '';
    
    try {
      // Para inputs do tipo date, a string vem no formato YYYY-MM-DD
      const [year, month, day] = dateString.split('-');
      
      // console.log('[DEBUG] Convertendo data:', {
      //   dateString,
      //   isEndDate,
      //   year: parseInt(year),
      //   month: parseInt(month) - 1, // JS month is 0-based
      //   day: parseInt(day)
      // });
      
      if (isEndDate) {
        // Para data final: YYYY-MM-DD 23:59:59 (mesma lógica do cliente)
        const fimData = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 23, 59, 59);
        const isoString = fimData.toISOString();
        // console.log('[DEBUG] Data final criada:', {
        //   dataLocal: fimData.toString(),
        //   dataISO: isoString,
        //   timezone: fimData.getTimezoneOffset()
        // });
        return isoString;
      } else {
        // Para data inicial: YYYY-MM-DD 00:00:00 (mesma lógica do cliente)
        const inicioData = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const isoString = inicioData.toISOString();
        // console.log('[DEBUG] Data inicial criada:', {
        //   dataLocal: inicioData.toString(),
        //   dataISO: isoString,
        //   timezone: inicioData.getTimezoneOffset()
        // });
        return isoString;
      }
    } catch (error) {
      // console.error('Erro ao converter data:', dateString, error);
      return '';
    }
  };

  // Função para atualizar filtro de data inicial
  const handleDateFromChange = (dateString: string) => {
    const isoDate = convertDateToISO(dateString, false);
    // console.log('[ADMIN-STATEMENT] Data inicial alterada:', { dateString, isoDate });
    updateFilters({ dateFrom: isoDate });
  };

  // Função para atualizar filtro de data final
  const handleDateToChange = (dateString: string) => {
    const isoDate = convertDateToISO(dateString, true);
    // console.log('[ADMIN-STATEMENT] Data final alterada:', { dateString, isoDate });
    updateFilters({ dateTo: isoDate });
  };

  // Função para converter ISO de volta para YYYY-MM-DD local
  const convertISOToLocalDate = (isoString: string): string => {
    if (!isoString) return '';
    
    try {
      const date = new Date(isoString);
      // Ajustar para timezone local antes de extrair os componentes
      const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
      const year = localDate.getUTCFullYear();
      const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(localDate.getUTCDate()).padStart(2, '0');
      
      const localDateString = `${year}-${month}-${day}`;
      
      // console.log('[DEBUG] Convertendo ISO para local:', {
      //   isoString,
      //   originalDate: date.toString(),
      //   localDate: localDate.toString(),
      //   resultString: localDateString
      // });
      
      return localDateString;
    } catch (error) {
      // console.error('Erro ao converter ISO para data local:', isoString, error);
      return '';
    }
  };

  // Limpar todos os filtros
  const clearAllFilters = () => {
    setFilters({
      page: 1,
      limit: 1000, // Limite padrão
      dateFrom: '',
      dateTo: '',
      hideReversals: false,
      operationType: undefined
    });
    setShowOnlyToday(false);
    setSearchName('');
    setSearchValue('');
    setSearchDate('');
  };

  // Função para selecionar data do calendário
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const formattedDate = date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      });
      setSearchDate(formattedDate);
      setShowOnlyToday(false);
    }
  };

  // Aplicar filtros de data quando necessário
  useEffect(() => {
    if (!clientId) return;

    let dateFilters: { dateFrom?: string; dateTo?: string } = {};
    
    if (showOnlyToday && !searchDate.trim()) {
      // Filtro de hoje
      const hoje = new Date();
      const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
      
      dateFilters.dateFrom = inicioHoje.toISOString();
      dateFilters.dateTo = fimHoje.toISOString();
    } else if (searchDate.trim()) {
      // Filtro de data específica
      try {
        const [day, month, year] = searchDate.split('/');
        const fullYear = year.length === 2 ? `20${year}` : year;
        const dataEspecifica = new Date(parseInt(fullYear), parseInt(month) - 1, parseInt(day));
        const inicioData = new Date(dataEspecifica.getFullYear(), dataEspecifica.getMonth(), dataEspecifica.getDate());
        const fimData = new Date(dataEspecifica.getFullYear(), dataEspecifica.getMonth(), dataEspecifica.getDate(), 23, 59, 59);
        
        dateFilters.dateFrom = inicioData.toISOString();
        dateFilters.dateTo = fimData.toISOString();
      } catch (error) {
        console.warn('Erro ao parsear data de filtro:', searchDate);
        dateFilters = {};
      }
    }

    // Aplicar filtros de data apenas se diferentes dos atuais
    if (dateFilters.dateFrom !== filters.dateFrom || dateFilters.dateTo !== filters.dateTo) {
      updateFilters(dateFilters);
    }
  }, [showOnlyToday, searchDate, clientId]);

  // Efeito adicional para aplicar filtros diretos de Data Inicial/Final
  useEffect(() => {
    if (!clientId) return;

    // Se houver filtros diretos sendo usados, aplicar imediatamente
    // mas apenas se não há outros filtros de data ativos
    if ((filters.dateFrom || filters.dateTo) && !showOnlyToday && !searchDate.trim()) {
      // console.log('[ADMIN-STATEMENT] Aplicando filtros diretos de data:', {
      //   dateFrom: filters.dateFrom,
      //   dateTo: filters.dateTo
      // });
      // Os filtros já estão no estado, apenas logar para debug
    }
  }, [filters.dateFrom, filters.dateTo, clientId, showOnlyToday, searchDate]);

  // Função para buscar valor USD da transação no histórico (movida para antes do useMemo)
  const getUsdValueFromHistory = (transactionId: number | string, manualOperationId?: number): number | null => {
    if (!statement?.historico_saldo) return null;
    
    // ✅ PRIORIDADE: Usar manual_operation.id se disponível (é o ID correto no histórico)
    let numericId: number;
    if (manualOperationId !== undefined) {
      numericId = manualOperationId;
    } else if (typeof transactionId === 'string' && transactionId.startsWith('conv_')) {
      // Converter "conv_35368" -> 35368
      numericId = parseInt(transactionId.replace('conv_', ''), 10);
    } else {
      numericId = typeof transactionId === 'string' ? parseInt(transactionId, 10) : transactionId;
    }
    
    // Buscar qualquer registro do histórico para esta transação (mesmo com valor 0)
    const historyRecord = statement.historico_saldo.find(
      h => h.transaction_id === numericId || 
           String(h.transaction_id) === String(transactionId) ||
           (manualOperationId !== undefined && h.transaction_id === manualOperationId)
    );
    
    // Retornar o valor USD (pode ser 0, null ou um valor)
    return historyRecord?.usd_amount_change !== undefined ? historyRecord.usd_amount_change : null;
  };

  // Filtrar e ordenar transações
  const filteredAndSortedTransactions = useMemo(() => {
    // ✅ CONSTRUIR TRANSAÇÕES A PARTIR DO HISTÓRICO quando necessário
    // Quando o filtro de withdrawal está ativo e não há transações, usar histórico
    let transactions = statement?.transacoes || [];
    
    // ✅ CONSTRUIR TRANSAÇÕES A PARTIR DO HISTÓRICO quando filtro de withdrawal está ativo
    // Se o filtro de withdrawal está ativo e não há transações, construir do histórico
    if (filters.operationType === 'withdrawal' && (!transactions || transactions.length === 0) && statement?.historico_saldo) {
      transactions = statement.historico_saldo
        .filter(history => {
          // Filtrar apenas saques (manual_debit com SAQUE na descrição ou withdrawal)
          const isWithdrawal = history.operation_type === 'withdrawal' || 
                              (history.operation_type === 'manual_debit' && 
                               history.description?.toUpperCase().includes('SAQUE'));
          return isWithdrawal;
        })
        .map(history => {
          // Determinar se é saque USD (tem movimento USD mas não tem movimento BRL)
          const isUsdWithdrawal = history.usd_amount_change !== 0 && history.amount_change === 0;
          
          return {
            id: history.transaction_id || history.id,
            type: (history.operation_type === 'withdrawal' ? 'withdrawal' : 'manual_debit') as TransactionType,
            amount: history.amount_change || 0, // Para saques USD, será 0
            date: history.created_at,
            status: 'processed' as TransactionStatus,
            payer_name: null,
            payer_document: null,
            bmp_identifier: null,
            notes: history.description || '',
            processed_by: (history as any).created_by || null,
            is_conversion: false,
            description: history.description || '',
            manual_operation: history.operation_type === 'manual_debit' ? {
              id: history.transaction_id || history.id,
              operation_type: 'debit',
              description: history.description || '',
              is_reversed_or_reversal: false
            } : null
          } as OTCTransaction;
        });
    }
    
    if (!transactions || transactions.length === 0) return [];

    let filtered = [...transactions];
    
    // ✅ FILTRO POR TIPO DE OPERAÇÃO (FRONTEND)
    // Aplicar filtro de conversão no frontend (não enviar para API)
    if (filters.operationType === 'conversion') {
      // Filtrar apenas conversões reais (excluir débitos USD puros e conversões vazias)
      filtered = filtered.filter(transaction => {
        // Verificar se é conversão
        const isConversion = transaction.is_conversion === true || 
                             transaction.type === 'conversion' ||
                             transaction.notes?.toLowerCase().includes('conversão');
        
        if (!isConversion) {
          return false; // Não é conversão, excluir
        }
        
        // ✅ EXCLUIR DÉBITOS USD PUROS (não são conversões)
        // Débitos USD são operações com amount = 0, movimento USD negativo, e contêm "SAQUE" nas notes
        const manualOpId = transaction.manual_operation?.id;
        const usdValue = getUsdValueFromHistory(transaction.id, manualOpId);
        const notesLower = transaction.notes?.toLowerCase() || '';
        
        // Se contém "SAQUE" nas notes, é débito USD puro (não conversão)
        if (notesLower.includes('saque') && !notesLower.includes('conversão')) {
          return false; // É débito USD puro (saque), excluir
        }
        
        // Se é manual_debit ou manual_adjustment com amount = 0 e movimento USD negativo
        // mas SEM "Conversão" nas notes e SEM is_conversion = true
        if ((transaction.type === 'manual_debit' || transaction.type === 'manual_adjustment') && 
            transaction.amount === 0) {
          
          // Se não tem "Conversão" nas notes e não é is_conversion, é débito USD puro
          if (!notesLower.includes('conversão') &&
              !transaction.is_conversion &&
              transaction.type !== 'conversion') {
            return false; // É débito USD puro, excluir
          }
          
          // Se tem movimento USD negativo e não tem "Conversão" explícita, é débito USD
          if (usdValue !== null && usdValue < 0 && 
              !notesLower.includes('conversão') &&
              !notesLower.includes('conversão brl→usd')) {
            return false; // É débito USD puro, excluir
          }
        }
        
        // ✅ EXCLUIR CONVERSÕES COM VALOR 0 E SEM MOVIMENTO USD
        if (transaction.amount === 0) {
          const hasUsdMovement = usdValue !== null && usdValue !== 0;
          
          // Se não tem movimento USD, é conversão vazia, excluir
          if (!hasUsdMovement) {
            return false;
          }
        }
        
        return true; // É conversão válida
      });
    } else if (filters.operationType === 'withdrawal') {
      // Filtrar apenas saques (já pode ter vindo filtrado da API, mas garantir)
      filtered = filtered.filter(transaction => {
        const isWithdrawal = transaction.type === 'withdrawal' ||
                            (transaction.type === 'manual_debit' && 
                             !transaction.notes?.toLowerCase().includes('conversão'));
        return isWithdrawal;
      });
    } else if (filters.operationType === 'credit') {
      // Filtrar apenas créditos/depósitos
      filtered = filtered.filter(transaction => {
        const isCredit = transaction.type === 'deposit' ||
                        transaction.type === 'manual_credit' ||
                        (transaction.type === 'manual_adjustment' && transaction.amount > 0);
        return isCredit;
      });
    }
    
    // ✅ OCULTAR CONVERSÕES COM VALOR 0 (sem movimento USD)
    // MAS NÃO OCULTAR quando o filtro operationType=conversion está ativo
    filtered = filtered.filter(transaction => {
      // Se o filtro de conversão está ativo, mostrar todas as conversões (já filtradas acima)
      if (filters.operationType === 'conversion') {
        return true; // Mostrar todas as conversões quando filtro está ativo
      }
      
      // Verificar se é conversão (is_conversion === true, type === 'conversion' ou notes contém "Conversão")
      const isConversion = transaction.is_conversion === true || 
                           transaction.type === 'conversion' ||
                           transaction.notes?.toLowerCase().includes('conversão');
      
      // Se não é conversão, manter
      if (!isConversion) {
        return true;
      }
      
      // Se é conversão, verificar se tem amount === 0
      if (transaction.amount !== 0) {
        return true; // Conversão com valor BRL, manter
      }
      
      // Se é conversão com amount === 0, verificar se tem movimento USD
      const manualOpId = transaction.manual_operation?.id;
      const usdValue = getUsdValueFromHistory(transaction.id, manualOpId);
      const hasUsdMovement = usdValue !== null && usdValue !== 0;
      
      // Se não tem movimento USD, ocultar (conversão vazia)
      if (!hasUsdMovement) {
        return false;
      }
      
      // Tem movimento USD, manter
      return true;
    });
    
    // Debug: Verificar se manual_operation está vindo nas transações


    // Filtro por nome/documento
    if (searchName.trim()) {
      const searchTerm = searchName.toLowerCase();
      filtered = filtered.filter(transaction => {
        const payerName = (transaction.payer_name || '').toLowerCase();
        const payerDoc = (transaction.payer_document || '').toLowerCase();
        const notes = (transaction.notes || '').toLowerCase();
        
        return payerName.includes(searchTerm) || 
               payerDoc.includes(searchTerm) || 
               notes.includes(searchTerm);
      });
    }

    // Filtro por valor
    if (searchValue.trim()) {
      const searchAmount = parseFloat(searchValue.replace(',', '.'));
      if (!isNaN(searchAmount)) {
        filtered = filtered.filter(transaction => {
          return Math.abs(transaction.amount) === Math.abs(searchAmount);
        });
      }
    }

    // Ordenação padrão por data (mais recente primeiro)
    // Considerando diferença de fuso horário entre operações manuais e automáticas
    filtered.sort((a, b) => {
      // Função para obter timestamp considerando tipo de operação
      const getOrderingTimestamp = (transaction: OTCTransaction): number => {
        const isManualOperation = ['manual_credit', 'manual_debit', 'manual_adjustment'].includes(transaction.type);
        
        if (typeof transaction.date === 'string') {
          const baseDate = new Date(transaction.date);
          
          // Se é operação manual, usar data direta (formatTimestamp)
          if (isManualOperation) {
            return baseDate.getTime();
          } else {
            // Se é operação automática, aplicar correção de fuso (+5h como no formatOTCTimestamp)
            return baseDate.getTime() + (5 * 60 * 60 * 1000); // +5 horas em ms
          }
        } else {
          // Se for timestamp numérico, usar diretamente
          return new Date(transaction.date).getTime();
        }
      };
      
      const timestampA = getOrderingTimestamp(a);
      const timestampB = getOrderingTimestamp(b);
      
      // Debug da ordenação para verificar se está funcionando
      if (process.env.NODE_ENV === 'development') {
        const formatForDebug = (tx: OTCTransaction) => ({
          id: tx.id,
          type: tx.type,
          originalDate: tx.date,
          timestamp: getOrderingTimestamp(tx),
          formattedDate: new Date(getOrderingTimestamp(tx)).toLocaleString('pt-BR')
        });
        
        // Log apenas para as primeiras comparações para não poluir
        if (Math.random() < 0.1) {
          // console.log('[ADMIN-STATEMENT] Ordenação DEBUG:', {
          //   a: formatForDebug(a),
          //   b: formatForDebug(b),
          //   comparison: timestampB - timestampA
          // });
        }
      }
      
      return timestampB - timestampA; // Mais recente primeiro
    });

    return filtered;
  }, [statement?.transacoes, searchName, searchValue, statement?.historico_saldo]);

  // Filtrar histórico de saldo
  const filteredBalanceHistory = useMemo(() => {
    if (!statement?.historico_saldo) return [];

    let filtered = [...statement.historico_saldo];

    // Filtro por descrição
    if (searchName.trim()) {
      const searchTerm = searchName.toLowerCase();
      filtered = filtered.filter(history => {
        const description = (history.description || '').toLowerCase();
        return description.includes(searchTerm);
      });
    }

    return filtered;
  }, [statement?.historico_saldo, searchName]);

  // Função para reverter operação
  const handleReverseOperation = async () => {
    if (!transactionToReverse) {
      toast.error('Nenhuma transação selecionada');
      return;
    }

    // Verificar se a transação tem operação manual associada
    if (!transactionToReverse.manual_operation?.id) {
      toast.error('Esta transação não possui operação manual associada para reversão');
      return;
    }

    // Validar motivo (mínimo 10 caracteres)
    if (!reversalReason.trim() || reversalReason.trim().length < 10) {
      toast.error('Motivo da reversão deve ter pelo menos 10 caracteres');
      return;
    }

    setIsReversing(true);
    try {
      // console.log('[ADMIN-STATEMENT] Enviando reversão:', {
      //   operationId: transactionToReverse.manual_operation.id,
      //   transactionId: transactionToReverse.id,
      //   reason: reversalReason.trim()
      // });
      
      await otcService.reverseOperation(transactionToReverse.manual_operation.id, reversalReason.trim());
      
      toast.success('Operação revertida com sucesso!');
      
      setReversalModalOpen(false);
      setTransactionToReverse(null);
      setReversalReason(''); // Limpar motivo
      refetch();
      
    } catch (error: any) {
      // console.error('Erro ao reverter operação:', error);
      
      // Capturar mensagem específica da API
      let errorMessage = 'Erro ao reverter operação';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast.error(errorMessage, {
        duration: 5000, // Mostrar por mais tempo para mensagens de erro
        description: 'Verifique os dados e tente novamente'
      });
    } finally {
      setIsReversing(false);
    }
  };

  // Função para gerar descrição automática da reversão
  const generateReversalReason = (transaction: OTCTransaction): string => {
    const operationType = transaction.manual_operation?.operation_type || transaction.type;
    const amount = transaction.amount;
    const date = formatTimestamp(transaction.date, 'dd/MM/yyyy');
    const isUsdOperation = transaction.notes?.toLowerCase().includes('usd');
    
    let operationLabel = '';
    switch (operationType) {
      case 'credit':
      case 'manual_credit':
        operationLabel = isUsdOperation ? 'crédito USD' : 'crédito BRL';
        break;
      case 'debit':
      case 'manual_debit':
        operationLabel = isUsdOperation ? 'débito USD' : 'débito BRL';
        break;
      case 'manual_adjustment':
        operationLabel = 'ajuste manual';
        break;
      default:
        operationLabel = operationType;
    }
    
    const valueText = isUsdOperation && amount === 0 
      ? 'conversão' 
      : `${otcService.formatCurrency(amount)}`;
    
    return `Estorno do ${operationLabel} de ${valueText} realizado em ${date} - Transação #${transaction.id}`;
  };

  // Função para abrir modal de confirmação de reversão
  const openReversalModal = (transaction: OTCTransaction) => {
    setTransactionToReverse(transaction);
    // Gerar descrição automática
    const autoReason = generateReversalReason(transaction);
    setReversalReason(autoReason);
    setReversalModalOpen(true);
  };

  // ✅ FUNÇÃO PARA BUSCAR VALOR BRL REAL DA CONVERSÃO
  const getBrlValueFromHistory = (transactionId: number | string, manualOperationId?: number): number | null => {
    if (!statement?.historico_saldo) return null;
    
    // ✅ PRIORIDADE: Usar manual_operation.id se disponível (é o ID correto no histórico)
    let numericId: number;
    if (manualOperationId !== undefined) {
      numericId = manualOperationId;
    } else if (typeof transactionId === 'string' && transactionId.startsWith('conv_')) {
      // Converter "conv_35368" -> 35368
      numericId = parseInt(transactionId.replace('conv_', ''), 10);
    } else {
      numericId = typeof transactionId === 'string' ? parseInt(transactionId, 10) : transactionId;
    }
    
    const historyRecord = statement.historico_saldo.find(
      h => (h.transaction_id === numericId || 
            String(h.transaction_id) === String(transactionId) ||
            (manualOperationId !== undefined && h.transaction_id === manualOperationId)) && 
           h.amount_change !== 0
    );
    
    return historyRecord?.amount_change || null;
  };

  // Componente de loading
  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex justify-between items-center p-3 border rounded">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="text-right space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );

  // Componente para transação
  const TransactionRow = ({ transaction }: { transaction: OTCTransaction }) => {
    const getTransactionIcon = (type: string) => {
      switch (type) {
        case 'deposit':
          return <ArrowUpDown className="w-4 h-4 text-green-600 rotate-180" />;
        case 'withdrawal':
          return <ArrowUpDown className="w-4 h-4 text-red-600" />;
        case 'manual_credit':
          return <DollarSign className="w-4 h-4 text-blue-600" />;
        case 'manual_debit':
          return <DollarSign className="w-4 h-4 text-orange-600" />;
        case 'manual_adjustment':
          return <DollarSign className="w-4 h-4 text-purple-600" />;
        case 'conversion':
          return <ArrowRightLeft className="w-4 h-4 text-purple-600" />;
        default:
          return <FileText className="w-4 h-4 text-gray-600" />;
      }
    };

    const getTransactionLabel = (type: string) => {
      switch (type) {
        case 'deposit':
          return 'Depósito';
        case 'withdrawal':
          return 'Saque';
        case 'manual_credit':
          return 'Crédito Manual';
        case 'manual_debit':
          return 'Débito Manual';
        case 'conversion':
          // ✅ CONVERSÃO - Verificar se tem movimento USD
          const usdValue = getUsdValueFromHistory(transaction.id);
          if (transaction.notes?.includes('Conversão BRL→USD')) {
            return 'Conversão BRL→USD';
          }
          if (transaction.notes?.includes('ESTORNO - Conversão USD→BRL')) {
            return 'Estorno Conversão USD→BRL';
          }
          if (usdValue !== null && usdValue !== 0) {
            return usdValue > 0 ? 'Conversão (Crédito USD)' : 'Conversão (Débito USD)';
          }
          return 'Conversão';
        case 'manual_adjustment':
          // ✅ DETECTAR CONVERSÕES ESPECIFICAMENTE
          if (transaction.notes?.includes('Conversão BRL→USD')) {
            return 'Conversão BRL→USD';
          }
          
          // ✅ DETECTAR ESTORNOS DE CONVERSÃO (USD→BRL)
          if (transaction.notes?.includes('ESTORNO - Conversão USD→BRL')) {
            return 'Estorno Conversão USD→BRL';
          }
          
          // ✅ DETECTAR OPERAÇÕES USD (amount = 0 mas tem movimento USD)
          // Mas NÃO mostrar "Conversão" se for saque USD
          const manualOpIdAdj = transaction.manual_operation?.id;
          const usdValueAdj = getUsdValueFromHistory(transaction.id, manualOpIdAdj);
          const notesLowerAdj = transaction.notes?.toLowerCase() || '';
          
          if (transaction.amount === 0 && usdValueAdj !== null) {
            // Se contém "SAQUE" nas notes, é saque USD (não conversão)
            if (notesLowerAdj.includes('saque') && !notesLowerAdj.includes('conversão')) {
              return 'Débito USD';
            }
            // Se não é conversão real, mostrar apenas Crédito/Débito USD
            if (!transaction.is_conversion && !notesLowerAdj.includes('conversão')) {
              return usdValueAdj > 0 ? 'Crédito USD' : 'Débito USD';
            }
            // Se é conversão, mostrar como conversão
            return usdValueAdj > 0 ? 'Conversão (Crédito USD)' : 'Conversão (Débito USD)';
          }
          
          return transaction.amount > 0 ? 'Crédito Manual' : 'Débito Manual';
        default:
          return type;
      }
    };

    const getStatusBadge = (status: string) => {
      switch (status) {
        case 'processed':
          return <Badge className="bg-green-100 text-green-800">Processado</Badge>;
        case 'pending':
          return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Pendente</Badge>;
        case 'failed':
          return <Badge variant="destructive">Falhou</Badge>;
        case 'cancelled':
          return <Badge variant="secondary">Cancelado</Badge>;
        default:
          return <Badge variant="outline">{status}</Badge>;
      }
    };

    // ✅ LÓGICA CORRIGIDA PARA CONVERSÕES
    const isConversionType = transaction.type === 'conversion' || transaction.is_conversion === true;
    const isConversion = transaction.notes?.includes('Conversão BRL→USD') || isConversionType;
    const isConversionReversal = transaction.notes?.includes('ESTORNO - Conversão USD→BRL');
    const isCredit = !isConversion && !isConversionReversal && (
      transaction.type === 'deposit' || 
      transaction.type === 'manual_credit' || 
      (transaction.type === 'manual_adjustment' && transaction.amount > 0)
    );

    return (
      <TableRow key={transaction.id}>
        <TableCell>
          <div className="flex items-center gap-2">
            {getTransactionIcon(transaction.type)}
            <div>
              <div className="font-medium">
                {getTransactionLabel(transaction.type)}
              </div>
              <div className="text-sm text-muted-foreground">
                {/* Usar mesma lógica do cliente: diferenciar operações manuais vs outras */}
                {(['manual_credit', 'manual_debit', 'manual_adjustment', 'conversion'].includes(transaction.type)) 
                  ? formatTimestamp(transaction.date, 'dd/MM/yy HH:mm')
                  : formatOTCTimestamp(transaction.date, 'dd/MM/yy HH:mm')
                }
              </div>
            </div>
          </div>
        </TableCell>
        
        <TableCell className="text-right">
          <div className="space-y-1">
            {(() => {
              // ✅ Usar manual_operation.id se disponível para buscar no histórico (mais preciso)
              const manualOpId = transaction.manual_operation?.id;
              const usdValue = getUsdValueFromHistory(transaction.id, manualOpId);
              const notesLower = transaction.notes?.toLowerCase() || '';
              
              // ✅ DETECTAR SE É CONVERSÃO REAL (não saque USD)
              const isRealConversion = transaction.type === 'conversion' || 
                                      (transaction.is_conversion === true && 
                                       !notesLower.includes('saque') &&
                                       (notesLower.includes('conversão') || 
                                        notesLower.includes('conversão brl→usd')));
              
              const isUsdOperation = transaction.notes?.toLowerCase().includes('usd') || 
                                   transaction.notes?.includes('Conversão BRL→USD') || 
                                   transaction.notes?.includes('ESTORNO - Conversão USD→BRL') ||
                                   isRealConversion;
              const isConversion = transaction.notes?.includes('Conversão BRL→USD') || isRealConversion;
              const isConversionReversal = transaction.notes?.includes('ESTORNO - Conversão USD→BRL');
              
              // ✅ CONVERSÃO DO TIPO "conversion" (nova estrutura da API)
              // Apenas se for conversão REAL (não saque USD)
              if (isRealConversion) {
                const usdValueConv = getUsdValueFromHistory(transaction.id, manualOpId);
                const brlValueConv = getBrlValueFromHistory(transaction.id, manualOpId);
                // Se tem movimento USD, mostrar conversão
                if (usdValueConv !== null && usdValueConv !== 0) {
                  return (
                    <>
                      {brlValueConv !== null && brlValueConv !== 0 && (
                        <div className="text-red-600 font-semibold">
                          -R$ {Math.abs(brlValueConv).toFixed(2)}
                        </div>
                      )}
                      <div className={`font-semibold ${usdValueConv >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {usdValueConv >= 0 ? '+' : ''}$ {Math.abs(usdValueConv).toFixed(2)}
                      </div>
                      <div className="text-xs text-white">
                        Conversão
                      </div>
                    </>
                  );
                }
              }
              
              // ✅ ESTORNO DE CONVERSÃO USD → BRL
              if (isConversionReversal && usdValue !== null) {
                const brlValue = getBrlValueFromHistory(transaction.id, manualOpId);
                return (
                  <>
                    <div className="text-green-600 font-semibold">
                      +R$ {Math.abs(brlValue || 0).toFixed(2)}
                    </div>
                    <div className="text-red-600 font-semibold">
                      -$ {Math.abs(usdValue).toFixed(2)}
                    </div>
                    <div className="text-xs text-white">
                      Estorno USD→BRL
                    </div>
                  </>
                );
              }
              
              // ✅ CONVERSÃO BRL → USD
              if (isConversion && usdValue !== null) {
                const brlValue = getBrlValueFromHistory(transaction.id, manualOpId);
                return (
                  <>
                    <div className="text-red-600 font-semibold">
                      -R$ {Math.abs(brlValue || 0).toFixed(2)}
                    </div>
                    <div className="text-green-600 font-semibold">
                      +$ {Math.abs(usdValue).toFixed(2)}
                    </div>
                    <div className="text-xs text-white">
                      Conversão BRL→USD
                    </div>
                  </>
                );
              }
              
              // ✅ OPERAÇÃO USD PURA (operação manual USD - saques USD)
              // Se não é conversão real e tem movimento USD, é saque USD
              if (!isRealConversion && isUsdOperation && transaction.amount === 0 && usdValue !== null) {
                return (
                  <>
                    <div className={`font-semibold ${usdValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {usdValue >= 0 ? '+' : ''}$ {Math.abs(usdValue).toFixed(2)}
                    </div>
                    <div className="text-xs text-white">
                      USD
                    </div>
                  </>
                );
              }
              
              // ✅ OPERAÇÃO BRL COM VALOR USD ADICIONAL
              if (isUsdOperation && transaction.amount !== 0 && usdValue !== null) {
                return (
                  <>
                    <div className={`font-semibold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                      {isCredit ? '+' : '-'}R$ {Math.abs(transaction.amount).toFixed(2)}
                    </div>
                    <div className={`text-xs font-medium ${usdValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {usdValue >= 0 ? '+' : ''}$ {Math.abs(usdValue).toFixed(2)}
                    </div>
                    <div className="text-xs text-white">
                      BRL + USD
                    </div>
                  </>
                );
              }
              
              // ✅ TRANSAÇÃO BRL NORMAL
              return (
                <>
                  <div className={`font-semibold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                    {isCredit ? '+' : '-'}R$ {Math.abs(transaction.amount).toFixed(2)}
                  </div>
                  <div className="text-xs text-white">
                    BRL
                  </div>
                </>
              );
            })()}
          </div>
        </TableCell>
        
        <TableCell className="text-center">
          {getStatusBadge(transaction.status)}
        </TableCell>
        
        <TableCell>
          <div className="text-sm space-y-2">
            {transaction.payer_name && (
              <div>
                <strong>Pagador:</strong> {transaction.payer_name}
              </div>
            )}
            {transaction.payer_document && (
              <div className="text-muted-foreground">
                {otcService.formatDocument(transaction.payer_document)}
              </div>
            )}
            {transaction.notes && (
              <div className="text-muted-foreground">
                {transaction.notes}
              </div>
            )}
            {transaction.processed_by && (
              <div className="text-xs text-muted-foreground">
                <strong>Processado por:</strong> {transaction.processed_by}
              </div>
            )}
            
            {/* Botão de estorno para operações manuais */}
            {(['manual_credit', 'manual_debit', 'manual_adjustment', 'conversion'].includes(transaction.type)) && 
             transaction.manual_operation?.id && 
             !(transaction.manual_operation as any)?.is_reversed_or_reversal && (
              <div className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => {
                    // console.log('[ADMIN-STATEMENT] Tentativa de estorno:', {
                    //   transactionId: transaction.id,
                    //   type: transaction.type,
                    //   manual_operation: transaction.manual_operation
                    // });
                    if (transaction.manual_operation?.id) {
                      openReversalModal(transaction);
                    } else {
                      toast.error('Operação manual não encontrada para esta transação');
                    }
                  }}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Estornar
                </Button>
              </div>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  // Componente para histórico de saldo
  const BalanceHistoryRow = ({ history }: { history: OTCBalanceHistory }) => {
    const hasUsdChange = history.usd_amount_change && history.usd_amount_change !== 0;
    const hasBrlChange = history.amount_change && history.amount_change !== 0;
    const isUsdOnlyOperation = hasUsdChange && !hasBrlChange;
    
    return (
      <TableRow key={history.id}>
        <TableCell>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-600" />
            <div>
              <div className="font-medium">
                {history.operation_type}
                {isUsdOnlyOperation && <span className="text-blue-600 text-xs ml-2">USD</span>}
              </div>
              <div className="text-sm text-muted-foreground">
                {/* Histórico sempre usa formatTimestamp (mesmo comportamento do cliente) */}
                {formatTimestamp(history.created_at, 'dd/MM/yy HH:mm')}
              </div>
            </div>
          </div>
        </TableCell>
        
        <TableCell className="text-right">
          {isUsdOnlyOperation ? (
            <div className={`font-semibold text-sm ${
              history.usd_amount_change >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {history.usd_amount_change >= 0 ? '+' : ''}
              $ {Math.abs(history.usd_amount_change).toFixed(2)}
            </div>
          ) : (
            <div className="space-y-1">
              {hasBrlChange && (
                <div className={`font-semibold text-sm ${
                  history.amount_change >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {history.amount_change >= 0 ? '+' : ''}
                  {otcService.formatCurrency(history.amount_change)} BRL
                </div>
              )}
              {hasUsdChange && (
                <div className={`font-semibold text-sm ${
                  history.usd_amount_change >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {history.usd_amount_change >= 0 ? '+' : ''}
                  $ {Math.abs(history.usd_amount_change).toFixed(2)} USD
                </div>
              )}
            </div>
          )}
        </TableCell>
        
        <TableCell>
          <div className="text-sm">
            <div>{history.description}</div>
            <div className="text-muted-foreground">
              por {history.created_by}
            </div>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  if (!clientId) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-red-600">Cliente não encontrado</p>
          <Button onClick={() => navigate('/otc')} className="mt-4">
            Voltar para Clientes OTC
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/otc')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6" />
              Extrato Administrativo
            </h1>
            <p className="text-muted-foreground">
              Histórico completo de transações e saldo de {statement?.cliente?.name || 'Carregando...'}
            </p>
          </div>
        </div>
        
        {/* ✅ BOTÃO NOVA OPERAÇÃO */}
        {statement?.cliente && (
          <Button
            onClick={() => setOperationModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Operação
          </Button>
        )}
      </div>

      {/* Informações do Cliente */}
      {statement?.cliente && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Informações do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Nome
                </Label>
                <p className="text-sm font-medium">{statement.cliente.name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Documento
                </Label>
                <p className="text-sm font-mono">
                  {otcService.formatDocument(statement.cliente.document)}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Chave PIX
                </Label>
                <p className="text-sm font-mono">
                  {statement.cliente.pix_key}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Saldo BRL
                </Label>
                <p className={`text-sm font-semibold ${
                  statement.cliente.current_balance >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {otcService.formatCurrency(statement.cliente.current_balance)}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Saldo USD
                </Label>
                <p className="text-sm font-semibold text-blue-600">
                  $ {parseFloat((statement.cliente as any).usd_balance || 0).toFixed(2)}
                </p>
                {(statement.cliente as any).last_conversion_rate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Taxa: {parseFloat((statement.cliente as any).last_conversion_rate || 0).toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros Completos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtros de Busca
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Toggle para mostrar apenas hoje */}
          <div className="mb-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showOnlyToday"
                checked={showOnlyToday}
                onCheckedChange={(checked) => setShowOnlyToday(checked as boolean)}
              />
              <Label htmlFor="showOnlyToday" className="text-sm font-medium cursor-pointer">
                📅 Mostrar apenas transações de hoje
              </Label>
              {showOnlyToday && (
                <span className="text-xs text-muted-foreground ml-2">
                  ({new Date().toLocaleDateString('pt-BR')})
                </span>
              )}
            </div>
            {showOnlyToday && (
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                Para ver outras datas, desmarque esta opção ou use o filtro de data abaixo
              </p>
            )}
          </div>

          {/* Filtros principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <Label htmlFor="searchName">Buscar por nome</Label>
              <Input
                id="searchName"
                placeholder="Nome ou documento do pagador"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="searchValue">Buscar por valor</Label>
              <Input
                id="searchValue"
                placeholder="Ex: 100.50"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="searchDate">Buscar por data</Label>
              <div className="flex gap-2">
                <Input
                  id="searchDate"
                  placeholder="Ex: 16/07/25"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  className="flex-1"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="px-3">
                      <CalendarDays className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={undefined}
                      onSelect={handleDateSelect}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div>
              <Label htmlFor="operationType">Tipo de Operação</Label>
              <Select
                value={filters.operationType || 'all'}
                onValueChange={(value) => updateFilters({ operationType: value === 'all' ? undefined : value as 'conversion' | 'withdrawal' | 'credit' })}
              >
                <SelectTrigger id="operationType">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="conversion">Conversões</SelectItem>
                  <SelectItem value="withdrawal">Saques</SelectItem>
                  <SelectItem value="credit">Créditos/Depósitos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Segunda linha de filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="dateFrom">Data Inicial</Label>
              <Input
                id="dateFrom"
                type="date"
                value={convertISOToLocalDate(filters.dateFrom)}
                onChange={(e) => handleDateFromChange(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dateTo">Data Final</Label>
              <Input
                id="dateTo"
                type="date"
                value={convertISOToLocalDate(filters.dateTo)}
                onChange={(e) => handleDateToChange(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="limit">Limite de Registros</Label>
              <Select
                value={filters.limit.toString()}
                onValueChange={(value) => updateFilters({ limit: parseInt(value) })}
              >
                <SelectTrigger id="limit">
                  <SelectValue placeholder="Selecione o limite" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1000">1.000 registros</SelectItem>
                  <SelectItem value="2000">2.000 registros</SelectItem>
                  <SelectItem value="5000">5.000 registros</SelectItem>
                  <SelectItem value="10000">10.000 registros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex items-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={clearAllFilters}
              disabled={isLoading}
            >
              Limpar Filtros
            </Button>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={exportingPDF || isLoading || !statement?.transacoes || filteredAndSortedTransactions.length === 0}
              onClick={exportToPDF}
            >
              <Download className="w-4 h-4 mr-2" />
              {exportingPDF ? 'Gerando PDF...' : 'Exportar PDF'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="transactions">Transações</TabsTrigger>
          <TabsTrigger value="balance_history">Histórico de Saldo</TabsTrigger>
        </TabsList>

        {/* Transações */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Transações</CardTitle>
            </CardHeader>
            <CardContent>
              {error ? (
                <div className="text-center py-8">
                  <p className="text-red-600">Erro ao carregar transações</p>
                </div>
              ) : isLoading ? (
                <LoadingSkeleton />
              ) : filteredAndSortedTransactions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Nenhuma transação encontrada
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[180px]">Transação</TableHead>
                          <TableHead className="text-right w-[200px]">Valor</TableHead>
                          <TableHead className="text-center w-[120px]">Status</TableHead>
                          <TableHead>Detalhes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndSortedTransactions.map((transaction) => (
                          <TransactionRow key={transaction.id} transaction={transaction} />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Info sobre total de transações */}
                  <div className="flex justify-center items-center mt-4">
                    <div className="text-sm text-muted-foreground">
                      Total: {filteredAndSortedTransactions.length} de {statement?.transacoes?.length || 0} transação(ões) encontrada(s)
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Histórico de Saldo */}
        <TabsContent value="balance_history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico de Saldo</CardTitle>
            </CardHeader>
            <CardContent>
              {error ? (
                <div className="text-center py-8">
                  <p className="text-red-600">Erro ao carregar histórico</p>
                </div>
              ) : isLoading ? (
                <LoadingSkeleton />
              ) : filteredBalanceHistory.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Nenhum histórico encontrado
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Operação</TableHead>
                          <TableHead className="text-right">Alteração</TableHead>
                          <TableHead>Descrição</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBalanceHistory.map((history) => (
                          <BalanceHistoryRow key={history.id} history={history} />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Info sobre total de registros históricos */}
                  <div className="flex justify-center items-center mt-4">
                    <div className="text-sm text-muted-foreground">
                      Total: {filteredBalanceHistory.length} de {statement?.historico_saldo?.length || 0} registro(s) de histórico encontrado(s)
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de confirmação de reversão */}
      <AlertDialog open={reversalModalOpen} onOpenChange={setReversalModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Confirmar Reversão da Operação
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 font-medium">
                    ⚠️ Esta ação não pode ser desfeita!
                  </p>
                  <p className="text-red-700 text-sm mt-1">
                    A operação será revertida e os saldos do cliente serão ajustados automaticamente.
                  </p>
                </div>
                
                {transactionToReverse && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Detalhes da Operação:</h4>
                    <div className="text-sm space-y-1">
                      <p><strong>Tipo:</strong> {transactionToReverse.type}</p>
                      <p><strong>Valor:</strong> {(() => {
                        const usdValue = getUsdValueFromHistory(transactionToReverse.id);
                        const isUsdOperation = transactionToReverse.notes?.toLowerCase().includes('usd');
                        
                        if (isUsdOperation && transactionToReverse.amount === 0 && usdValue !== null) {
                          return `$ ${Math.abs(usdValue).toFixed(2)} USD`;
                        }
                        
                        if (isUsdOperation && transactionToReverse.amount !== 0 && usdValue !== null) {
                          return `${otcService.formatCurrency(transactionToReverse.amount)} BRL + $ ${Math.abs(usdValue).toFixed(2)} USD`;
                        }
                        
                        return `${otcService.formatCurrency(transactionToReverse.amount)} BRL`;
                      })()}</p>
                      <p><strong>Data:</strong> {otcService.formatDate(transactionToReverse.date)}</p>
                      {transactionToReverse.notes && (
                        <p><strong>Observações:</strong> {transactionToReverse.notes}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Campo para motivo da reversão */}
                <div className="space-y-2">
                  <Label htmlFor="reversalReason" className="text-sm font-medium">
                    Motivo da Reversão *
                  </Label>
                  <div className="space-y-1">
                    <Input
                      id="reversalReason"
                      placeholder="Motivo gerado automaticamente (editável se necessário)"
                      value={reversalReason}
                      onChange={(e) => setReversalReason(e.target.value)}
                      disabled={isReversing}
                      className={`${reversalReason.length > 0 && reversalReason.length < 10 ? 'border-red-300' : ''} bg-gray-50 border-dashed`}
                    />
                    <p className="text-xs text-muted-foreground">
                      💡 Descrição gerada automaticamente. Você pode editá-la se necessário.
                    </p>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className={reversalReason.length < 10 ? 'text-red-500' : 'text-green-600'}>
                      {reversalReason.length < 10 
                        ? `Mínimo 10 caracteres (atual: ${reversalReason.length})`
                        : `✓ Motivo válido (${reversalReason.length} caracteres)`
                      }
                    </span>
                  </div>
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  A operação será revertida automaticamente com registro no sistema.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReversing}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReverseOperation}
              disabled={isReversing || reversalReason.trim().length < 10}
              className="bg-red-600 hover:bg-red-700"
            >
              {isReversing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Revertendo...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Confirmar Reversão
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ✅ MODAL DE OPERAÇÃO */}
      <OTCOperationModal
        isOpen={operationModalOpen}
        onClose={() => {
          setOperationModalOpen(false);
          refetch(); // Atualizar dados após operação
        }}
        client={statement?.cliente}
      />
    </div>
  );
};

export default AdminClientStatement;