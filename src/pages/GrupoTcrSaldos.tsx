import { useEffect, useMemo, useState } from 'react';
import { TcrSaldosService, UsuarioSaldo, compararSaldos, SaldoBrbtc, SaldosComparacao } from '@/services/tcrSaldos';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Loader2, 
  RefreshCw, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowUpDown, 
  User, 
  Wallet, 
  DollarSign, 
  X, 
  ShieldCheck,
  Activity,
  Users,
  Zap,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import BrbtcExtratoModal from '@/components/BrbtcExtratoModal';

// Cache para evitar múltiplas chamadas à API
let usersCacheData: UsuarioSaldo[] | null = null;
let usersCacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export default function GrupoTcrSaldos() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<UsuarioSaldo[]>([]);
  const [list, setList] = useState<UsuarioSaldo[]>([]);
  const [paginacao, setPaginacao] = useState({ pagina_atual: 1, por_pagina: 50, total_usuarios: 0, total_paginas: 0 });
  const [nomeFiltro, setNomeFiltro] = useState('');
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [comparacoes, setComparacoes] = useState<Record<string, SaldosComparacao>>({});
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [ordenacao, setOrdenacao] = useState<'nome' | 'brl_asc' | 'brl_desc' | 'usdt_asc' | 'usdt_desc'>('nome');
  const [loadProgress, setLoadProgress] = useState({ loaded: 0, total: 0 });
  const [extratoModalOpen, setExtratoModalOpen] = useState(false);
  const [selectedUserForExtrato, setSelectedUserForExtrato] = useState<UsuarioSaldo | null>(null);

  // Verificação case-insensitive do email
  const canViewExtrato = useMemo(() => {
    if (!user?.email) return false;
    const emailLower = user.email.toLowerCase();
    return emailLower === 'adm@tcr.finance' || emailLower === 'alexandre@tcr.finance';
  }, [user?.email]);

  const loadAllUsers = async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && usersCacheData && (now - usersCacheTimestamp) < CACHE_DURATION) {
      setAllUsers(usersCacheData);
      applyFilterAndSort(usersCacheData, nomeFiltro, ordenacao);
      return;
    }

    setIsLoadingAll(true);
    setLoading(true);
    setLoadProgress({ loaded: 0, total: 0 });
    
    try {
      const firstPageData = await TcrSaldosService.listarUsuariosSaldos({ pagina: 1, por_pagina: 100 });
      const totalPaginas = firstPageData.response.paginacao?.total_paginas || 1;
      const firstPageUsers = (firstPageData.response.usuarios || []).filter(u => u.id_usuario !== 1);
      
      setAllUsers(firstPageUsers);
      applyFilterAndSort(firstPageUsers, nomeFiltro, ordenacao);
      setLoadProgress({ loaded: 1, total: totalPaginas });
      
      if (totalPaginas <= 1) {
        usersCacheData = firstPageUsers;
        usersCacheTimestamp = now;
        return;
      }
      
      const remainingPages = Array.from({ length: totalPaginas - 1 }, (_, i) => i + 2);
      let loadedCount = 1;
      const pagePromises = remainingPages.map(async (pageNum) => {
        const data = await TcrSaldosService.listarUsuariosSaldos({ pagina: pageNum, por_pagina: 100 });
        loadedCount++;
        setLoadProgress({ loaded: loadedCount, total: totalPaginas });
        return (data.response.usuarios || []).filter((u: UsuarioSaldo) => u.id_usuario !== 1);
      });
      
      const pagesResults = await Promise.all(pagePromises);
      const allUsersList = [...firstPageUsers, ...pagesResults.flat()];
      
      usersCacheData = allUsersList;
      usersCacheTimestamp = now;
      setAllUsers(allUsersList);
      applyFilterAndSort(allUsersList, nomeFiltro, ordenacao);
      
    } catch (e: any) {
      console.error('❌ [GRUPO-TCR] Erro ao carregar usuários:', e);
      toast.error('Erro ao carregar usuários', { description: e?.message || 'Tente novamente' });
    } finally {
      setIsLoadingAll(false);
      setLoading(false);
      setLoadProgress({ loaded: 0, total: 0 });
    }
  };

  const applyFilterAndSort = (users: UsuarioSaldo[], filtro: string, sort: typeof ordenacao) => {
    let filteredUsers = users;
    
    if (filtro && filtro.trim()) {
      const searchTerm = filtro.trim().toLowerCase();
      filteredUsers = users.filter(user => 
        user.nome.toLowerCase().includes(searchTerm) ||
        user.id_usuario.toString().includes(searchTerm) ||
        (user.id_brasil_bitcoin && user.id_brasil_bitcoin.toLowerCase().includes(searchTerm))
      );
    }
    
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

  const stats = useMemo(() => {
    const total = list.length;
    const totalCarregados = allUsers.length;
    const conferidos = Object.keys(comparacoes).length;
    const comDiferenca = Object.values(comparacoes).filter(c => c.brl.diferenca !== 0 || c.usdt.diferenca !== 0).length;
    const totalBRL = list.reduce((sum, u) => sum + (u.saldos?.BRL ?? 0), 0);
    const totalUSDT = list.reduce((sum, u) => sum + (u.saldos?.USDT ?? 0), 0);
    
    return { total, totalCarregados, conferidos, comDiferenca, totalBRL, totalUSDT };
  }, [list, allUsers, comparacoes]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0A0A] via-[#0F0F0F] to-[#0A0A0A] text-white">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" 
           style={{
             backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
             backgroundSize: '40px 40px'
           }}
      />
      
      <div className="relative z-10 max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-8">
        
        {/* Header */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#FF7A3D] blur-xl opacity-30 rounded-full"></div>
                  <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF7A3D] to-[#FF8A4D] flex items-center justify-center shadow-lg shadow-[#FF7A3D]/20">
                    <ShieldCheck className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                    Saldos e Conferências
                  </h1>
                  <p className="text-gray-400 mt-2 text-sm sm:text-base font-medium">
                    Monitoramento em tempo real de custódia e paridade de saldos
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF7A3D] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF7A3D]"></span>
                </div>
                <span className="text-xs font-medium text-gray-400">
                  {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <Button 
                onClick={() => loadAllUsers(true)} 
                disabled={loading}
                className="h-11 px-5 bg-gradient-to-r from-[#FF7A3D] to-[#FF8A4D] hover:from-[#FF8A4D] hover:to-[#FF7A3D] text-white border-0 shadow-lg shadow-[#FF7A3D]/25 transition-all duration-300 hover:scale-105"
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Atualizar
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-sm hover:border-[#FF7A3D]/30 transition-all duration-300 group">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF7A3D]/20 to-[#FF7A3D]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <DollarSign className="w-5 h-5 text-[#FF7A3D]" />
                  </div>
                </div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Custódia BRL</p>
                <p className="text-2xl font-bold text-white money-font">
                  R$ {stats.totalBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </Card>

            <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-sm hover:border-[#FF7A3D]/30 transition-all duration-300 group">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Activity className="w-5 h-5 text-blue-400" />
                  </div>
                </div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Custódia USDT</p>
                <p className="text-2xl font-bold text-white money-font">
                  {stats.totalUSDT.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  <span className="text-sm font-medium text-gray-400 ml-1">USDT</span>
                </p>
              </div>
            </Card>

            <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-sm hover:border-[#FF7A3D]/30 transition-all duration-300 group">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="w-5 h-5 text-green-400" />
                  </div>
                </div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Usuários</p>
                <p className="text-2xl font-bold text-white">
                  {stats.total.toLocaleString('pt-BR')}
                  <span className="text-sm font-medium text-gray-400 ml-1">ativos</span>
                </p>
              </div>
            </Card>

            <Card className={cn(
              "bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-sm hover:border-[#FF7A3D]/30 transition-all duration-300 group",
              stats.comDiferenca > 0 && "border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-orange-500/5"
            )}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform",
                    stats.comDiferenca > 0 
                      ? "bg-gradient-to-br from-orange-500/30 to-orange-500/20" 
                      : "bg-gradient-to-br from-green-500/20 to-green-500/10"
                  )}>
                    {stats.comDiferenca > 0 ? (
                      <AlertTriangle className="w-5 h-5 text-orange-400" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    )}
                  </div>
                </div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Status</p>
                <p className={cn(
                  "text-2xl font-bold",
                  stats.comDiferenca > 0 ? "text-orange-400" : "text-green-400"
                )}>
                  {stats.comDiferenca > 0 ? `${stats.comDiferenca} divergências` : 'Tudo OK'}
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <Card className="bg-white/5 border-white/10 backdrop-blur-xl p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                value={nomeFiltro} 
                onChange={(e) => setNomeFiltro(e.target.value)} 
                placeholder="Buscar por nome, ID ou carteira..." 
                className="pl-11 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-[#FF7A3D] focus-visible:border-[#FF7A3D]/50"
                disabled={isLoadingAll}
              />
              {nomeFiltro && (
                <button 
                  onClick={() => setNomeFiltro('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            <Select value={ordenacao} onValueChange={(value: typeof ordenacao) => setOrdenacao(value)} disabled={isLoadingAll}>
              <SelectTrigger className="w-full sm:w-[220px] h-11 bg-white/5 border-white/10 text-white focus:ring-[#FF7A3D]">
                <ArrowUpDown className="h-4 w-4 mr-2 text-gray-400" />
                <SelectValue placeholder="Ordenar por..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1A1A] border-white/10 text-white">
                <SelectItem value="nome">Nome (A-Z)</SelectItem>
                <SelectItem value="brl_desc">Maior Saldo BRL</SelectItem>
                <SelectItem value="brl_asc">Menor Saldo BRL</SelectItem>
                <SelectItem value="usdt_desc">Maior Saldo USDT</SelectItem>
                <SelectItem value="usdt_asc">Menor Saldo USDT</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Loading Progress */}
        {isLoadingAll && (
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#FF7A3D] to-[#FF8A4D] transition-all duration-300 ease-out shadow-lg shadow-[#FF7A3D]/50"
              style={{ width: `${loadProgress.total > 0 ? (loadProgress.loaded / loadProgress.total) * 100 : 0}%` }}
            />
          </div>
        )}

        {/* User Cards Grid */}
        {list.length === 0 && !isLoadingAll ? (
          <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                <Search className="w-8 h-8 text-gray-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Nenhum resultado encontrado</h3>
              <p className="text-gray-400 max-w-sm mb-6">
                Não encontramos registros correspondentes aos filtros aplicados.
              </p>
              <Button 
                variant="outline"
                className="border-[#FF7A3D]/50 text-[#FF7A3D] hover:bg-[#FF7A3D]/10"
                onClick={() => setNomeFiltro('')}
              >
                Limpar Filtros
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
            {list.map((user, index) => (
              <UserCard 
                key={`${user.id_usuario}-${user.id_brasil_bitcoin}`}
                user={user}
                comparacao={comparacoes[user.id_brasil_bitcoin]}
                checkingId={checkingId}
                onConferir={onConferir}
                index={index}
                canViewExtrato={canViewExtrato}
                onOpenExtrato={() => {
                  setSelectedUserForExtrato(user);
                  setExtratoModalOpen(true);
                }}
              />
            ))}
          </div>
        )}
        
        {/* Footer */}
        <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-400 pt-6 border-t border-white/10 gap-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-[#FF7A3D] rounded-full animate-pulse"></div>
            Visualizando <span className="font-semibold text-white">{list.length}</span> de <span className="font-semibold text-white">{allUsers.length}</span> registros
          </div>
          <div className="flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span>Validado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              <span>Divergência</span>
            </div>
          </div>
        </div>

        {/* Modal de Extrato */}
        {selectedUserForExtrato && (
          <BrbtcExtratoModal
            isOpen={extratoModalOpen}
            onClose={() => {
              setExtratoModalOpen(false);
              setSelectedUserForExtrato(null);
            }}
            userId={selectedUserForExtrato.id_usuario}
            userName={selectedUserForExtrato.nome}
            userBrbtcId={selectedUserForExtrato.id_brasil_bitcoin}
            allUsers={allUsers}
          />
        )}
      </div>
    </div>
  );
}

// User Card Component
function UserCard({ 
  user, 
  comparacao, 
  checkingId, 
  onConferir,
  index,
  canViewExtrato,
  onOpenExtrato
}: { 
  user: UsuarioSaldo;
  comparacao?: SaldosComparacao;
  checkingId: string | null;
  onConferir: (u: UsuarioSaldo) => void;
  index: number;
  canViewExtrato: boolean;
  onOpenExtrato: () => void;
}) {
  const hasDiff = comparacao && (comparacao.brl.diferenca !== 0 || comparacao.usdt.diferenca !== 0);
  const isChecked = !!comparacao;
  const isChecking = checkingId === user.id_brasil_bitcoin;
  
  return (
    <Card 
      className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-sm hover:border-[#FF7A3D]/40 hover:shadow-xl hover:shadow-[#FF7A3D]/10 transition-all duration-300 group"
      style={{
        animation: `fadeInUp 0.4s ease-out ${Math.min(index * 50, 600)}ms backwards`
      }}
    >
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF7A3D]/20 to-[#FF7A3D]/10 border border-[#FF7A3D]/20 flex items-center justify-center">
                <span className="text-sm font-bold text-[#FF7A3D]">
                  {user.nome.substring(0, 2).toUpperCase()}
                </span>
              </div>
              {isChecked && (
                <div className={cn(
                  "absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0A0A0A]",
                  hasDiff ? "bg-orange-500" : "bg-green-500"
                )}>
                  {hasDiff ? (
                    <AlertTriangle className="w-3 h-3 text-white" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  )}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base text-white truncate group-hover:text-[#FF7A3D] transition-colors">
                {user.nome}
              </h3>
              <p className="text-xs text-gray-400 money-font mt-1">ID: {user.id_usuario}</p>
            </div>
          </div>
          
          {!isChecked && (
            <Button 
              size="sm" 
              className="h-8 px-3 text-xs font-semibold bg-gradient-to-r from-[#FF7A3D] to-[#FF8A4D] hover:from-[#FF8A4D] hover:to-[#FF7A3D] text-white border-0 shadow-md shadow-[#FF7A3D]/25 transition-all hover:scale-105"
              onClick={() => onConferir(user)}
              disabled={!user.id_brasil_bitcoin || isChecking}
            >
              {isChecking ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  <Zap className="w-3 h-3 mr-1" />
                  Auditar
                </>
              )}
            </Button>
          )}
        </div>

        {/* Saldos */}
        <div className="space-y-3">
          {/* BRL */}
          <div className="relative p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-6 bg-green-500 rounded-full"></div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">BRL</p>
            </div>
            
            {isChecked && comparacao ? (
              <div className="grid grid-cols-2 gap-3">
                {/* TCR */}
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">TCR</p>
                  <p className={cn(
                    "text-base font-bold money-font",
                    comparacao.brl.local > 0 ? "text-green-400" : "text-gray-500"
                  )}>
                    R$ {comparacao.brl.local.toFixed(2)}
                  </p>
                </div>
                
                {/* Divisor */}
                <div className="absolute left-1/2 top-4 bottom-4 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>
                
                {/* Brasil Bitcoin */}
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Brasil Bitcoin</p>
                  <p className={cn(
                    "text-base font-bold money-font",
                    comparacao.brl.externo > 0 ? "text-amber-400" : "text-gray-500"
                  )}>
                    R$ {comparacao.brl.externo.toFixed(2)}
                  </p>
                  {comparacao.brl.diferenca !== 0 && (
                    <p className={cn(
                      "text-[10px] money-font mt-0.5",
                      comparacao.brl.diferenca > 0 ? "text-green-400" : "text-red-400"
                    )}>
                      {comparacao.brl.diferenca > 0 ? '+' : ''}R$ {comparacao.brl.diferenca.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">TCR</p>
                </div>
                <p className={cn(
                  "text-lg font-bold money-font",
                  (user.saldos?.BRL ?? 0) > 0 ? "text-green-400" : "text-gray-500"
                )}>
                  R$ {(user.saldos?.BRL ?? 0).toFixed(2)}
                </p>
              </div>
            )}
          </div>

          {/* USDT */}
          <div className="relative p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">USDT</p>
            </div>
            
            {isChecked && comparacao ? (
              <div className="grid grid-cols-2 gap-3">
                {/* TCR */}
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">TCR</p>
                  <p className={cn(
                    "text-base font-bold money-font",
                    comparacao.usdt.local > 0 ? "text-blue-400" : "text-gray-500"
                  )}>
                    {comparacao.usdt.local.toFixed(8)}
                  </p>
                </div>
                
                {/* Divisor */}
                <div className="absolute left-1/2 top-4 bottom-4 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>
                
                {/* Brasil Bitcoin */}
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Brasil Bitcoin</p>
                  <p className={cn(
                    "text-base font-bold money-font",
                    comparacao.usdt.externo > 0 ? "text-cyan-400" : "text-gray-500"
                  )}>
                    {comparacao.usdt.externo.toFixed(8)}
                  </p>
                  {comparacao.usdt.diferenca !== 0 && (
                    <p className={cn(
                      "text-[10px] money-font mt-0.5",
                      comparacao.usdt.diferenca > 0 ? "text-green-400" : "text-red-400"
                    )}>
                      {comparacao.usdt.diferenca > 0 ? '+' : ''}{comparacao.usdt.diferenca.toFixed(8)}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">TCR</p>
                </div>
                <p className={cn(
                  "text-lg font-bold money-font",
                  (user.saldos?.USDT ?? 0) > 0 ? "text-blue-400" : "text-gray-500"
                )}>
                  {(user.saldos?.USDT ?? 0).toFixed(8)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {user.id_brasil_bitcoin && (
          <div className="pt-4 border-t border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Wallet className="w-3.5 h-3.5" />
              <span className="money-font truncate max-w-[140px]">{user.id_brasil_bitcoin}</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Botão de Extrato BRBTC - sempre visível para admins quando houver id_brasil_bitcoin */}
              {canViewExtrato && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onOpenExtrato}
                  className="h-8 px-3 text-xs font-semibold bg-gradient-to-r from-blue-500/10 to-blue-600/10 hover:from-blue-500/20 hover:to-blue-600/20 text-blue-400 border-blue-500/30 hover:border-blue-500/50 shadow-md shadow-blue-500/10 transition-all hover:scale-105"
                  title="Ver extrato completo Brasil Bitcoin"
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  Extrato BRBTC
                </Button>
              )}
              {isChecked && (
                <button 
                  onClick={() => onConferir(user)}
                  disabled={isChecking}
                  className="text-xs text-gray-500 hover:text-[#FF7A3D] transition-colors flex items-center gap-1.5 font-medium"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isChecking && "animate-spin")} />
                  Recheck
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// Add fadeInUp animation
const styles = `
  @keyframes fadeInUp {
    from { 
      opacity: 0; 
      transform: translateY(20px); 
    }
    to { 
      opacity: 1; 
      transform: translateY(0); 
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}
