import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { otcService } from '@/services/otc';
import { OTCBalanceHistory, OTCTransaction } from '@/types/otc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, User, FileText, ArrowUpRight, ArrowDownRight, AlertCircle, LogOut, Settings, Shield } from 'lucide-react';
import { formatCurrency, formatTimestamp } from '@/utils/date';

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

  useEffect(() => {
    if (user?.id) {
      fetchClientStatement();
    }
  }, [user?.id]);

  const fetchClientStatement = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!user?.id) {
        throw new Error('Usuário não identificado. Faça login novamente.');
      }

      console.log('Buscando cliente OTC para usuário:', user.id, user.email);
      
      // Buscar cliente OTC vinculado ao usuário logado
      const clientsResponse = await otcService.getClients({ 
        limit: 200 // Buscar todos os clientes para encontrar o correto
      });
      
      if (!clientsResponse.data?.clientes || clientsResponse.data.clientes.length === 0) {
        throw new Error('Nenhum cliente OTC encontrado no sistema.');
      }

      // Buscar cliente específico vinculado ao usuário logado
      const client = clientsResponse.data.clientes.find(c => {
        // Verificar se o cliente está vinculado ao usuário logado
        return String(c.user?.id) === String(user.id) || 
               c.user?.email === user.email ||
               c.user?.name === user.name;
      });

      if (!client) {
        console.log('Clientes encontrados:', clientsResponse.data.clientes.map(c => ({
          id: c.id,
          name: c.name,
          user: c.user
        })));
        
        throw new Error(`Você não possui acesso a nenhum cliente OTC. Usuário: ${user.email} (ID: ${user.id})`);
      }

      console.log('Cliente OTC encontrado:', client);

      // Verificar se o usuário tem permissão para acessar este cliente
      if (String(client.user?.id) !== String(user.id)) {
        throw new Error('Acesso negado. Você não tem permissão para visualizar este extrato.');
      }

      // Buscar extrato específico do cliente
      const statementResponse = await otcService.getClientStatement(client.id, {
        limit: 200
      });
      
      if (!statementResponse.success || !statementResponse.data) {
        throw new Error(statementResponse.message || 'Erro ao buscar extrato do cliente');
      }

      // Validação adicional de segurança
      if (statementResponse.data.cliente.id !== client.id) {
        throw new Error('Erro de segurança: dados inconsistentes');
      }

      // Calcular saldos das transações para exibição
      let saldoAcumulado = statementResponse.data.cliente.current_balance;
      const transacoesComSaldo = statementResponse.data.transacoes.map((transacao, index) => {
        const saldoAnterior = saldoAcumulado;
        const valorTransacao = transacao.type === 'deposit' ? transacao.amount : -transacao.amount;
        saldoAcumulado = saldoAnterior - valorTransacao; // Calcular o saldo antes desta transação
        
        return {
          ...transacao,
          saldo_anterior: saldoAcumulado,
          saldo_posterior: saldoAnterior
        };
      });

      setData({
        ...statementResponse.data,
        transacoes: transacoesComSaldo
      });
      
    } catch (err) {
      console.error('Erro ao buscar extrato:', err);
      setError(err instanceof Error ? err.message : 'Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/login-cliente';
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      // Forçar logout mesmo se der erro
      window.location.href = '/login-cliente';
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
                onClick={() => window.location.href = '/login-cliente'}
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
                onClick={fetchClientStatement}
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
              <div className="bg-green-500 rounded-full p-1">
                <Shield className="h-3 w-3 text-white" />
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
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
              <div className="text-center md:text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Seu Saldo</p>
                <p className="text-xl font-bold text-green-500">
                  {formatCurrency(data.cliente.current_balance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Histórico de Transações - Layout Otimizado */}
        <Card className="banking-shadow-lg">
          <CardHeader className="bg-gradient-to-r from-muted to-muted/80 text-foreground rounded-t-lg py-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-4 w-4" />
              Suas Transações ({data.transacoes?.length || 0} registros)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.transacoes && data.transacoes.length > 0 ? (
              <div className="divide-y divide-border">
                {data.transacoes.map((item, index) => (
                  <div key={item.id} className="px-4 py-3 hover:bg-muted/30 transition-colors banking-transition">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* Ícone e Data */}
                      <div className="col-span-2 flex items-center gap-2">
                        <div className={`p-2 rounded-full ${
                          item.type === 'deposit' ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'
                        }`}>
                          {item.type === 'deposit' ? (
                            <ArrowUpRight className="h-3 w-3 text-green-500" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3 text-red-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {formatTimestamp(item.date, 'dd/MM/yy')}
                          </p>
                          <p className="text-xs text-muted-foreground/70">
                            {formatTimestamp(item.date, 'HH:mm')}
                          </p>
                        </div>
                      </div>

                      {/* Dados do Depositante */}
                      <div className="col-span-4">
                        <p className="text-sm font-medium text-foreground">
                          {item.type === 'deposit' ? 'Depósito recebido' : 'Saque realizado'}
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
                        <p className={`text-lg font-bold ${
                          item.type === 'deposit' ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {item.type === 'deposit' ? '+' : '-'}{formatCurrency(item.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.status}</p>
                      </div>

                      {/* Saldo Anterior */}
                      <div className="col-span-2 text-center">
                        <p className="text-xs text-muted-foreground">Saldo Anterior</p>
                        <p className="text-sm font-medium text-foreground">
                          {formatCurrency((item as any).saldo_anterior || 0)}
                        </p>
                      </div>

                      {/* Saldo Posterior */}
                      <div className="col-span-2 text-center">
                        <p className="text-xs text-muted-foreground">Saldo Posterior</p>
                        <p className="text-sm font-medium text-foreground">
                          {formatCurrency((item as any).saldo_posterior || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">Você ainda não possui transações</p>
                <p className="text-muted-foreground/70 text-sm mt-2">Suas transações aparecerão aqui quando disponíveis</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer Compacto */}
        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground/70">
            Última atualização: {formatTimestamp(data.cliente.last_updated, 'dd/MM/yyyy HH:mm')}
          </p>
          <p className="text-xs text-muted-foreground/50 mt-1">
            Extrato pessoal de {user.name} • ID: {user.id}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ClientStatement; 