import { useEffect, useMemo, useState } from 'react';
import { TcrSaldosService, UsuariosSaldosResponse, UsuarioSaldo, compararSaldos, SaldoBrbtc, SaldosComparacao } from '@/services/tcrSaldos';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Search, TrendingUp, TrendingDown, Minus, CheckCircle, AlertTriangle, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Cache para evitar múltiplas chamadas à API
let usersCacheData: UsuarioSaldo[] | null = null;
let usersCacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export default function GrupoTcrSaldos() {
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<UsuarioSaldo[]>([]); // Lista completa de usuários
  const [list, setList] = useState<UsuarioSaldo[]>([]); // Lista filtrada para exibição
  const [paginacao, setPaginacao] = useState({ pagina_atual: 1, por_pagina: 50, total_usuarios: 0, total_paginas: 0 });
  const [nomeFiltro, setNomeFiltro] = useState('');
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [comparacoes, setComparacoes] = useState<Record<string, SaldosComparacao>>({});
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [ordenacao, setOrdenacao] = useState<'nome' | 'brl_asc' | 'brl_desc' | 'usdt_asc' | 'usdt_desc'>('nome');

  // Função para carregar TODOS os usuários de uma vez (com cache)
  const loadAllUsers = async (forceRefresh = false) => {
    // Verificar se temos dados em cache e se não forçou refresh
    const now = Date.now();
    if (!forceRefresh && usersCacheData && (now - usersCacheTimestamp) < CACHE_DURATION) {
      console.log('📋 [GRUPO-TCR] Usando dados do cache');
      setAllUsers(usersCacheData);
      applyFilterAndSort(usersCacheData, nomeFiltro, ordenacao);
      return;
    }

    setIsLoadingAll(true);
    setLoading(true);
    try {
      console.log('🔍 [GRUPO-TCR] Carregando TODOS os usuários da API...');
      
      let allUsersList: UsuarioSaldo[] = [];
      let currentPage = 1;
      let hasMorePages = true;
      
      // Carregar todas as páginas
      while (hasMorePages) {
        console.log(`📄 [GRUPO-TCR] Carregando página ${currentPage}...`);
        
        const params = {
          pagina: currentPage,
          por_pagina: 100 // Páginas maiores para reduzir requests
        };
        
        const data: UsuariosSaldosResponse = await TcrSaldosService.listarUsuariosSaldos(params);
        const usuarios = (data.response.usuarios || []).filter(u => u.id_usuario !== 1);
        
        allUsersList = [...allUsersList, ...usuarios];
        
        // Verificar se há mais páginas
        if (data.response.paginacao) {
          hasMorePages = currentPage < data.response.paginacao.total_paginas;
          currentPage++;
        } else {
          hasMorePages = false;
        }
        
        // Evitar loop infinito
        if (currentPage > 50) { // Max 50 páginas como proteção
          console.warn('⚠️ [GRUPO-TCR] Limite de páginas atingido');
          break;
        }
      }
      
      console.log(`✅ [GRUPO-TCR] Carregados ${allUsersList.length} usuários no total`);
      
      // Atualizar cache
      usersCacheData = allUsersList;
      usersCacheTimestamp = now;
      
      setAllUsers(allUsersList);
      applyFilterAndSort(allUsersList, nomeFiltro, ordenacao);
      
    } catch (e: any) {
      console.error('❌ [GRUPO-TCR] Erro ao carregar todos usuários:', e);
      toast.error('Erro ao carregar usuários', { description: e?.message || 'Tente novamente' });
    } finally {
      setIsLoadingAll(false);
      setLoading(false);
    }
  };

  // Função para aplicar filtro e ordenação no frontend
  const applyFilterAndSort = (users: UsuarioSaldo[], filtro: string, sort: typeof ordenacao) => {
    let filteredUsers = users;
    
    // Aplicar filtro
    if (filtro && filtro.trim()) {
      const searchTerm = filtro.trim().toLowerCase();
      filteredUsers = users.filter(user => 
        user.nome.toLowerCase().includes(searchTerm) ||
        user.id_usuario.toString().includes(searchTerm) ||
        (user.id_brasil_bitcoin && user.id_brasil_bitcoin.toLowerCase().includes(searchTerm))
      );
    }
    
    // Aplicar ordenação
    filteredUsers.sort((a, b) => {
      switch (sort) {
        case 'nome':
          return a.nome.localeCompare(b.nome);
        case 'brl_desc':
          return (b.saldos?.BRL || 0) - (a.saldos?.BRL || 0);
        case 'brl_asc':
          return (a.saldos?.BRL || 0) - (b.saldos?.BRL || 0);
        case 'usdt_desc':
          return (b.saldos?.USDT || 0) - (a.saldos?.USDT || 0);
        case 'usdt_asc':
          return (a.saldos?.USDT || 0) - (b.saldos?.USDT || 0);
        default:
          return 0;
      }
    });
    
    setList(filteredUsers);
    setPaginacao({
      pagina_atual: 1,
      por_pagina: filteredUsers.length,
      total_usuarios: filteredUsers.length,
      total_paginas: 1
    });
  };

  useEffect(() => {
    loadAllUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aplicar filtro e ordenação em tempo real quando o usuário digitar ou mudar ordenação
  useEffect(() => {
    if (allUsers.length > 0) {
      applyFilterAndSort(allUsers, nomeFiltro, ordenacao);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nomeFiltro, ordenacao, allUsers]);

  const onConferir = async (u: UsuarioSaldo) => {
    try {
      setCheckingId(u.id_brasil_bitcoin);
      const ext = await TcrSaldosService.consultarSaldoBrbtc(u.id_brasil_bitcoin);
      const cmp = compararSaldos(u, ext.response.data as SaldoBrbtc);
      
      // Salvar a comparação no estado para exibir na tabela
      setComparacoes(prev => ({
        ...prev,
        [u.id_brasil_bitcoin]: cmp
      }));
      
      const brlMsg = cmp.brl.diferenca === 0 ? 'BRL OK' : `BRL diferença ${cmp.brl.diferenca}`;
      const usdtMsg = cmp.usdt.diferenca === 0 ? 'USDT OK' : `USDT diferença ${cmp.usdt.diferenca}`;
      
      if (cmp.brl.diferenca === 0 && cmp.usdt.diferenca === 0) {
        toast.success('Conferência OK!', { description: 'Todos os saldos estão corretos' });
      } else {
        toast.warning('Diferenças encontradas', { description: `${brlMsg} | ${usdtMsg}` });
      }
    } catch (e: any) {
      toast.error('Erro na conferência', { description: e?.message || 'Falha ao consultar saldo externo' });
    } finally {
      setCheckingId(null);
    }
  };

  const rows = useMemo(() => list, [list]);

  // Componente para exibir valores de moeda com cores
  const CurrencyValue = ({ amount, currency, className = "" }: { amount: number; currency: 'BRL' | 'USDT'; className?: string }) => {
    const isPositive = amount > 0;
    const colorClass = currency === 'BRL' 
      ? 'text-green-600 dark:text-green-400' 
      : 'text-blue-600 dark:text-blue-400';
    
    return (
      <span className={cn("font-mono text-sm", colorClass, className)}>
        {currency === 'BRL' ? `R$ ${amount.toFixed(2)}` : `${amount.toFixed(8)} USDT`}
      </span>
    );
  };

  // Componente para exibir diferenças
  const DifferenceIndicator = ({ diferenca, currency }: { diferenca: number; currency: 'BRL' | 'USDT' }) => {
    if (diferenca === 0) {
      return (
        <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
          <CheckCircle className="h-3 w-3" />
          <span className="text-xs font-medium">OK</span>
        </div>
      );
    }

    const isPositive = diferenca > 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const colorClass = isPositive 
      ? 'text-orange-600 dark:text-orange-400' 
      : 'text-red-600 dark:text-red-400';

    return (
      <div className={cn("flex items-center gap-1", colorClass)}>
        <Icon className="h-3 w-3" />
        <span className="text-xs font-medium">
          {isPositive ? '+' : ''}{currency === 'BRL' ? diferenca.toFixed(2) : diferenca.toFixed(8)}
        </span>
      </div>
    );
  };

  // Componente para status da conferência
  const ConferenceStatus = ({ contaBRBTC }: { contaBRBTC: string }) => {
    const comparacao = comparacoes[contaBRBTC];
    
    if (!comparacao) {
      return (
        <Badge variant="secondary" className="text-xs">
          Não conferido
        </Badge>
      );
    }

    const isOk = comparacao.brl.diferenca === 0 && comparacao.usdt.diferenca === 0;
    
    return (
      <Badge variant={isOk ? "default" : "destructive"} className="text-xs">
        {isOk ? (
          <><CheckCircle className="h-3 w-3 mr-1" /> Confere</>
        ) : (
          <><AlertTriangle className="h-3 w-3 mr-1" /> Diferenças</>
        )}
      </Badge>
    );
  };

  // Calcular estatísticas
  const stats = useMemo(() => {
    const total = rows.length;
    const conferidos = Object.keys(comparacoes).length;
    const comDiferenca = Object.values(comparacoes).filter(c => c.brl.diferenca !== 0 || c.usdt.diferenca !== 0).length;
    const totalBRL = rows.reduce((sum, u) => sum + (u.saldos?.BRL ?? 0), 0);
    const totalUSDT = rows.reduce((sum, u) => sum + (u.saldos?.USDT ?? 0), 0);
    
    return { total, conferidos, comDiferenca, totalBRL, totalUSDT };
  }, [rows, comparacoes]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Grupo TCR - Saldos de Usuários</h1>
          <p className="text-muted-foreground mt-1">Comparação de saldos entre TCR e Brasil Bitcoin</p>
        </div>
        <Button size="sm" onClick={() => loadAllUsers(true)} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Usuários</div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.conferidos}</div>
            <div className="text-xs text-muted-foreground">Conferidos</div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.comDiferenca}</div>
            <div className="text-xs text-muted-foreground">Com Diferenças</div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">R$ {stats.totalBRL.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Total BRL</div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">{stats.totalUSDT.toFixed(2)} USDT</div>
            <div className="text-xs text-muted-foreground">Total USDT</div>
          </div>
        </Card>
      </div>

      <Card className="p-3 md:p-4">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              value={nomeFiltro} 
              onChange={(e) => setNomeFiltro(e.target.value)} 
              placeholder="Buscar por nome, ID ou conta BRBTC..." 
              className="pl-8"
              disabled={isLoadingAll}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <Select value={ordenacao} onValueChange={(value: typeof ordenacao) => setOrdenacao(value)} disabled={isLoadingAll}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Ordenar por..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nome">Nome (A-Z)</SelectItem>
                <SelectItem value="brl_desc">BRL (Maior → Menor)</SelectItem>
                <SelectItem value="brl_asc">BRL (Menor → Maior)</SelectItem>
                <SelectItem value="usdt_desc">USDT (Maior → Menor)</SelectItem>
                <SelectItem value="usdt_asc">USDT (Menor → Maior)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {nomeFiltro && (
            <Button 
              variant="outline" 
              onClick={() => setNomeFiltro('')} 
              disabled={loading}
            >
              Limpar
            </Button>
          )}
        </div>
        
        {isLoadingAll && (
          <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">
            🔄 Carregando todos os usuários... Isso pode levar alguns segundos.
          </div>
        )}
        
        {!isLoadingAll && allUsers.length > 0 && (
          <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
            {nomeFiltro ? (
              <span>🔍 Filtrando <strong>{list.length}</strong> de <strong>{allUsers.length}</strong> usuários</span>
            ) : (
              <span>📋 Exibindo <strong>{list.length}</strong> usuários</span>
            )}
            
            <span className="text-xs">
              📋 Cache: {usersCacheData ? 'Ativo (5min)' : 'Vazio'}
            </span>
          </div>
        )}
      </Card>

      <Card className="p-0 overflow-auto">
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[180px] font-semibold">Usuário</TableHead>
              <TableHead className="w-[140px] font-semibold">Conta BRBTC</TableHead>
              <TableHead className="w-[120px] text-center font-semibold">Local (TCR)</TableHead>
              <TableHead className="w-[120px] text-center font-semibold">Brasil Bitcoin</TableHead>
              <TableHead className="w-[100px] text-center font-semibold">Diferenças</TableHead>
              <TableHead className="w-[100px] text-center font-semibold">Status</TableHead>
              <TableHead className="w-[120px] text-center font-semibold">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => {
              const comparacao = comparacoes[u.id_brasil_bitcoin];
              return (
                <TableRow key={`${u.id_usuario}-${u.id_brasil_bitcoin}`} className="hover:bg-muted/30">
                  <TableCell className="py-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-sm">{u.nome}</span>
                      <span className="text-xs text-muted-foreground">ID: {u.id_usuario}</span>
                    </div>
                  </TableCell>
                  
                  <TableCell className="py-3">
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                      {u.id_brasil_bitcoin || '—'}
                    </span>
                  </TableCell>
                  
                  {/* Saldos Locais */}
                  <TableCell className="py-3 text-center">
                    <div className="flex flex-col gap-1">
                      <CurrencyValue amount={u.saldos?.BRL ?? 0} currency="BRL" />
                      <CurrencyValue amount={u.saldos?.USDT ?? 0} currency="USDT" />
                    </div>
                  </TableCell>
                  
                  {/* Saldos Brasil Bitcoin */}
                  <TableCell className="py-3 text-center">
                    {comparacao ? (
                      <div className="flex flex-col gap-1">
                        <CurrencyValue amount={comparacao.brl.externo} currency="BRL" />
                        <CurrencyValue amount={comparacao.usdt.externo} currency="USDT" />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Não conferido</span>
                    )}
                  </TableCell>
                  
                  {/* Diferenças */}
                  <TableCell className="py-3 text-center">
                    {comparacao ? (
                      <div className="flex flex-col gap-1">
                        <DifferenceIndicator diferenca={comparacao.brl.diferenca} currency="BRL" />
                        <DifferenceIndicator diferenca={comparacao.usdt.diferenca} currency="USDT" />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  
                  {/* Status */}
                  <TableCell className="py-3 text-center">
                    <ConferenceStatus contaBRBTC={u.id_brasil_bitcoin} />
                  </TableCell>
                  
                  {/* Ações */}
                  <TableCell className="py-3 text-center">
                    <Button 
                      size="sm" 
                      variant={comparacao ? "outline" : "secondary"}
                      className="text-xs px-3 py-1"
                      onClick={() => onConferir(u)} 
                      disabled={!u.id_brasil_bitcoin || checkingId === u.id_brasil_bitcoin}
                    >
                      {checkingId === u.id_brasil_bitcoin ? (
                        <div className="flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> 
                          <span>Conferindo...</span>
                        </div>
                      ) : (
                        comparacao ? 'Reconferir' : 'Conferir'
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Rodapé com informações e paginação */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4 text-muted-foreground">
          {nomeFiltro ? (
            <>
              <span>🔍 Resultados da busca: "{nomeFiltro}"</span>
              <span>•</span>
              <span>Exibindo: {list.length} de {allUsers.length} usuários</span>
              <span>•</span>
              <span>Conferidos: {stats.conferidos}</span>
            </>
          ) : (
            <>
              <span>Total: {allUsers.length} usuários carregados</span>
              <span>•</span>
              <span>Exibindo: {list.length}</span>
              <span>•</span>
              <span>Conferidos: {stats.conferidos}</span>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Legenda de cores */}
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-xs text-muted-foreground">BRL</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-xs text-muted-foreground">USDT</span>
          </div>
        </div>
      </div>
    </div>
  );
}


