import React from 'react';
import { Users, DollarSign, TrendingUp, Activity, UserCheck, UserX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOTCStats } from '@/hooks/useOTCStats';
import { otcService } from '@/services/otc';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Componente para cards de estatísticas
 */
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'green' | 'red' | 'yellow';
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon, 
  description, 
  trend = 'neutral',
  color = 'blue' 
}) => {
  const colorClasses = {
    blue: 'border-blue-200 bg-blue-50 text-blue-600',
    green: 'border-green-200 bg-green-50 text-green-600',
    red: 'border-red-200 bg-red-50 text-red-600',
    yellow: 'border-yellow-200 bg-yellow-50 text-yellow-600'
  };

  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-600'
  };

  return (
    <Card className="transition-all duration-200 hover:shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-full ${colorClasses[color]}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground mb-1">
          {value}
        </div>
        {description && (
          <p className={`text-xs ${trendColors[trend]}`}>
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Componente skeleton para loading
 */
const StatCardSkeleton: React.FC = () => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-8 rounded-full" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-8 w-16 mb-1" />
      <Skeleton className="h-3 w-32" />
    </CardContent>
  </Card>
);

/**
 * Página principal do dashboard OTC
 */
const OTCDashboard: React.FC = () => {
  const { stats, isLoading, error } = useOTCStats();

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Erro ao carregar dashboard
          </h2>
          <p className="text-red-600">
            Não foi possível carregar as estatísticas do sistema OTC. 
            Tente novamente mais tarde.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Dashboard OTC
          </h1>
          <p className="text-muted-foreground">
            Painel de controle para operações Over-the-Counter
          </p>
        </div>
        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">
          <Activity className="w-3 h-3 mr-1" />
          Em tempo real
        </Badge>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {isLoading ? (
          // Skeletons durante o carregamento
          Array.from({ length: 6 }).map((_, index) => (
            <StatCardSkeleton key={index} />
          ))
        ) : (
          <>
            {/* Total de Clientes */}
            <StatCard
              title="Total de Clientes"
              value={stats.clientes.total}
              icon={<Users className="h-4 w-4" />}
              description="Clientes cadastrados"
              color="blue"
            />

            {/* Clientes Ativos */}
            <StatCard
              title="Clientes Ativos"
              value={stats.clientes.ativos}
              icon={<UserCheck className="h-4 w-4" />}
              description="Contas ativas"
              color="green"
            />

            {/* Clientes Inativos */}
            <StatCard
              title="Clientes Inativos"
              value={stats.clientes.inativos}
              icon={<UserX className="h-4 w-4" />}
              description="Contas inativas"
              color="red"
            />

            {/* Saldo Total */}
            <StatCard
              title="Saldo Total"
              value={otcService.formatCurrency(stats.valores.saldo_total)}
              icon={<DollarSign className="h-4 w-4" />}
              description="Saldo consolidado"
              color="green"
              trend={stats.valores.saldo_total >= 0 ? 'up' : 'down'}
            />

            {/* Transações Total */}
            <StatCard
              title="Total de Transações"
              value={stats.transacoes.total}
              icon={<TrendingUp className="h-4 w-4" />}
              description="Transações processadas"
              color="blue"
            />

            {/* Transações Hoje */}
            <StatCard
              title="Transações Hoje"
              value={stats.transacoes.hoje}
              icon={<Activity className="h-4 w-4" />}
              description="Transações do dia"
              color="yellow"
            />
          </>
        )}
      </div>

      {/* Cards de valores detalhados */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <StatCardSkeleton key={index} />
          ))
        ) : (
          <>
            {/* Total de Depósitos */}
            <StatCard
              title="Total de Depósitos"
              value={otcService.formatCurrency(stats.valores.total_depositos)}
              icon={<TrendingUp className="h-4 w-4" />}
              description="Valor total depositado"
              color="green"
            />

            {/* Total de Saques */}
            <StatCard
              title="Total de Saques"
              value={otcService.formatCurrency(stats.valores.total_saques)}
              icon={<TrendingUp className="h-4 w-4 rotate-180" />}
              description="Valor total sacado"
              color="red"
            />

            {/* Resultado Líquido */}
            <StatCard
              title="Resultado Líquido"
              value={otcService.formatCurrency(stats.valores.total_depositos - stats.valores.total_saques)}
              icon={<DollarSign className="h-4 w-4" />}
              description="Depósitos - Saques"
              color={(stats.valores.total_depositos - stats.valores.total_saques) >= 0 ? 'green' : 'red'}
              trend={(stats.valores.total_depositos - stats.valores.total_saques) >= 0 ? 'up' : 'down'}
            />
          </>
        )}
      </div>

      {/* Seção de resumo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Resumo do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Taxa de Atividade dos Clientes
                </span>
                <span className="text-sm font-medium">
                  {stats.clientes.total > 0 
                    ? `${((stats.clientes.ativos / stats.clientes.total) * 100).toFixed(1)}%`
                    : '0%'
                  }
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Média de Transações por Cliente
                </span>
                <span className="text-sm font-medium">
                  {stats.clientes.total > 0 
                    ? (stats.transacoes.total / stats.clientes.total).toFixed(1)
                    : '0'
                  }
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Saldo Médio por Cliente
                </span>
                <span className="text-sm font-medium">
                  {stats.clientes.total > 0 
                    ? otcService.formatCurrency(stats.valores.saldo_total / stats.clientes.total)
                    : otcService.formatCurrency(0)
                  }
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OTCDashboard; 