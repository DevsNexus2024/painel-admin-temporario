import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, X, ArrowDown, ArrowUp, RefreshCw, TrendingUp, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getUserCryptoWithdraws,
  getUserFiatWithdraws,
  getUserTrades,
  getUserInternalDeposits,
  getUserInternalWithdraws,
  CryptoWithdraw,
  FiatWithdraw,
  Trade,
  InternalDeposit,
  InternalWithdraw,
} from '@/services/brbtcAnalise';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface BrbtcExtratoModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  userName: string;
  userBrbtcId?: string; // id_brasil_bitcoin do usuário
  allUsers?: Array<{ id_brasil_bitcoin: string; nome: string; id_usuario: number }>;
}

type ExtratoItem = {
  id: string;
  timestamp: number;
  data: string;
  hora: string;
  tipo: 'Saque BRL' | 'Saque Crypto' | 'Conversão' | 'Depósito Interno' | 'Saque Interno';
  descricao: string;
  moeda: string;
  valor: number;
  status: string;
  detalhes: Record<string, any>;
  origem: 'fiat_withdraw' | 'crypto_withdraw' | 'trade' | 'internal_deposit' | 'internal_withdraw';
};

export default function BrbtcExtratoModal({
  isOpen,
  onClose,
  userId,
  userName,
  userBrbtcId,
  allUsers = [],
}: BrbtcExtratoModalProps) {
  const [loading, setLoading] = useState(false);
  const [allTransactions, setAllTransactions] = useState<ExtratoItem[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<ExtratoItem[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCurrency, setFilterCurrency] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Criar mapeamento de id_brasil_bitcoin -> nome usando os dados já carregados
  const userMap = useMemo(() => {
    const map: Record<string, { nome: string; id_usuario: number }> = {};
    allUsers.forEach((user) => {
      if (user.id_brasil_bitcoin) {
        map[user.id_brasil_bitcoin] = {
          nome: user.nome,
          id_usuario: user.id_usuario,
        };
      }
    });
    return map;
  }, [allUsers]);


  const fetchTransactions = async () => {
    setLoading(true);
    
    // Log de debug
    console.log('🔍 [EXTRATO] Buscando extrato para userId:', userId, 'userName:', userName);
    
    // Limpar transações anteriores antes de buscar novas
    setAllTransactions([]);
    setFilteredTransactions([]);
    
    try {
      console.log('🔍 [EXTRATO] Fazendo chamadas de API com userId:', userId, 'userBrbtcId:', userBrbtcId);
      
      const [
        fiatWithdrawsRes,
        cryptoWithdrawsRes,
        tradesRes,
        internalDepositsRes,
        internalWithdrawsRes,
      ] = await Promise.allSettled([
        getUserFiatWithdraws({ id_usuario: userId }),
        getUserCryptoWithdraws({ id_usuario: userId }),
        getUserTrades({ id_usuario: userId }),
        getUserInternalDeposits({ id_usuario: userId }),
        getUserInternalWithdraws({ id_usuario: userId }),
      ]);
      
      console.log('🔍 [EXTRATO] Respostas recebidas:', {
        fiatWithdraws: fiatWithdrawsRes.status === 'fulfilled' ? `OK (${fiatWithdrawsRes.value.dados?.saques?.length || 0} registros)` : 'ERRO',
        cryptoWithdraws: cryptoWithdrawsRes.status === 'fulfilled' ? `OK (${cryptoWithdrawsRes.value.dados?.saques?.length || 0} registros)` : 'ERRO',
        trades: tradesRes.status === 'fulfilled' ? `OK (${tradesRes.value.dados?.trades?.length || 0} registros)` : 'ERRO',
        internalDeposits: internalDepositsRes.status === 'fulfilled' ? `OK (${internalDepositsRes.value.dados?.depositos?.length || 0} registros)` : 'ERRO',
        internalWithdraws: internalWithdrawsRes.status === 'fulfilled' ? `OK (${internalWithdrawsRes.value.dados?.saques?.length || 0} registros)` : 'ERRO',
      });

      let combined: ExtratoItem[] = [];
      
      // Função auxiliar para validar se a resposta pertence ao usuário correto
      const validarRespostaUsuario = (response: any, tipo: string): boolean => {
        if (!response || !response.dados) {
          console.warn(`⚠️ [EXTRATO] ${tipo}: Resposta sem dados`);
          return false;
        }
        
        const usuarioId = response.dados.usuario?.id;
        if (usuarioId && usuarioId !== userId) {
          console.error(`❌ [EXTRATO] ${tipo}: Dados de usuário incorreto! Esperado: ${userId}, Recebido: ${usuarioId}`);
          toast.error(`Erro de validação: ${tipo}`, {
            description: `Dados retornados são do usuário ${usuarioId}, mas esperávamos ${userId}`,
          });
          return false;
        }
        
        if (usuarioId === userId) {
          console.log(`✅ [EXTRATO] ${tipo}: Validação OK - userId: ${usuarioId}`);
        }
        
        return true;
      };

      // Saques Fiat (BRL)
      if (fiatWithdrawsRes.status === 'fulfilled' && fiatWithdrawsRes.value.dados?.saques) {
        if (validarRespostaUsuario(fiatWithdrawsRes.value, 'Saques Fiat')) {
          combined.push(
            ...fiatWithdrawsRes.value.dados.saques.map((item: FiatWithdraw) => ({
              id: `fiat_${item.id}`,
              timestamp: item.timestamp,
              data: new Date(item.timestamp * 1000).toLocaleDateString('pt-BR'),
              hora: new Date(item.timestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              tipo: 'Saque BRL' as const,
              descricao: `Saque BRL${item.bank ? ` - ${item.bank}` : ''}${item.pixKey ? ` (PIX: ${item.pixKey})` : ''}`,
              moeda: item.coin,
              valor: parseFloat(item.value),
              status: item.status,
              detalhes: item,
              origem: 'fiat_withdraw' as const,
            }))
          );
        }
      } else if (fiatWithdrawsRes.status === 'rejected') {
        console.error('❌ [EXTRATO] Erro ao buscar Saques Fiat:', fiatWithdrawsRes.reason);
      }

      // Saques Crypto
      if (cryptoWithdrawsRes.status === 'fulfilled' && cryptoWithdrawsRes.value.dados?.saques) {
        if (validarRespostaUsuario(cryptoWithdrawsRes.value, 'Saques Crypto')) {
          combined.push(
            ...cryptoWithdrawsRes.value.dados.saques.map((item: CryptoWithdraw) => ({
              id: `crypto_${item.id}`,
              timestamp: item.timestamp,
              data: new Date(item.timestamp * 1000).toLocaleDateString('pt-BR'),
              hora: new Date(item.timestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              tipo: 'Saque Crypto' as const,
              descricao: `Saque ${item.coin}${item.address ? ` para ${item.address.substring(0, 8)}...${item.address.substring(item.address.length - 6)}` : ''}`,
              moeda: item.coin,
              valor: parseFloat(item.amount),
              status: item.status,
              detalhes: item,
              origem: 'crypto_withdraw' as const,
            }))
          );
        }
      } else if (cryptoWithdrawsRes.status === 'rejected') {
        console.error('❌ [EXTRATO] Erro ao buscar Saques Crypto:', cryptoWithdrawsRes.reason);
      }

      // Conversões/Trades - TODAS as conversões são processadas (sem filtro)
      if (tradesRes.status === 'fulfilled' && tradesRes.value.dados?.trades) {
        if (validarRespostaUsuario(tradesRes.value, 'Trades')) {
          combined.push(
            ...tradesRes.value.dados.trades.map((item: Trade) => {
              const pairParts = item.pair.split('/');
              const baseCoin = pairParts[0];
              const quoteCoin = pairParts[1] || 'BRL';
              const isBuy = item.side === 'buy';
              
              // Melhorar descrição para incluir o par completo
              const descricao = isBuy
                ? `Compra ${item.amount} ${baseCoin} por ${parseFloat(item.total).toFixed(2)} ${quoteCoin} (${item.pair})`
                : `Venda ${item.amount} ${baseCoin} por ${parseFloat(item.total).toFixed(2)} ${quoteCoin} (${item.pair})`;
              
              return {
                id: `trade_${item.transactionId}`,
                timestamp: item.timestamp,
                data: new Date(item.timestamp * 1000).toLocaleDateString('pt-BR'),
                hora: new Date(item.timestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                tipo: 'Conversão' as const,
                descricao,
                moeda: quoteCoin,
                valor: parseFloat(item.total),
                status: item.status,
                detalhes: item,
                origem: 'trade' as const,
              };
            })
          );
        }
      } else if (tradesRes.status === 'rejected') {
        console.error('❌ [EXTRATO] Erro ao buscar Trades:', tradesRes.reason);
      }


      // Depósitos Internos (Transferências recebidas) - usando userMap dos dados já carregados
      if (internalDepositsRes.status === 'fulfilled' && internalDepositsRes.value.dados?.depositos) {
        if (validarRespostaUsuario(internalDepositsRes.value, 'Depósitos Internos')) {
          combined.push(
            ...internalDepositsRes.value.dados.depositos.map((item: InternalDeposit) => {
              const userInfo = userMap[item.fromUserDocument];
              const descricao = userInfo
                ? `Transferência recebida de ${userInfo.nome}`
                : `Transferência recebida de ${item.fromUserDocument}`;
              
              return {
                id: `internal_deposit_${item.id}`,
                timestamp: item.timestamp,
                data: new Date(item.timestamp * 1000).toLocaleDateString('pt-BR'),
                hora: new Date(item.timestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                tipo: 'Depósito Interno' as const,
                descricao,
                moeda: item.coin,
                valor: parseFloat(item.amount),
                status: 'Concluído',
                detalhes: item,
                origem: 'internal_deposit' as const,
              };
            })
          );
        }
      } else if (internalDepositsRes.status === 'rejected') {
        console.error('❌ [EXTRATO] Erro ao buscar Depósitos Internos:', internalDepositsRes.reason);
      }

      // Saques Internos (Transferências enviadas) - usando userMap dos dados já carregados
      if (internalWithdrawsRes.status === 'fulfilled' && internalWithdrawsRes.value.dados?.saques) {
        if (validarRespostaUsuario(internalWithdrawsRes.value, 'Saques Internos')) {
          combined.push(
            ...internalWithdrawsRes.value.dados.saques.map((item: InternalWithdraw) => {
              const userInfo = userMap[item.toUserDocument];
              const descricao = userInfo
                ? `Transferência enviada para ${userInfo.nome}`
                : `Transferência enviada para ${item.toUserDocument}`;
              
              return {
                id: `internal_withdraw_${item.id}`,
                timestamp: item.timestamp,
                data: new Date(item.timestamp * 1000).toLocaleDateString('pt-BR'),
                hora: new Date(item.timestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                tipo: 'Saque Interno' as const,
                descricao,
                moeda: item.coin,
                valor: parseFloat(item.amount),
                status: 'Concluído',
                detalhes: item,
                origem: 'internal_withdraw' as const,
              };
            })
          );
        }
      } else if (internalWithdrawsRes.status === 'rejected') {
        console.error('❌ [EXTRATO] Erro ao buscar Saques Internos:', internalWithdrawsRes.reason);
      }

      // Filtro de segurança final: garantir que todas as transações pertencem ao usuário correto
      // Verificar userDocument nas transações que têm esse campo
      const transacoesValidadas = combined.filter((transaction) => {
        // Para transferências internas, verificar se o userDocument corresponde ao usuário esperado
        if (transaction.origem === 'internal_deposit') {
          const item = transaction.detalhes as InternalDeposit;
          // O toUserDocument deve ser igual ao userBrbtcId (é quem recebeu)
          if (userBrbtcId && item.toUserDocument && item.toUserDocument !== userBrbtcId) {
            console.warn(`⚠️ [EXTRATO] Transferência interna recebida filtrada - toUserDocument (${item.toUserDocument}) não corresponde ao usuário (${userBrbtcId})`);
            return false;
          }
        }
        if (transaction.origem === 'internal_withdraw') {
          const item = transaction.detalhes as InternalWithdraw;
          // O fromUserDocument deve ser igual ao userBrbtcId (é quem enviou)
          if (userBrbtcId && item.fromUserDocument && item.fromUserDocument !== userBrbtcId) {
            console.warn(`⚠️ [EXTRATO] Transferência interna enviada filtrada - fromUserDocument (${item.fromUserDocument}) não corresponde ao usuário (${userBrbtcId})`);
            return false;
          }
        }
        // Para saques e trades, verificar userDocument se disponível
        if (transaction.origem === 'fiat_withdraw' || transaction.origem === 'crypto_withdraw') {
          const item = transaction.detalhes as FiatWithdraw | CryptoWithdraw;
          if (userBrbtcId && item.userDocument && item.userDocument !== userBrbtcId) {
            console.warn(`⚠️ [EXTRATO] ${transaction.tipo} filtrado - userDocument (${item.userDocument}) não corresponde ao usuário (${userBrbtcId})`);
            return false;
          }
        }
        // Para outros tipos, confiamos na validação da API (já feita acima)
        return true;
      });
      
      // Ordenar por timestamp (mais recente primeiro)
      transacoesValidadas.sort((a, b) => b.timestamp - a.timestamp);
      
      console.log(`✅ [EXTRATO] Total de transações processadas para userId ${userId}:`, transacoesValidadas.length, `(de ${combined.length} antes do filtro final)`);
      
      setAllTransactions(transacoesValidadas);
      setFilteredTransactions(transacoesValidadas);
    } catch (error: any) {
      console.error('❌ [EXTRATO] Erro ao carregar extrato:', error);
      toast.error('Erro ao carregar extrato', { 
        description: error.message || 'Tente novamente' 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      console.log('🔄 [EXTRATO] Modal aberto - userId:', userId, 'userName:', userName);
      // Limpar estado antes de buscar novos dados
      setAllTransactions([]);
      setFilteredTransactions([]);
      setFilterType('all');
      setFilterCurrency('all');
      setSearchTerm('');
      setCopiedAddress(null);
      fetchTransactions();
    } else {
      // Reset state when modal closes
      console.log('🔄 [EXTRATO] Modal fechado - limpando estado');
      setAllTransactions([]);
      setFilteredTransactions([]);
      setFilterType('all');
      setFilterCurrency('all');
      setSearchTerm('');
      setCopiedAddress(null);
    }
  }, [isOpen, userId]);

  useEffect(() => {
    let currentFiltered = allTransactions;

    // Filtro por tipo
    if (filterType !== 'all') {
      currentFiltered = currentFiltered.filter((t) => t.tipo === filterType);
    }

    // Filtro por moeda
    if (filterCurrency !== 'all') {
      currentFiltered = currentFiltered.filter((t) => t.moeda === filterCurrency);
    }

    // Busca por texto
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      currentFiltered = currentFiltered.filter(
        (t) =>
          t.descricao.toLowerCase().includes(lowerCaseSearchTerm) ||
          t.moeda.toLowerCase().includes(lowerCaseSearchTerm) ||
          t.status.toLowerCase().includes(lowerCaseSearchTerm) ||
          t.valor.toFixed(2).includes(lowerCaseSearchTerm) ||
          t.data.includes(lowerCaseSearchTerm)
      );
    }

    setFilteredTransactions(currentFiltered);
  }, [allTransactions, filterType, filterCurrency, searchTerm]);

  const availableCurrencies = useMemo(() => {
    const currencies = new Set(allTransactions.map((t) => t.moeda));
    return ['all', ...Array.from(currencies).sort()];
  }, [allTransactions]);

  const getTipoIcon = (tipo: ExtratoItem['tipo']) => {
    switch (tipo) {
      case 'Saque BRL':
      case 'Saque Crypto':
      case 'Saque Interno':
        return <ArrowUp className="w-4 h-4 text-red-400" />;
      case 'Depósito Interno':
        return <ArrowDown className="w-4 h-4 text-green-400" />;
      case 'Conversão':
        return <TrendingUp className="w-4 h-4 text-blue-400" />;
      default:
        return null;
    }
  };

  const getTipoColor = (tipo: ExtratoItem['tipo']) => {
    switch (tipo) {
      case 'Saque BRL':
      case 'Saque Crypto':
      case 'Saque Interno':
        return 'text-red-400';
      case 'Depósito Interno':
        return 'text-green-400';
      case 'Conversão':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  const copiarEndereco = async (endereco: string) => {
    try {
      await navigator.clipboard.writeText(endereco);
      setCopiedAddress(endereco);
      toast.success('Endereço copiado!', {
        description: 'Wallet copiada para a área de transferência',
        duration: 2000,
      });
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (error) {
      toast.error('Erro ao copiar endereço', {
        description: 'Tente novamente',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col bg-[#0A0A0A] text-white border-white/10 shadow-2xl shadow-black/50 rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between px-6 py-4 border-b border-white/10">
          <DialogTitle className="text-2xl font-bold text-white">
            Extrato Brasil Bitcoin - {userName}
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-white/10 rounded-lg"
          >
            <X className="h-5 w-5" />
          </Button>
        </DialogHeader>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-4 px-6 py-4 border-b border-white/10 bg-[#1A1A1A]/50">
          <Input
            placeholder="Buscar por descrição, moeda, status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-[#1A1A1A] border-white/10 text-white placeholder:text-gray-500 focus:border-[#FF7A3D] focus:ring-[#FF7A3D]/20"
          />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full md:w-[220px] bg-[#1A1A1A] border-white/10 text-white focus:border-[#FF7A3D]">
              <SelectValue placeholder="Filtrar por Tipo" />
            </SelectTrigger>
            <SelectContent className="bg-[#1A1A1A] border-white/10 text-white">
              <SelectItem value="all">Todos os Tipos</SelectItem>
              <SelectItem value="Saque BRL">Saques BRL</SelectItem>
              <SelectItem value="Saque Crypto">Saques Crypto</SelectItem>
              <SelectItem value="Conversão">Conversões</SelectItem>
              <SelectItem value="Depósito Interno">Depósitos Internos</SelectItem>
              <SelectItem value="Saque Interno">Saques Internos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCurrency} onValueChange={setFilterCurrency}>
            <SelectTrigger className="w-full md:w-[150px] bg-[#1A1A1A] border-white/10 text-white focus:border-[#FF7A3D]">
              <SelectValue placeholder="Filtrar Moeda" />
            </SelectTrigger>
            <SelectContent className="bg-[#1A1A1A] border-white/10 text-white">
              {availableCurrencies.map((currency) => (
                <SelectItem key={currency} value={currency}>
                  {currency === 'all' ? 'Todas as Moedas' : currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTransactions}
            disabled={loading}
            className="bg-[#1A1A1A] border-white/10 text-white hover:bg-white/10"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        {/* Contador de resultados */}
        <div className="px-6 py-2 bg-[#1A1A1A]/30 border-b border-white/10">
          <p className="text-xs text-gray-400">
            Mostrando <span className="font-semibold text-white">{filteredTransactions.length}</span> de{' '}
            <span className="font-semibold text-white">{allTransactions.length}</span> transações
          </p>
        </div>

        {/* Lista de transações */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-[#FF7A3D]" />
                <p className="text-gray-400">Carregando extrato...</p>
              </div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <X className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg font-semibold mb-2">Nenhuma transação encontrada</p>
              <p className="text-sm">
                {allTransactions.length === 0
                  ? 'Não há transações para este usuário.'
                  : 'Nenhuma transação corresponde aos filtros aplicados.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="bg-[#1A1A1A] border border-white/10 rounded-lg p-4 hover:border-[#FF7A3D]/30 transition-all"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1 flex items-start gap-3">
                      <div className="mt-0.5">{getTipoIcon(transaction.tipo)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={cn("text-sm font-semibold", getTipoColor(transaction.tipo))}>
                            {transaction.tipo}
                          </p>
                          <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-gray-400">
                            {transaction.moeda}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm text-gray-300 flex-1">{transaction.descricao}</p>
                          {/* Botão de copiar endereço para saques crypto */}
                          {transaction.origem === 'crypto_withdraw' && transaction.detalhes?.address && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copiarEndereco(transaction.detalhes.address)}
                              className="h-7 px-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                              title="Copiar endereço completo da wallet"
                            >
                              {copiedAddress === transaction.detalhes.address ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>{transaction.data}</span>
                          <span>•</span>
                          <span>{transaction.hora}</span>
                          <span>•</span>
                          <span className={cn(
                            "capitalize",
                            transaction.status.toLowerCase() === 'concluído' || transaction.status.toLowerCase() === 'completed'
                              ? "text-green-400"
                              : transaction.status.toLowerCase() === 'pendente' || transaction.status.toLowerCase() === 'pending'
                              ? "text-yellow-400"
                              : "text-gray-400"
                          )}>
                            {transaction.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right sm:text-left sm:min-w-[140px]">
                      <p
                        className={cn(
                          'text-lg font-bold money-font',
                          transaction.tipo.includes('Saque') || transaction.tipo.includes('Venda')
                            ? 'text-red-400'
                            : 'text-green-400'
                        )}
                      >
                        {transaction.tipo.includes('Saque') || transaction.tipo.includes('Venda') ? '-' : '+'}
                        {transaction.moeda === 'BRL' ? 'R$' : ''}{' '}
                        {transaction.valor.toLocaleString('pt-BR', {
                          minimumFractionDigits: transaction.moeda === 'BRL' ? 2 : 8,
                          maximumFractionDigits: transaction.moeda === 'BRL' ? 2 : 8,
                        })}{' '}
                        {transaction.moeda !== 'BRL' ? transaction.moeda : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

