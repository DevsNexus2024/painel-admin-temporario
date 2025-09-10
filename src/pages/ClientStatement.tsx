import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { otcService } from '@/services/otc';
import { OTCBalanceHistory, OTCTransaction } from '@/types/otc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarDays, User, FileText, ArrowUpRight, ArrowDownRight, AlertCircle, LogOut, Settings, Shield, Filter, RefreshCw, Download } from 'lucide-react';
import { formatCurrency, formatTimestamp, formatOTCTimestamp } from '@/utils/date';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ClientStatementData {
  cliente: {
    id: number;
    name: string;
    document: string;
    pix_key: string;
    current_balance: number;
    last_updated: string;
  };
  transacoes: OTCTransaction[];
  historico_saldo: OTCBalanceHistory[];
}

const ClientStatement: React.FC = () => {
  const { user, logout } = useAuth();
  const [data, setData] = useState<ClientStatementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingPDF, setExportingPDF] = useState(false);

  // Helper para detectar operação USD pura (não conversão)
  const isUSDOnlyOperation = (item: any): boolean => {
    return item.usd_amount_change && 
           Math.abs(item.usd_amount_change) > 0 && 
           !item.amount_change && 
           !item.conversion_rate; // Excluir conversões
  };
  
  // Estados para filtros de busca
  const [searchName, setSearchName] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "none">("none");
  const [sortBy, setSortBy] = useState<"value" | "date" | "none">("none");
  const [checkedItems, setCheckedItems] = useState<{[key: number]: boolean}>({});
  const [updatingCheck, setUpdatingCheck] = useState<number | null>(null);
  const [showOnlyToday, setShowOnlyToday] = useState(true); // Novo estado para controlar filtro do dia

  // Calcular total de depósitos (todos os depósitos: automáticos + manuais de crédito)
  // Considera filtros de data
  const totalDepositado = useMemo(() => {
    if (!data?.transacoes) return 0;
    
    let depositos = data.transacoes.filter(transacao => {
      const operationType = (transacao as any).operation_type || transacao.type;
      return operationType === 'deposit' || operationType === 'manual_credit';
    });

    // Aplicar filtro do dia atual se estiver ativo e não houver filtro de data específica
    if (showOnlyToday && !searchDate.trim()) {
      const hoje = new Date();
      const hojeFormatado = hoje.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      });
      
      depositos = depositos.filter(transacao => {
        // Usar sort_date para operações manuais, date para outras
        const dataTransacao = (transacao as any).sort_date || transacao.date;
        const operationType = (transacao as any).operation_type;
        
        // Aplicar correção de timezone apenas para operações não manuais
        const dataFormatada = (operationType === 'manual_credit' || operationType === 'manual_debit') 
          ? formatTimestamp(dataTransacao, 'dd/MM/yy')
          : formatOTCTimestamp(dataTransacao, 'dd/MM/yy');
        
        return dataFormatada === hojeFormatado;
      });
    }

    // Se tem filtro de data específica, aplicar o filtro
    if (searchDate.trim()) {
      depositos = depositos.filter(transacao => {
        // Usar sort_date para operações manuais, date para outras
        const dataTransacao = (transacao as any).sort_date || transacao.date;
        const operationType = (transacao as any).operation_type;
        
        // Aplicar correção de timezone apenas para operações não manuais
        const dataFormatada = (operationType === 'manual_credit' || operationType === 'manual_debit') 
          ? formatTimestamp(dataTransacao, 'dd/MM/yy')
          : formatOTCTimestamp(dataTransacao, 'dd/MM/yy');
        
        return dataFormatada === searchDate;
      });
    }
    
    return depositos.reduce((total, transacao) => total + transacao.amount, 0);
  }, [data?.transacoes, searchDate, showOnlyToday]);



  // Filtrar e ordenar transações
  // NOTA: Filtros de data agora são aplicados no backend, não aqui
  const filteredAndSortedTransactions = useMemo(() => {
    if (!data?.transacoes) return [];
    
    let filtered = data.transacoes;
    
    // Filtrar por nome do pagador
    if (searchName.trim()) {
      const searchTerm = searchName.toLowerCase();
      filtered = filtered.filter(transaction => 
        transaction.payer_name?.toLowerCase().includes(searchTerm) ||
        transaction.payer_document?.toLowerCase().includes(searchTerm)
      );
    }
    
    // Filtrar por valor específico
    if (searchValue.trim()) {
      const searchAmount = parseFloat(searchValue.replace(/[^\d,.-]/g, '').replace(',', '.'));
      if (!isNaN(searchAmount)) {
        filtered = filtered.filter(transaction => 
          Math.abs(transaction.amount - searchAmount) < 0.01
        );
      }
    }
    
    // SEMPRE ordenar por data (mais recente primeiro) como padrão
    // Considerando diferença de fuso horário entre operações manuais e automáticas
    filtered = [...filtered].sort((a, b) => {
      // Função para obter timestamp considerando tipo de operação
      const getOrderingTimestamp = (transaction: OTCTransaction): number => {
        const isManualOperation = ['manual_credit', 'manual_debit', 'manual_adjustment'].includes(transaction.type);
        
        // Sempre usar a data original da transação, não o created_at do histórico
        const dateToUse = transaction.date;
        
        if (typeof dateToUse === 'string') {
          const baseDate = new Date(dateToUse);
          
          // Se é operação manual, usar data direta (formatTimestamp)
          if (isManualOperation) {
            return baseDate.getTime();
          } else {
            // Se é operação automática, aplicar correção de fuso (+5h como no formatOTCTimestamp)
            return baseDate.getTime() + (5 * 60 * 60 * 1000); // +5 horas em ms
          }
        } else {
          // Se for timestamp numérico, usar diretamente
          return new Date(dateToUse).getTime();
        }
      };
      
      const timestampA = getOrderingTimestamp(a);
      const timestampB = getOrderingTimestamp(b);
      
      // Debug da ordenação para verificar se está funcionando
      if (process.env.NODE_ENV === 'development') {
        const formatForDebug = (tx: OTCTransaction) => ({
          id: tx.id,
          type: tx.type,
          originalDate: (tx as any).sort_date || tx.date,
          timestamp: getOrderingTimestamp(tx),
          formattedDate: new Date(getOrderingTimestamp(tx)).toLocaleString('pt-BR')
        });
        

      }
      
      return timestampB - timestampA; // Mais recente primeiro
    });
    
    // Aplicar ordenação personalizada se solicitada
    if (sortBy !== "none" && sortOrder !== "none") {
      filtered = [...filtered].sort((a, b) => {
        let comparison = 0;
        
        if (sortBy === "value") {
          comparison = a.amount - b.amount;
        } else if (sortBy === "date") {
          // Usar a mesma lógica de ordenação inteligente
          const getOrderingTimestamp = (transaction: OTCTransaction): number => {
            const isManualOperation = ['manual_credit', 'manual_debit', 'manual_adjustment'].includes(transaction.type);
            const dateToUse = transaction.date;
            
            if (typeof dateToUse === 'string') {
              const baseDate = new Date(dateToUse);
              if (isManualOperation) {
                return baseDate.getTime();
              } else {
                return baseDate.getTime() + (5 * 60 * 60 * 1000);
              }
            } else {
              return new Date(dateToUse).getTime();
            }
          };
          
          comparison = getOrderingTimestamp(a) - getOrderingTimestamp(b);
        }
        
        return sortOrder === "asc" ? comparison : -comparison;
      });
    }
    
    return filtered;
  }, [data?.transacoes, searchName, searchValue, sortBy, sortOrder]);

  // Limpar todos os filtros
  const clearAllFilters = () => {
    setSearchName("");
    setSearchValue("");
    setSearchDate("");
    setSelectedDate(undefined);
    setSortBy("none");
    setSortOrder("none");
    setShowOnlyToday(true); // Voltar ao padrão (mostrar apenas hoje)
  };

  // Função para lidar com seleção de data no calendário
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      const formattedDate = formatTimestamp(date.getTime() / 1000, 'dd/MM/yy');
      setSearchDate(formattedDate);
    } else {
      setSearchDate("");
    }
  };

  // Função para formatar USD no padrão brasileiro
  const formatUSD = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Função para lidar com o checkbox de conferência
  const handleCheckToggle = async (historyId: number, checked: boolean) => {
    if (!data?.cliente?.id) {
      toast.error('Erro: cliente não identificado');
      return;
    }

    setUpdatingCheck(historyId);

    try {
      // Fazer a chamada ao backend
      await otcService.updateHistoryCheckStatus(
        data.cliente.id,
        historyId,
        checked
      );

      // Atualizar estado local apenas se o backend foi bem-sucedido
      setCheckedItems(prev => ({
        ...prev,
        [historyId]: checked
      }));

      toast.success(checked ? 'Registro marcado como conferido' : 'Registro desmarcado');

    } catch (error) {

      toast.error('Erro ao salvar. Tente novamente.');
      
      // Reverter o estado do checkbox em caso de erro
      setCheckedItems(prev => ({
        ...prev,
        [historyId]: !checked
      }));
    } finally {
      setUpdatingCheck(null);
    }
  };

  // Estado para armazenar o ID do cliente encontrado
  const [clientId, setClientId] = useState<number | null>(null);

  useEffect(() => {
    if (user?.id) {
      findOTCClient();
    }
  }, [user?.id]);

  // Separar busca do cliente da busca do extrato
  const findOTCClient = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!user?.id) {
        throw new Error('Usuário não identificado. Faça login novamente.');
      }


      
      // Buscar cliente OTC vinculado ao usuário logado
      const clientsResponse = await otcService.getClients({ 
        limit: 200
      });
      
      if (!clientsResponse.data?.clientes || clientsResponse.data.clientes.length === 0) {
        throw new Error('Nenhum cliente OTC encontrado no sistema.');
      }

      // Buscar cliente específico vinculado ao usuário logado
      const client = clientsResponse.data.clientes.find(c => {
        return String(c.user?.id) === String(user.id) || 
               c.user?.email === user.email ||
               c.user?.name === user.name;
      });

      if (!client) {

        
        throw new Error(`Você não possui acesso a nenhum cliente OTC. Usuário: ${user.email} (ID: ${user.id})`);
      }



      // Verificar se o usuário tem permissão para acessar este cliente
      if (String(client.user?.id) !== String(user.id)) {
        throw new Error('Acesso negado. Você não tem permissão para visualizar este extrato.');
      }

      setClientId(client.id);
      
    } catch (error) {

      setError(error instanceof Error ? error.message : 'Erro desconhecido');
      setLoading(false);
    }
  };

  // Função para buscar extrato com filtros de data
  const fetchClientStatement = async (filters?: { dateFrom?: string; dateTo?: string }) => {
    if (!clientId) return;

    try {
      setLoading(true);
      setError(null);

      // Preparar filtros para enviar ao backend
      const statementParams: any = {
        limit: 10000 // Limite alto para cliente ver todos os seus registros
      };

      // Aplicar filtros de data se fornecidos
      if (filters?.dateFrom) {
        statementParams.dateFrom = filters.dateFrom;
      }
      if (filters?.dateTo) {
        statementParams.dateTo = filters.dateTo;
      }



      // Buscar extrato específico do cliente com filtros
      const statementResponse = await otcService.getClientStatement(clientId, statementParams);
      
      if (!statementResponse.success || !statementResponse.data) {
        throw new Error(statementResponse.message || 'Erro ao buscar extrato do cliente');
      }

      // Usar o histórico de saldo como base para garantir ordenação correta
      const historicoSaldo = statementResponse.data.historico_saldo || [];
      const transacoes = statementResponse.data.transacoes || [];
      
      const transacoesComSaldo = historicoSaldo.map((historico) => {
        // Encontrar a transação correspondente a este histórico
        const transacao = transacoes.find(t => t.id === historico.transaction_id);
        
        if (transacao) {
          // Usar os dados da transação complementados com o histórico
          return {
            ...transacao,
            saldo_anterior: historico.balance_before,
            saldo_posterior: historico.balance_after,
            operation_type: historico.operation_type,
            operation_description: historico.description,
            // Campos específicos do histórico para conversões
            amount_change: historico.amount_change,
            usd_amount_change: historico.usd_amount_change,
            usd_balance_before: historico.usd_balance_before,
            usd_balance_after: historico.usd_balance_after,
            conversion_rate: historico.conversion_rate,
            checked_by_client: historico.checked_by_client || false,
            history_id: historico.id,
            // REMOVIDO sort_date para usar sempre transaction.date original
            // sort_date: historico.created_at  // ← Isso estava causando ordenação incorreta
          };
        } else {
          // Caso não encontre a transação (não deveria acontecer normalmente)

          return null;
        }
      }).filter(Boolean); // Remove itens null

      setData({
        ...statementResponse.data,
        transacoes: transacoesComSaldo
      });

      // Inicializar checkboxes com dados do servidor
      const initialChecked: {[key: number]: boolean} = {};
      transacoesComSaldo.forEach(transacao => {
        if (transacao.history_id) {
          initialChecked[transacao.history_id] = transacao.checked_by_client || false;
        }
      });
      setCheckedItems(initialChecked);
      
    } catch (err) {

      setError(err instanceof Error ? err.message : 'Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  };

  // UseEffect para carregar extrato inicial quando clientId estiver disponível
  useEffect(() => {
    if (clientId) {
      // Determinar filtros de data baseados no estado atual
      let dateFilters: { dateFrom?: string; dateTo?: string } = {};
      
      if (showOnlyToday && !searchDate.trim()) {
        // Filtro de hoje: do início do dia até o final do dia
        const hoje = new Date();
        const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
        const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
        
        dateFilters.dateFrom = inicioHoje.toISOString();
        dateFilters.dateTo = fimHoje.toISOString();
      } else if (searchDate.trim()) {
        // Filtro de data específica: converter de dd/MM/yy para ISO
        try {
          const [day, month, year] = searchDate.split('/');
          const fullYear = year.length === 2 ? `20${year}` : year;
          const dataEspecifica = new Date(parseInt(fullYear), parseInt(month) - 1, parseInt(day));
          const inicioData = new Date(dataEspecifica.getFullYear(), dataEspecifica.getMonth(), dataEspecifica.getDate());
          const fimData = new Date(dataEspecifica.getFullYear(), dataEspecifica.getMonth(), dataEspecifica.getDate(), 23, 59, 59);
          
          dateFilters.dateFrom = inicioData.toISOString();
          dateFilters.dateTo = fimData.toISOString();
        } catch (error) {

          // Se houver erro no parse, buscar sem filtro de data
          dateFilters = {};
        }
      }
      // Se não houver filtros de data, buscar todos os registros (sem dateFrom/dateTo)
      
      fetchClientStatement(dateFilters);
    }
  }, [clientId, showOnlyToday, searchDate]);

  // Função para recarregar dados (para botões de atualizar)
  const handleRefresh = () => {
    if (clientId) {
      // Determinar filtros atuais baseados no estado
      let dateFilters: { dateFrom?: string; dateTo?: string } = {};
      
      if (showOnlyToday && !searchDate.trim()) {
        const hoje = new Date();
        const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
        const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
        
        dateFilters.dateFrom = inicioHoje.toISOString();
        dateFilters.dateTo = fimHoje.toISOString();
      } else if (searchDate.trim()) {
        try {
          const [day, month, year] = searchDate.split('/');
          const fullYear = year.length === 2 ? `20${year}` : year;
          const dataEspecifica = new Date(parseInt(fullYear), parseInt(month) - 1, parseInt(day));
          const inicioData = new Date(dataEspecifica.getFullYear(), dataEspecifica.getMonth(), dataEspecifica.getDate());
          const fimData = new Date(dataEspecifica.getFullYear(), dataEspecifica.getMonth(), dataEspecifica.getDate(), 23, 59, 59);
          
          dateFilters.dateFrom = inicioData.toISOString();
          dateFilters.dateTo = fimData.toISOString();
        } catch (error) {

          dateFilters = {};
        }
      }
      
      fetchClientStatement(dateFilters);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/login';
    } catch (error) {

      // Forçar logout mesmo se der erro
      window.location.href = '/login';
    }
  };

  // Função para exportar PDF - VERSÃO PROFISSIONAL PARA IMPRESSÃO
  const exportToPDF = async () => {
    if (!data) {
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

      // === CABEÇALHO PROFISSIONAL ===
      pdf.setFontSize(20);
      pdf.setTextColor(0, 0, 0); // Preto
      pdf.setFont('helvetica', 'bold');
      pdf.text('EXTRATO OTC', pageWidth / 2, yPosition + 10, { align: 'center' });
      
      pdf.setFontSize(11);
      pdf.setTextColor(60, 60, 60); // Cinza escuro
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
      pdf.setDrawColor(0, 0, 0); // Preto
      pdf.setLineWidth(1);
      pdf.line(margin, yPosition + 25, pageWidth - margin, yPosition + 25);
      
      yPosition += 35;

      // === INFORMAÇÕES DO CLIENTE ===
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0); // Preto
      pdf.setFont('helvetica', 'bold');
      pdf.text('DADOS DO CLIENTE', margin, yPosition);
      
      yPosition += 8;
      pdf.setDrawColor(0, 0, 0); // Preto
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 5;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0); // Preto
      
      // Grid simples de informações
      const clientData = [
        [`Nome: ${data.cliente.name}`, `Documento: ${data.cliente.document}`],
        [`Chave PIX: ${data.cliente.pix_key}`, `Saldo BRL: ${formatCurrency(data.cliente.current_balance)}`],
        [`Saldo USD: $ ${formatUSD(parseFloat((data.cliente as any).usd_balance || 0))}`, `Total Depositado: ${formatCurrency(totalDepositado)}${searchDate ? ` (${searchDate})` : ' (Hoje)'}`]
      ];
      
      clientData.forEach(([left, right]) => {
        yPosition += 6;
        pdf.text(left, margin, yPosition);
        pdf.text(right, pageWidth / 2 + 5, yPosition);
      });
      
      yPosition += 15;

      // === FILTROS (se houver) ===
      if (searchName || searchValue || searchDate || !showOnlyToday) {
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0); // Preto
        pdf.text('FILTROS APLICADOS', margin, yPosition);
        
        yPosition += 8;
        pdf.setDrawColor(0, 0, 0); // Preto
        pdf.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 5;
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(60, 60, 60); // Cinza escuro
        
        const filters = [];
        if (searchName) filters.push(`Nome: ${searchName}`);
        if (searchValue) filters.push(`Valor: ${searchValue}`);
        if (searchDate) filters.push(`Data: ${searchDate}`);
        if (!showOnlyToday) filters.push('Período: Todas as datas');
        else filters.push('Período: Apenas hoje');

        const filterText = filters.join(' | ');
        yPosition += 5;
        pdf.text(filterText, margin, yPosition);
        yPosition += 15;
      }

      // === TABELA DE TRANSAÇÕES ===
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0); // Preto
      pdf.text(`TRANSAÇÕES (${filteredAndSortedTransactions.length} registros)`, margin, yPosition);
      
      yPosition += 8;
      pdf.setDrawColor(0, 0, 0); // Preto
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 5;

      // Configuração da tabela
      const tableWidth = pageWidth - (margin * 2);
      const colWidths = [22, 30, 50, 30, 30, 30]; // Larguras ajustadas
      const rowHeight = 12; // Altura aumentada para acomodar texto
      
      // Cabeçalho da tabela
      pdf.setFillColor(240, 240, 240); // Cinza claro
      pdf.rect(margin, yPosition, tableWidth, 8, 'F');
      pdf.setDrawColor(0, 0, 0); // Preto
      pdf.rect(margin, yPosition, tableWidth, 8, 'S');
      
      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0); // Preto
      pdf.setFont('helvetica', 'bold');
      
      const headers = ['DATA', 'TIPO', 'PAGADOR/DESCRIÇÃO', 'VALOR', 'SALDO ANT.', 'SALDO POST.'];
      let xPos = margin + 2;
      
      headers.forEach((header, index) => {
        pdf.text(header, xPos, yPosition + 5);
        xPos += colWidths[index];
      });
      
      yPosition += 8;
      pdf.setFont('helvetica', 'normal');

      // Dados da tabela
      let rowIndex = 0;
      
      for (const item of filteredAndSortedTransactions) {
        // Nova página se necessário
        if (yPosition > pageHeight - 35) {
          pdf.addPage();
          yPosition = margin;
          
          // Repetir cabeçalho na nova página
          pdf.setFillColor(240, 240, 240);
          pdf.rect(margin, yPosition, tableWidth, 8, 'F');
          pdf.setDrawColor(0, 0, 0);
          pdf.rect(margin, yPosition, tableWidth, 8, 'S');
          
          pdf.setFontSize(9);
          pdf.setTextColor(0, 0, 0);
          pdf.setFont('helvetica', 'bold');
          
          xPos = margin + 2;
          headers.forEach((header, index) => {
            pdf.text(header, xPos, yPosition + 5);
            xPos += colWidths[index];
          });
          
          yPosition += 8;
          pdf.setFont('helvetica', 'normal');
          rowIndex = 0;
        }

        // Linha da tabela com fundo alternado
        if (rowIndex % 2 === 0) {
          pdf.setFillColor(250, 250, 250); // Cinza muito claro
          pdf.rect(margin, yPosition, tableWidth, rowHeight, 'F');
        }
        
        // Borda da linha
        pdf.setDrawColor(180, 180, 180); // Cinza médio
        pdf.rect(margin, yPosition, tableWidth, rowHeight, 'S');

        xPos = margin + 2;
        pdf.setFontSize(8);
        pdf.setTextColor(0, 0, 0); // Preto
        
        // Data
        const dateStr = ((item as any).operation_type === 'manual_credit' || (item as any).operation_type === 'manual_debit') 
          ? formatTimestamp(item.date, 'dd/MM/yy HH:mm')
          : formatOTCTimestamp(item.date, 'dd/MM/yy HH:mm');
        
        // Quebrar data em duas linhas se necessário
        const dateParts = dateStr.split(' ');
        pdf.text(dateParts[0], xPos, yPosition + 4);
        if (dateParts[1]) {
          pdf.text(dateParts[1], xPos, yPosition + 8);
        }
        xPos += colWidths[0];
        
        // Tipo
        const operationType = (item as any).operation_type;
        let typeText = '';
        
        switch (operationType) {
          case 'deposit':
            typeText = 'Depósito';
            break;
          case 'withdrawal':
            typeText = 'Saque';
            break;
          case 'manual_credit':
            typeText = 'Crédito Manual';
            break;
          case 'manual_debit':
            typeText = (item as any).conversion_rate ? 'Conversão BRL>USD' : 'Débito Manual';
            break;
          default:
            typeText = item.type === 'deposit' ? 'Depósito' : 'Saque';
        }
        
        pdf.setFont('helvetica', 'bold');
        const typeLines = pdf.splitTextToSize(typeText, colWidths[1] - 2);
        typeLines.forEach((line: string, lineIndex: number) => {
          pdf.text(line, xPos, yPosition + 4 + (lineIndex * 4));
        });
        pdf.setFont('helvetica', 'normal');
        xPos += colWidths[1];
        
        // Pagador/Descrição - LÓGICA CORRIGIDA
        let payerText = '';
        
        // Se é operação manual (manual_credit ou manual_debit), usar description
        if (operationType === 'manual_credit' || operationType === 'manual_debit') {
          payerText = (item as any).operation_description || 'N/A';
        } else {
          // Se é operação automática (deposit, withdrawal), usar apenas o nome do pagador
          payerText = item.payer_name || 'N/A';
        }
        
        // Quebrar texto longo em múltiplas linhas
        const payerLines = pdf.splitTextToSize(payerText, colWidths[2] - 2);
        payerLines.forEach((line: string, lineIndex: number) => {
          if (lineIndex < 2) { // Máximo 2 linhas
            pdf.text(line, xPos, yPosition + 4 + (lineIndex * 4));
          }
        });
        xPos += colWidths[2];
        
        // Valor
        let valueText = '';
        
        if ((item as any).operation_type === 'manual_debit' && (item as any).conversion_rate) {
          valueText = `${formatCurrency(Math.abs((item as any).amount_change || 0))} → $${Math.abs((item as any).usd_amount_change || 0).toFixed(2)}`;
        } else if (isUSDOnlyOperation(item)) {
          const prefix = (item as any).usd_amount_change > 0 ? '+' : '-';
          valueText = `${prefix}$${Math.abs((item as any).usd_amount_change).toFixed(2)}`;
        } else {
          const prefix = (operationType === 'deposit' || operationType === 'manual_credit') ? '+' : '-';
          valueText = `${prefix}${formatCurrency(item.amount)}`;
        }
        
        pdf.setFont('helvetica', 'bold');
        const valueLines = pdf.splitTextToSize(valueText, colWidths[3] - 2);
        valueLines.forEach((line: string, lineIndex: number) => {
          pdf.text(line, xPos, yPosition + 4 + (lineIndex * 4));
        });
        pdf.setFont('helvetica', 'normal');
        xPos += colWidths[3];
        
        // Saldo Anterior
        const balanceBefore = (item as any).usd_amount_change && Math.abs((item as any).usd_amount_change) > 0 && !(item as any).amount_change 
          ? `$${((item as any).usd_balance_before || 0).toFixed(2)}`
          : formatCurrency((item as any).saldo_anterior || 0);
        pdf.text(balanceBefore, xPos, yPosition + 6);
        xPos += colWidths[4];
        
        // Saldo Posterior
        const balanceAfter = (item as any).usd_amount_change && Math.abs((item as any).usd_amount_change) > 0 && !(item as any).amount_change 
          ? `$${((item as any).usd_balance_after || 0).toFixed(2)}`
          : formatCurrency((item as any).saldo_posterior || 0);
        pdf.text(balanceAfter, xPos, yPosition + 6);
        
        yPosition += rowHeight;
        rowIndex++;
      }

      // === RODAPÉ PROFISSIONAL ===
      const footerY = pageHeight - 15;
      
      pdf.setDrawColor(0, 0, 0); // Preto
      pdf.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
      
      pdf.setFontSize(8);
      pdf.setTextColor(60, 60, 60); // Cinza escuro
      
      pdf.text(`Última atualização: ${formatTimestamp(data.cliente.last_updated, 'dd/MM/yyyy HH:mm')}`, margin, footerY);
      pdf.text(`Página 1`, pageWidth - margin, footerY, { align: 'right' });
      
      // === SALVAR ARQUIVO ===
      let dateForFileName = '';
      if (searchDate) {
        dateForFileName = searchDate.replace(/\//g, '-');
      } else if (showOnlyToday) {
        dateForFileName = new Date().toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit'
        }).replace(/\//g, '-');
      } else {
        dateForFileName = 'periodo-completo';
      }
      
      const fileName = `extrato-otc-${data.cliente.name.replace(/\s+/g, '-').toLowerCase()}-${dateForFileName}.pdf`;
      pdf.save(fileName);
      
      toast.success('PDF exportado com sucesso!');
      
    } catch (error) {

      toast.error('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setExportingPDF(false);
    }
  };

  // Verificar se o usuário está logado
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <Card className="w-full max-w-md shadow-2xl bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-primary flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Sessão Expirada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">Sua sessão expirou. Faça login novamente para acessar seu extrato.</p>
            <button
              onClick={() => window.location.href = '/login'}
              className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 transition-colors"
            >
              Fazer Login
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-foreground">Carregando seu extrato...</p>
          <p className="text-muted-foreground text-sm mt-2">Usuário: {user.email}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-lg banking-shadow-lg">
          <CardHeader>
            <CardTitle className="text-red-500 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Erro ao Carregar Extrato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
              <p className="text-foreground text-sm">{error}</p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-muted-foreground text-sm mb-2">Informações do usuário:</p>
              <ul className="text-foreground text-sm space-y-1">
                <li>• Email: {user.email}</li>
                <li>• ID: {user.id}</li>
                <li>• Nome: {user.name}</li>
              </ul>
            </div>
            
            <div className="bg-gray-700/50 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-2">Possíveis soluções:</p>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Verifique se seu usuário está vinculado a um cliente OTC</li>
                <li>• Confirme se está logado com o usuário correto</li>
                <li>• Entre em contato com o suporte técnico</li>
              </ul>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleRefresh}
                className="flex-1 bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 transition-colors"
              >
                Tentar Novamente
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 bg-muted text-foreground py-2 px-4 rounded-md hover:bg-muted/80 transition-colors"
              >
                Fazer Logout
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md banking-shadow-lg">
          <CardHeader>
            <CardTitle className="text-foreground">Nenhum dado encontrado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Não foi possível carregar seu extrato.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-6 max-w-7xl">
        
        {/* Header com Usuário e Logout */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold text-foreground mb-1">Meu Extrato OTC</h1>
            <p className="text-muted-foreground text-sm">Suas transações e saldo pessoal</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-card rounded-lg px-4 py-2 border border-border">
              <div className="bg-primary rounded-full p-2">
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground px-3 py-2 rounded-lg transition-colors"
                title="Sair da conta"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </div>
        </div>

        {/* Card de Informações do Cliente - Mais Compacto */}
        <Card className="mb-6 banking-shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-t-lg py-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-4 w-4" />
              Suas Informações OTC
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
              <div className="text-center md:text-left">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Nome</p>
                <p className="text-sm font-semibold text-foreground">{data.cliente.name}</p>
              </div>
              <div className="text-center md:text-left">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Documento</p>
                <p className="text-sm font-semibold text-foreground">{data.cliente.document}</p>
              </div>
              <div className="text-center md:text-left">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Chave PIX</p>
                <p className="text-sm font-semibold text-foreground">{data.cliente.pix_key}</p>
              </div>
              <div className="text-center md:text-left">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Depositado Hoje</p>
                <p className="text-lg font-bold text-blue-500">
                  {formatCurrency(totalDepositado)}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {searchDate ? `Data: ${searchDate}` : ''}
                </p>
              </div>
              
              {/* Saldo BRL */}
              <div className="text-center md:text-left">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Saldo Total (BRL)</p>
                <p className="text-lg font-bold text-green-500">
                  {formatCurrency(data.cliente.current_balance)}
                </p>
              </div>
              
              {/* Saldo USD - NOVO */}
              <div className="text-center md:text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Saldo USD</p>
                <p className="text-lg font-bold text-blue-500">
                  $ {formatUSD(parseFloat((data.cliente as any).usd_balance || 0))}
                </p>
                {(data.cliente as any).last_conversion_rate && (
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Taxa Media Dia: {parseFloat((data.cliente as any).last_conversion_rate || 0).toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card de Filtros */}
        <Card className="mb-6 banking-shadow-lg">
          <CardHeader className="bg-gradient-to-r from-muted to-muted/80 text-foreground rounded-t-lg py-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-4 w-4" />
              Filtros de Busca
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
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
            
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
                        selected={selectedDate}
                        onSelect={handleDateSelect}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div>
                <Label htmlFor="sortBy">Ordenar por</Label>
                <Select value={sortBy} onValueChange={(value: "value" | "date" | "none") => setSortBy(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Padrão</SelectItem>
                    <SelectItem value="value">Valor</SelectItem>
                    <SelectItem value="date">Data</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="sortOrder">Ordem</Label>
                <Select value={sortOrder} onValueChange={(value: "asc" | "desc" | "none") => setSortOrder(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Padrão</SelectItem>
                    <SelectItem value="asc">Crescente</SelectItem>
                    <SelectItem value="desc">Decrescente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={clearAllFilters}
                disabled={loading}
              >
                Limpar Filtros
              </Button>
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button
                onClick={exportToPDF}
                disabled={exportingPDF || !data || filteredAndSortedTransactions.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                {exportingPDF ? 'Gerando PDF...' : 'Exportar PDF'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Histórico de Transações - Layout Otimizado */}
        <Card className="banking-shadow-lg">
          <CardHeader className="bg-gradient-to-r from-muted to-muted/80 text-foreground rounded-t-lg py-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-4 w-4" />
              Suas Transações 
              {filteredAndSortedTransactions.length !== data.transacoes?.length && (
                <span className="text-sm text-muted-foreground ml-2">
                  ({filteredAndSortedTransactions.length} de {data.transacoes?.length || 0} registros)
                </span>
              )}
              {filteredAndSortedTransactions.length === data.transacoes?.length && (
                <span className="text-sm text-muted-foreground ml-2">
                  ({data.transacoes?.length || 0} registros)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredAndSortedTransactions && filteredAndSortedTransactions.length > 0 ? (
              <div className="divide-y divide-border">
                {filteredAndSortedTransactions.map((item, index) => (
                  <div key={item.id} className="relative px-4 py-3 hover:bg-muted/30 transition-colors banking-transition">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* Ícone e Data */}
                      <div className="col-span-2 flex items-center gap-2">
                        <div className={`p-2 rounded-full ${
                          (item as any).operation_type === 'deposit' || (item as any).operation_type === 'manual_credit' ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'
                        }`}>
                          {(item as any).operation_type === 'deposit' || (item as any).operation_type === 'manual_credit' ? (
                            <ArrowUpRight className="h-3 w-3 text-green-500" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3 text-red-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {((item as any).operation_type === 'manual_credit' || (item as any).operation_type === 'manual_debit') 
                              ? formatTimestamp(item.date, 'dd/MM/yy')
                              : formatOTCTimestamp(item.date, 'dd/MM/yy')
                            }
                          </p>
                          <p className="text-xs text-muted-foreground/70">
                            {((item as any).operation_type === 'manual_credit' || (item as any).operation_type === 'manual_debit') 
                              ? formatTimestamp(item.date, 'HH:mm')
                              : formatOTCTimestamp(item.date, 'HH:mm')
                            }
                          </p>
                        </div>
                      </div>

                      {/* Dados do Depositante */}
                      <div className="col-span-4">
                        <p className="text-sm font-medium text-foreground">
                          {(() => {
                            const operationType = (item as any).operation_type;
                            const description = (item as any).operation_description;
                            
                            switch (operationType) {
                              case 'deposit':
                                return 'Depósito recebido';
                              case 'withdrawal':
                                return 'Saque realizado';
                              case 'manual_credit':
                                return description || 'Crédito manual';
                              case 'manual_debit':
                                return description || 'Débito manual';
                              default:
                                return item.type === 'deposit' ? 'Depósito recebido' : 'Saque realizado';
                            }
                          })()}
                        </p>
                        {item.payer_name && (
                          <p className="text-xs text-muted-foreground">De: {item.payer_name}</p>
                        )}
                        {item.payer_document && (
                          <p className="text-xs text-muted-foreground/70">Doc: {item.payer_document}</p>
                        )}
                        {item.bmp_identifier && (
                          <p className="text-xs text-muted-foreground/70">ID: {item.bmp_identifier}</p>
                        )}
                      </div>

                      {/* Valor da Transação */}
                      <div className="col-span-2 text-right">
                        {/* Detectar primeiro se é conversão (tem conversion_rate) */}
                        {(item as any).operation_type === 'manual_debit' && Math.abs(item.amount) < 0.01 && (item as any).conversion_rate ? (
                          // CONVERSÃO BRL → USD (tem conversion_rate)
                          <>
                            <div className="space-y-1">
                              <p className="text-lg font-bold text-red-500">
                                -R$ {Math.abs((item as any).amount_change || 0).toFixed(2)}
                              </p>
                              <p className="text-lg font-bold text-green-500">
                                +$ {Math.abs((item as any).usd_amount_change || 0).toFixed(2)}
                              </p>
                            </div>
                            <p className="text-xs text-white font-medium">Conversão BRL→USD</p>
                            <p className="text-xs text-muted-foreground">
                              Taxa: {parseFloat((item as any).conversion_rate || 0).toFixed(2)}
                            </p>
                          </>
                        ) : isUSDOnlyOperation(item) ? (
                          // OPERAÇÃO USD PURA
                          <>
                            <p className={`text-lg font-bold ${
                              (item as any).usd_amount_change > 0 ? 'text-green-500' : 'text-red-500'
                            }`}>
                              {(item as any).usd_amount_change > 0 ? '+' : '-'}$ {Math.abs((item as any).usd_amount_change).toFixed(2)}
                            </p>
                            <p className="text-xs text-white font-medium">USD</p>
                          </>
                        ) : (
                          // TRANSAÇÃO NORMAL BRL
                          <>
                            <p className={`text-lg font-bold ${
                              (item as any).operation_type === 'deposit' || (item as any).operation_type === 'manual_credit' ? 'text-green-500' : 'text-red-500'
                            }`}>
                              {(item as any).operation_type === 'deposit' || (item as any).operation_type === 'manual_credit' ? '+' : '-'}R$ {Math.abs(item.amount).toFixed(2)}
                            </p>
                            <p className="text-xs text-white font-medium">BRL</p>
                          </>
                        )}
                      </div>

                      {/* Saldo Anterior */}
                      <div className="col-span-2 text-center">
                        <p className="text-xs text-muted-foreground">
                          Saldo Anterior{(item as any).usd_amount_change && Math.abs((item as any).usd_amount_change) > 0 && !(item as any).amount_change ? ' USD' : ''}
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {(item as any).usd_amount_change && Math.abs((item as any).usd_amount_change) > 0 && !(item as any).amount_change 
                            ? `$ ${formatUSD((item as any).usd_balance_before || 0)}`
                            : formatCurrency((item as any).saldo_anterior || 0)
                          }
                        </p>
                      </div>

                      {/* Saldo Posterior */}
                      <div className="col-span-2 text-center">
                        <p className="text-xs text-muted-foreground">
                          Saldo Posterior{(item as any).usd_amount_change && Math.abs((item as any).usd_amount_change) > 0 && !(item as any).amount_change ? ' USD' : ''}
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {(item as any).usd_amount_change && Math.abs((item as any).usd_amount_change) > 0 && !(item as any).amount_change 
                            ? `$ ${formatUSD((item as any).usd_balance_after || 0)}`
                            : formatCurrency((item as any).saldo_posterior || 0)
                          }
                        </p>
                      </div>
                    </div>
                    
                    {/* Checkbox de Conferência - Fora do grid */}
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                      <Checkbox
                        checked={checkedItems[(item as any).history_id] || false}
                        onCheckedChange={(checked) => handleCheckToggle((item as any).history_id, !!checked)}
                        disabled={updatingCheck === (item as any).history_id}
                        className="h-4 w-4"
                      />
                      {updatingCheck === (item as any).history_id && (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchName || searchValue ? 'Nenhuma transação encontrada com os filtros aplicados' : 'Você ainda não possui transações'}
                </p>
                <p className="text-muted-foreground/70 text-sm mt-2">
                  {searchName || searchValue ? 'Tente ajustar os filtros de busca' : 'Suas transações aparecerão aqui quando disponíveis'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer Compacto */}
        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground/70">
            Última atualização: {formatTimestamp(data.cliente.last_updated, 'dd/MM/yyyy HH:mm')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ClientStatement;