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
    ListChecks
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

interface SidebarLinkProps {
    to: string;
    icon: React.ReactNode;
    label: string;
    badge?: string | number;
}

const SidebarLink = ({ to, icon, label, badge }: SidebarLinkProps) => {
    const location = useLocation();
    const isActive = location.pathname === to;

    return (
        <NavLink to={to} className="w-full">
            <div
                className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-in-out relative overflow-hidden",
                    isActive 
                        ? "bg-primary/10 text-primary border-r-2 border-primary shadow-sm" 
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
            >
                <div className={cn(
                    "flex-shrink-0 transition-transform duration-200",
                    isActive ? "scale-110" : "group-hover:scale-105"
                )}>
                    {icon}
                </div>
                <span className="flex-1">{label}</span>
                {badge && (
                    <span className="ml-auto bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">
                        {badge}
                    </span>
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
    const { user, logout } = useAuth();

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
                "fixed inset-y-0 left-0 z-50 w-64 transform bg-card/50 backdrop-blur-xl border-r border-border/50 transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full"
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
                    <div className="flex items-center gap-3 border-b border-border/50 px-4 py-4">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                                <span className="text-primary-foreground font-bold text-sm">T</span>
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-foreground">TCR Admin</h2>
                                <p className="text-xs text-muted-foreground">Central de Gestão</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="ml-auto h-8 w-8 md:hidden"
                            onClick={toggleSidebar}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Navegação */}
                    <ScrollArea className="flex-1 px-3 py-4">
                        <nav className="space-y-2">
                            <div className="pb-2">
                                <h3 className="mb-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Principal
                                </h3>
                                <div className="space-y-1">
                                    <SidebarLink
                                        to="/"
                                        icon={<LayoutDashboard className="h-4 w-4" />}
                                        label="Dashboard"
                                        badge="3"
                                    />
                                </div>
                            </div>

                            <div className="pb-2">
                                <h3 className="mb-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Grupo TCR
                                </h3>
                                <div className="space-y-1">
                                    <SidebarLink
                                        to="/extrato_tcr"
                                        icon={<CreditCard className="h-4 w-4" />}
                                        label="Extrato de Contas - TCR"
                                    />
                                    <SidebarLink
                                        to="/compensacao-depositos"
                                        icon={<ArrowDownToLine className="h-4 w-4" />}
                                        label="Compensação de Depósitos - TCR"
                                    />
                                    <SidebarLink
                                        to="/grupo-tcr/saldos"
                                        icon={<ListChecks className="h-4 w-4" />}
                                        label="Saldos & Conferência"
                                    />
                                    <SidebarLink
                                        to="/bmp-531"
                                        icon={<CreditCard className="h-4 w-4" />}
                                        label="BMP 531 TCR"
                                    />
                                </div>
                            </div>

                            <div className="pb-2">
                                <h3 className="mb-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Grupo OTC
                                </h3>
                                <div className="space-y-1">
                                    <SidebarLink
                                        to="/pagamentos"
                                        icon={<CreditCard className="h-4 w-4" />}
                                        label="Gerenciador de Contas"
                                    />
                                    <SidebarLink
                                        to="/cotacoes"
                                        icon={<BarChart3 className="h-4 w-4" />}
                                        label="Cotações em Tempo Real"
                                        badge="LIVE"
                                    />
                                    <SidebarLink
                                        to="/bot-cotacao"
                                        icon={<Bot className="h-4 w-4" />}
                                        label="Bot de Cotação"
                                        badge="BETA"
                                    />
                                    <SidebarLink
                                        to="/otc"
                                        icon={<Users className="h-4 w-4" />}
                                        label="Clientes OTC"
                                        badge="NOVO"
                                    />
                                </div>
                            </div>
                        </nav>
                    </ScrollArea>

                    {/* Footer da Sidebar */}
                    <div className="border-t border-border/50 p-4">
                        <div className="flex items-center gap-3 text-sm">
                            <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary">
                                    {getUserInitials(user?.name, user?.email)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                    {user?.name || 'Usuário'}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                    {user?.email || 'user@email.com'}
                                </p>
                            </div>
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
            </div>
        </div>
    );
} 