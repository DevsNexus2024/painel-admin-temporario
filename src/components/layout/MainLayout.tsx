import { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { 
    Menu, 
    X, 
    LayoutDashboard, 
    CreditCard, 
    ArrowDownToLine, 
    User, 
    Bell,
    Search,
    LogOut,
    Settings,
    BarChart3,
    Bot,
    Users,
    ListChecks,
    UserSearch,
    TrendingUp,
    Lock,
    KeyRound,
    Building2,
    HelpCircle,
    FileSearch,
    DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useRouteGuard } from "@/hooks/useAuth";
import { FEATURE_FLAGS } from "@/config/env";
import { WithdrawalPinModal } from "@/components/otc/WithdrawalPinModal";
import { useOTCPin } from "@/hooks/useOTCPin";
import { toast } from "sonner";

interface SidebarLinkProps {
    to: string;
    icon: React.ReactNode;
    label: string;
    badge?: string | number;
    isCollapsed?: boolean;
}

const SidebarLink = ({ to, icon, label, badge, isCollapsed }: SidebarLinkProps) => {
    const location = useLocation();
    const isActive = location.pathname === to;

    return (
        <NavLink to={to} className="w-full">
            <div
                className={cn(
                    "group flex items-center rounded-lg px-2 py-2 text-xs font-medium transition-all duration-200 ease-in-out relative overflow-hidden",
                    isCollapsed ? "justify-center gap-0" : "gap-2",
                    isActive 
                        ? "bg-primary/10 text-primary border-r-2 border-primary shadow-sm" 
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
                title={label}
            >
                <div className={cn(
                    "flex-shrink-0 transition-transform duration-200",
                    isActive ? "scale-110" : "group-hover:scale-105"
                )}>
                    {icon}
                </div>
                {!isCollapsed && (
                    <>
                        <span className="flex-1 truncate text-xs">{label}</span>
                        {badge && (
                            <span className="ml-auto bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap font-semibold">
                                {badge}
                            </span>
                        )}
                    </>
                )}
                {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent" />
                )}
            </div>
        </NavLink>
    );
};

export default function MainLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [pinModalOpen, setPinModalOpen] = useState(false);
    const { user, logout } = useAuth();
    const { canAccessRoute } = useRouteGuard();
    const { status: pinStatus } = useOTCPin();

    // IDs de usuários bloqueados da rota cash-closure
    const BLOCKED_USER_IDS = [7, 74, 115];

    /**
     * Verifica se usuário está bloqueado de ver/acessar rota específica
     */
    const isUserBlockedFromRoute = (routePath: string): boolean => {
        if (!user) return false;
        
        // Bloquear IDs específicos da rota cash-closure
        if (routePath === '/dashboard/cash-closure') {
            const userId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
            return BLOCKED_USER_IDS.includes(userId);
        }
        
        return false;
    };

    const canShow = (path: string) => {
        // Verificar bloqueio por ID primeiro
        if (isUserBlockedFromRoute(path)) {
            return false;
        }
        return canAccessRoute(path);
    };

    const showGrupoTcr =
      canShow("/grupo-tcr/saldos") ||
      (FEATURE_FLAGS.ENABLE_EXTRATO_TCR && canShow("/extrato_tcr")) ||
      (FEATURE_FLAGS.ENABLE_COMPENSACAO_DEPOSITOS && canShow("/compensacao-depositos")) ||
      (FEATURE_FLAGS.ENABLE_BMP531_TCR && canShow("/bmp-531")) ||
      canShow("/grupo-tcr/tcr") ||
      (FEATURE_FLAGS.ENABLE_CORPX_TTF_TCR && canShow("/grupo-tcr/corpx-ttf")) ||
      canShow("/analise-usuario/32") ||
      canShow("/brasilcash-tcr") ||
      canShow("/belmontx-tcr") ||
      canShow("/auditoria-depositos");

    const showGrupoOtc =
      canShow("/cotacoes") ||
      canShow("/bot-cotacao") ||
      canShow("/otc") ||
      canShow("/otc/negociar") ||
      // canShow("/bitso") || // Desabilitado temporariamente
      canShow("/belmontx-otc") ||
      canShow("/corpx");

    // Desabilitado temporariamente
    const showContasOrganizacoes = false;
      // canShow("/contas-organizacoes") ||
      // canShow("/bitso-api") ||
      // canShow("/suporte");

    // Debug: Log do status do PIN
    useEffect(() => {
        console.log('🔍 DEBUG PIN STATUS:', {
            loading: pinStatus.loading,
            isAdmin: pinStatus.isAdmin,
            pinConfigured: pinStatus.pinConfigured,
            user: user?.email
        });
    }, [pinStatus, user]);

    // Detectar tela móvel e fechar sidebar automaticamente
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                setIsSidebarOpen(false);
            }
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
    };

    // Função para obter iniciais do usuário
    const getUserInitials = (name?: string, email?: string): string => {
        if (name) {
            return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        }
        if (email) {
            return email.slice(0, 2).toUpperCase();
        }
        return 'U';
    };

    const handleLogout = () => {
        logout();
    };

    return (
        <div className="flex min-h-screen w-full bg-background">
            {/* Sidebar */}
            <aside className={cn(
                "fixed inset-y-0 left-0 z-50 transform bg-card/50 backdrop-blur-xl border-r border-border/50 transition-all duration-300 ease-in-out md:relative md:translate-x-0",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full",
                isCollapsed ? "w-20" : "w-64"
            )}>
                {/* Overlay para mobile */}
                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 z-40 bg-black/50 md:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}

                <div className="flex h-full flex-col relative z-50">
                    {/* Header da Sidebar */}
                    <div className={cn("flex items-center border-b border-border/50 py-4", isCollapsed ? "px-2" : "px-4")}>
                        <div className={cn(
                            "flex items-center gap-2 transition-all duration-300",
                            isCollapsed ? "justify-center w-full" : "gap-2"
                        )}>
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                                <span className="text-primary-foreground font-bold text-xs">T</span>
                            </div>
                            {!isCollapsed && (
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-xs font-semibold text-foreground truncate">TCR Admin</h2>
                                    <p className="text-[10px] text-muted-foreground truncate">Central de Gestão</p>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1 ml-auto">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hidden md:flex"
                                onClick={toggleCollapse}
                                title={isCollapsed ? "Expandir menu" : "Recolher menu"}
                            >
                                <Menu className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 md:hidden"
                                onClick={toggleSidebar}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Navegação */}
                    <ScrollArea className={cn("flex-1 py-4", isCollapsed ? "px-2" : "px-3")}>
                        <nav className={cn("space-y-2", isCollapsed && "space-y-1")}>
                            {/* ========== SEÇÃO PRINCIPAL (DEPRECIADA) ========== */}
                            {/* 🚫 Dashboard removido por ser depreciado */}
                            {/* Para reativar: VITE_FEATURE_DASHBOARD=true no .env */}
                            {FEATURE_FLAGS.ENABLE_DASHBOARD && (
                                <div className="pb-2">
                                    {!isCollapsed && (
                                        <h3 className="mb-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                            Principal
                                        </h3>
                                    )}
                                    <div className="space-y-1">
                                        <SidebarLink
                                            to="/"
                                            icon={<LayoutDashboard className="h-4 w-4" />}
                                            label="Dashboard"
                                            badge="3"
                                            isCollapsed={isCollapsed}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* ========== DASHBOARDS ========== */}
                            {canShow("/dashboard/cash-closure") && (
                                <div className="pb-2">
                                    {!isCollapsed && (
                                        <h3 className="mb-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                            Dashboards
                                        </h3>
                                    )}
                                    <div className="space-y-1">
                                        <SidebarLink
                                            to="/dashboard/cash-closure"
                                            icon={<DollarSign className="h-4 w-4" />}
                                            label="Cash Closure"
                                            isCollapsed={isCollapsed}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* ========== GRUPO TCR ========== */}
                            {showGrupoTcr && (
                            <div className="pb-2">
                                {!isCollapsed && (
                                    <h3 className="mb-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                        Grupo TCR
                                    </h3>
                                )}
                                <div className="space-y-1">
                                    {/* 🚫 MENUS DEPRECIADOS - Desabilitados por padrão */}
                                    {/* Para reativar: Defina as variáveis no .env */}
                                    
                                    {FEATURE_FLAGS.ENABLE_EXTRATO_TCR && canShow("/extrato_tcr") && (
                                        <SidebarLink
                                            to="/extrato_tcr"
                                            icon={<CreditCard className="h-4 w-4" />}
                                            label="Extrato de Contas - TCR"
                                            isCollapsed={isCollapsed}
                                        />
                                    )}
                                    
                                    {FEATURE_FLAGS.ENABLE_COMPENSACAO_DEPOSITOS && canShow("/compensacao-depositos") && (
                                        <SidebarLink
                                            to="/compensacao-depositos"
                                            icon={<ArrowDownToLine className="h-4 w-4" />}
                                            label="Compensação de Depósitos - TCR"
                                            isCollapsed={isCollapsed}
                                        />
                                    )}
                                    
                                    {/* ✅ MENU ATIVO */}
                                    {canShow("/grupo-tcr/saldos") && (
                                      <SidebarLink
                                          to="/grupo-tcr/saldos"
                                          icon={<ListChecks className="h-4 w-4" />}
                                          label="Saldos & Conferência"
                                          isCollapsed={isCollapsed}
                                      />
                                    )}
                                    
                                    {FEATURE_FLAGS.ENABLE_BMP531_TCR && canShow("/bmp-531") && (
                                        <SidebarLink
                                            to="/bmp-531"
                                            icon={<CreditCard className="h-4 w-4" />}
                                            label="BMP 531 TCR"
                                            isCollapsed={isCollapsed}
                                        />
                                    )}
                                    
                                    {/* ✅ MENU ATIVO */}
                                    {canShow("/grupo-tcr/tcr") && (
                                      <SidebarLink
                                          to="/grupo-tcr/tcr"
                                          icon={<CreditCard className="h-4 w-4" />}
                                          label="CorpX TCR"
                                          isCollapsed={isCollapsed}
                                      />
                                    )}
                                    
                                    {FEATURE_FLAGS.ENABLE_CORPX_TTF_TCR && canShow("/grupo-tcr/corpx-ttf") && (
                                        <SidebarLink
                                            to="/grupo-tcr/corpx-ttf"
                                            icon={<CreditCard className="h-4 w-4" />}
                                            label="CorpX TTF → TCR"
                                            isCollapsed={isCollapsed}
                                        />
                                    )}
                                    
                                    {/* ✅ MENU ATIVO */}
                                    {canShow("/analise-usuario/32") && (
                                      <SidebarLink
                                          to="/analise-usuario/32"
                                          icon={<UserSearch className="h-4 w-4" />}
                                          label="Análise de Usuário BRBTC"
                                          isCollapsed={isCollapsed}
                                      />
                                    )}
                                    
                                    {/* ✅ MENU ATIVO */}
                                    {canShow("/brasilcash-tcr") && (
                                      <SidebarLink
                                          to="/brasilcash-tcr"
                                          icon={<CreditCard className="h-4 w-4" />}
                                          label="BrasilCash <> TCR"
                                          isCollapsed={isCollapsed}
                                      />
                                    )}
                                    
                                    {/* ✅ MENU ATIVO */}
                                    {canShow("/belmontx-tcr") && (
                                      <SidebarLink
                                          to="/belmontx-tcr"
                                          icon={<CreditCard className="h-4 w-4" />}
                                          label="BelmontX <> TCR"
                                          isCollapsed={isCollapsed}
                                      />
                                    )}
                                    
                                    {/* ✅ MENU ATIVO - Auditoria de Depósitos */}
                                    {canShow("/auditoria-depositos") && (
                                      <SidebarLink
                                          to="/auditoria-depositos"
                                          icon={<FileSearch className="h-4 w-4" />}
                                          label="Auditoria de Depósitos"
                                          isCollapsed={isCollapsed}
                                      />
                                    )}
                                </div>
                            </div>
                            )}

                            {showGrupoOtc && (
                            <div className="pb-2">
                                {!isCollapsed && (
                                    <h3 className="mb-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                        Grupo OTC
                                    </h3>
                                )}
                                <div className="space-y-1">
                                    {/* Gerenciador de Contas DESATIVADO - Funcionalidade movida para Bitso OTC/TCR */}
                                    {/* <SidebarLink
                                        to="/pagamentos"
                                        icon={<CreditCard className="h-4 w-4" />}
                                        label="Gerenciador de Contas"
                                        isCollapsed={isCollapsed}
                                    /> */}
                                    {canShow("/cotacoes") && (
                                      <SidebarLink
                                          to="/cotacoes"
                                          icon={<BarChart3 className="h-4 w-4" />}
                                          label="Cotações em Tempo Real"
                                          isCollapsed={isCollapsed}
                                      />
                                    )}
                                    {canShow("/bot-cotacao") && (
                                      <SidebarLink
                                          to="/bot-cotacao"
                                          icon={<Bot className="h-4 w-4" />}
                                          label="Bot de Cotação"
                                          isCollapsed={isCollapsed}
                                      />
                                    )}
                                    {canShow("/otc") && (
                                      <SidebarLink
                                          to="/otc"
                                          icon={<Users className="h-4 w-4" />}
                                          label="Clientes OTC"
                                          isCollapsed={isCollapsed}
                                      />
                                    )}
                                    {canShow("/otc/negociar") && (
                                      <SidebarLink
                                          to="/otc/negociar"
                                          icon={<TrendingUp className="h-4 w-4" />}
                                          label="Negociar"
                                          isCollapsed={isCollapsed}
                                      />
                                    )}
                                    {/* Desabilitado temporariamente */}
                                    {/* {canShow("/bitso") && (
                                      <SidebarLink
                                          to="/bitso"
                                          icon={<CreditCard className="h-4 w-4" />}
                                          label="Bitso <> OTC"
                                          isCollapsed={isCollapsed}
                                      />
                                    )} */}
                                    {canShow("/belmontx-otc") && (
                                      <SidebarLink
                                          to="/belmontx-otc"
                                          icon={<CreditCard className="h-4 w-4" />}
                                          label="BelmontX <> OTC"
                                          isCollapsed={isCollapsed}
                                      />
                                    )}
                                    {canShow("/corpx") && (
                                      <SidebarLink
                                          to="/corpx"
                                          icon={<CreditCard className="h-4 w-4" />}
                                          label="Central CorpX"
                                          isCollapsed={isCollapsed}
                                      />
                                    )}
                                </div>
                            </div>
                            )}

                            {/* ========== GRUPO CONTAS E ORGANIZAÇÕES ========== */}
                            {showContasOrganizacoes && (
                            <div className="pb-2">
                                {!isCollapsed && (
                                    <h3 className="mb-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                        Contas e Organizações
                                    </h3>
                                )}
                                <div className="space-y-1">
                                    {canShow("/contas-organizacoes") && (
                                      <SidebarLink
                                          to="/contas-organizacoes"
                                          icon={<Building2 className="h-4 w-4" />}
                                          label="Contas e Organizações"
                                          isCollapsed={isCollapsed}
                                      />
                                    )}
                                    {canShow("/bitso-api") && (
                                      <SidebarLink
                                          to="/bitso-api"
                                          icon={<CreditCard className="h-4 w-4" />}
                                          label="Bitso <> API"
                                          isCollapsed={isCollapsed}
                                      />
                                    )}
                                    {canShow("/suporte") && (
                                      <SidebarLink
                                          to="/suporte"
                                          icon={<HelpCircle className="h-4 w-4" />}
                                          label="Suporte"
                                          isCollapsed={isCollapsed}
                                      />
                                    )}
                                </div>
                            </div>
                            )}
                        </nav>
                    </ScrollArea>

                    {/* Footer da Sidebar */}
                    <div className="border-t border-border/50 p-4">
                        <div className={cn(
                            "flex items-center text-sm transition-all duration-300",
                            isCollapsed ? "justify-center" : "gap-3"
                        )}>
                            <Avatar className="h-8 w-8 flex-shrink-0">
                                <AvatarFallback className="bg-primary/10 text-primary">
                                    {getUserInitials(user?.name, user?.email)}
                                </AvatarFallback>
                            </Avatar>
                            {!isCollapsed && (
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">
                                        {user?.name || 'Usuário'}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {user?.email || 'user@email.com'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </aside>

            {/* Conteúdo Principal */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Top Bar */}
                <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
                    <div className="flex h-16 items-center gap-4 px-4 md:px-6">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 md:hidden"
                            onClick={toggleSidebar}
                        >
                            <Menu className="h-4 w-4" />
                            <span className="sr-only">Toggle Menu</span>
                        </Button>

                        {/* Breadcrumb ou título da página */}
                        <div className="flex-1">
                            <div className="relative max-w-md">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar transações, usuários..."
                                    className="pl-9 bg-muted/50 border-0 focus-visible:ring-1"
                                />
                            </div>
                        </div>

                        {/* Ações do usuário */}
                        <div className="flex items-center gap-2">
                            {/* Notificações */}
                            <Button variant="ghost" size="icon" className="h-9 w-9 relative">
                                <Bell className="h-4 w-4" />
                                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                                    3
                                </Badge>
                            </Button>

                            {/* Menu do usuário */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback className="bg-primary/10 text-primary">
                                                {getUserInitials(user?.name, user?.email)}
                                            </AvatarFallback>
                                        </Avatar>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <div className="flex items-center justify-start gap-2 p-2">
                                        <div className="flex flex-col space-y-1 leading-none">
                                            <p className="font-medium">{user?.name || 'Usuário'}</p>
                                            <p className="w-[200px] truncate text-sm text-muted-foreground">
                                                {user?.email}
                                            </p>
                                        </div>
                                    </div>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem>
                                        <User className="mr-2 h-4 w-4" />
                                        Perfil
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                        <Settings className="mr-2 h-4 w-4" />
                                        Configurações
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => {
                                            // Verificar permissões antes de abrir
                                            if (!pinStatus.isAdmin) {
                                                toast.error('Apenas administradores podem gerenciar PIN de saque');
                                                return;
                                            }
                                            setPinModalOpen(true);
                                        }}
                                        disabled={pinStatus.loading || !pinStatus.isAdmin}
                                    >
                                        <KeyRound className="mr-2 h-4 w-4" />
                                        {pinStatus.loading 
                                            ? 'Carregando...' 
                                            : pinStatus.pinConfigured 
                                            ? 'Alterar PIN de Saque' 
                                            : 'Cadastrar PIN de Saque'}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                        className="text-destructive cursor-pointer"
                                        onClick={handleLogout}
                                    >
                                        <LogOut className="mr-2 h-4 w-4" />
                                        Sair
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </header>

                {/* Conteúdo da Página */}
                <main className="flex-1 overflow-auto">
                    <Outlet />
                </main>

                {/* Modal de PIN de Saque */}
                <WithdrawalPinModal
                    isOpen={pinModalOpen}
                    onClose={() => setPinModalOpen(false)}
                    hasExistingPin={pinStatus.pinConfigured}
                />
            </div>
        </div>
    );
} 