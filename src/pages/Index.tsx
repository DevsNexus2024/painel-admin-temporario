import React, { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { DashboardStats } from '@/components/DashboardStats';
import SearchForm from '@/components/SearchForm';
import DepositComparison from '@/components/DepositComparison';
import { fetchTcrDeposits, fetchExternalDeposits } from '@/services/api';
import { compareDeposits } from '@/utils/depositComparison';
import { ComparisonResult, TcrResponse, ExternalDeposit } from '@/types/deposit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  FileText, 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  TrendingUp,
  Activity,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Wallet
} from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { usePermissions } from '@/hooks/useAuth';

// Dados de exemplo para o dashboard
const monthlyData = [
  { month: "Jan", depositos: 80000, saques: 45000, transferencias: 25000 },
  { month: "Fev", depositos: 65000, saques: 38000, transferencias: 20000 },
  { month: "Mar", depositos: 92000, saques: 52000, transferencias: 30000 },
  { month: "Abr", depositos: 78000, saques: 44000, transferencias: 28000 },
  { month: "Mai", depositos: 110000, saques: 62000, transferencias: 35000 },
  { month: "Jun", depositos: 85000, saques: 48000, transferencias: 25000 },
];

const pieData = [
  { name: "Depósitos", value: 45, color: "hsl(var(--primary))" },
  { name: "Saques", value: 25, color: "hsl(var(--destructive))" },
  { name: "Transferências", value: 20, color: "hsl(var(--accent))" },
  { name: "Pagamentos", value: 10, color: "hsl(var(--muted-foreground))" },
];

const recentActivity = [
  {
    id: 1,
    type: "deposit",
    description: "Depósito processado",
    value: "R$ 1.250,00",
    user: "Felipe B.",
    time: "2 min atrás",
    status: "success"
  },
  {
    id: 2,
    type: "user",
    description: "Novo usuário registrado",
    value: "",
    user: "Maria S.",
    time: "5 min atrás",
    status: "info"
  },
  {
    id: 3,
    type: "transfer",
    description: "Transferência PIX realizada",
    value: "R$ 850,00",
    user: "João P.",
    time: "8 min atrás",
    status: "success"
  },
  {
    id: 4,
    type: "withdrawal",
    description: "Saque processado",
    value: "R$ 500,00",
    user: "Ana C.",
    time: "12 min atrás",
    status: "warning"
  }
];

const Index = () => {
  const { hasRole, hasAnyRole } = usePermissions();
  const [isLoading, setIsLoading] = useState(false);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userId, setUserId] = useState<number>(0);

  // ✅ Usuários não-admin não devem acessar o dashboard (home redireciona para a rota correta)
  const isAdminDashboardUser = hasAnyRole(['super_admin', 'admin']);
  if (!isAdminDashboardUser) {
    if (hasRole('tcr_user')) return <Navigate to="/grupo-tcr/tcr" replace />;
    if (hasRole('otc_user')) return <Navigate to="/otc" replace />;
    // Fallback seguro: volta pro login
    return <Navigate to="/login" replace />;
  }

  const handleSearch = async (email: string, amount: string) => {
    setIsLoading(true);
    setComparisonResults([]);

    try {
      setUserEmail(email);

      const tcrResponse: TcrResponse = await fetchTcrDeposits(email);

      if (tcrResponse.mensagem !== 'OKL' || !tcrResponse.response) {
        toast.error('Erro ao buscar depósitos do sistema TCR');
        return;
      }

      setUserId(tcrResponse.response.id_usuario);

      const externalDeposits: ExternalDeposit[] = await fetchExternalDeposits(email);

      const results = compareDeposits(
        tcrResponse.response.depositos,
        externalDeposits,
        amount
      );

      setComparisonResults(results);

      const notFoundCount = results.filter(r => r.status === 'not_found').length;
      if (notFoundCount > 0) {
        toast.warning(`Encontrados ${notFoundCount} depósitos não sincronizados.`);
      } else {
        toast.success('Todos os depósitos estão sincronizados.');
      }

    } catch (error) {
      console.error('Error during deposit comparison:', error);
      toast.error('Ocorreu um erro ao comparar os depósitos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDepositRegistered = async () => {
    if (userEmail) {
      await handleSearch(userEmail, '');
    }
  };

  // Dados das estatísticas
  const dashboardStats = [
    {
      title: "Total de Transações",
      value: "1.234",
      change: { value: 12.5, type: 'increase' as const },
      icon: LayoutDashboard
    },
    {
      title: "Volume Total",
      value: "R$ 945.282",
      change: { value: 5.2, type: 'increase' as const },
      icon: DollarSign
    },
    {
      title: "Novos Usuários",
      value: "132",
      change: { value: 18.7, type: 'increase' as const },
      icon: Users
    },
    {
      title: "Taxa de Conversão",
      value: "6,8%",
      change: { value: 2.1, type: 'increase' as const },
      icon: TrendingUp
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Sincronizador de Depósitos"
        description="Gerencie e monitore transações do sistema TCR Admin"
        breadcrumbs={[
          { label: "Dashboard", isActive: true }
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
              <Link to="/extrato_tcr">
                <FileText className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Extrato TCR</span>
                <span className="sm:hidden">Extrato</span>
              </Link>
            </Button>
            <Button size="sm" className="w-full sm:w-auto">
              <Activity className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Nova Análise</span>
              <span className="sm:hidden">Analisar</span>
            </Button>
          </>
        }
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Estatísticas Dashboard */}
        <DashboardStats stats={dashboardStats} />

        {/* Formulário de Busca */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg sm:text-xl">Buscar Depósitos</CardTitle>
            <CardDescription>
              Compare depósitos entre os sistemas TCR e externo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SearchForm onSearch={handleSearch} isLoading={isLoading} />
          </CardContent>
        </Card>

        {/* Resultados da Busca */}
        {isLoading ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-8 w-8 sm:h-10 sm:w-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="mt-4 text-sm sm:text-base">Buscando depósitos...</span>
            </CardContent>
          </Card>
        ) : comparisonResults.length > 0 ? (
          <DepositComparison
            results={comparisonResults}
            userEmail={userEmail}
            userId={userId}
            onDepositRegistered={handleDepositRegistered}
          />
        ) : null}

        {/* Gráficos e Análises */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Volume Mensal</CardTitle>
              <CardDescription>
                Histórico de transações por mês
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      tickFormatter={(value) => `${value / 1000}k`}
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(value: any) => [`R$ ${value.toLocaleString()}`, "Valor"]}
                      labelFormatter={(label) => `Mês: ${label}`}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="depositos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Distribuição de Operações</CardTitle>
              <CardDescription>
                Porcentagem por tipo de transação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] sm:h-[300px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => [`${value}%`, "Porcentagem"]}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {pieData.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs sm:text-sm text-muted-foreground">
                      {item.name}: {item.value}%
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Atividades Recentes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Atividades Recentes</CardTitle>
            <CardDescription>
              Últimas transações e eventos do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center gap-4 p-3 sm:p-4 rounded-lg bg-muted/30 transition-colors hover:bg-muted/50">
                  <div className={`flex-shrink-0 p-2 rounded-full ${
                    activity.status === 'success' ? 'bg-green-500/10 text-green-500' :
                    activity.status === 'warning' ? 'bg-yellow-500/10 text-yellow-500' :
                    'bg-blue-500/10 text-blue-500'
                  }`}>
                    {activity.type === 'deposit' ? <ArrowDownRight className="h-4 w-4" /> :
                     activity.type === 'withdrawal' ? <ArrowUpRight className="h-4 w-4" /> :
                     activity.type === 'transfer' ? <CreditCard className="h-4 w-4" /> :
                     <Users className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {activity.description}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {activity.user} • {activity.time}
                    </p>
                  </div>
                  {activity.value && (
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-medium text-foreground">
                        {activity.value}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="text-center py-4">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Dados de exemplo para demonstração • Sistema TCR Admin v2.0
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
