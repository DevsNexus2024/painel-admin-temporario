import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Download, Users, DollarSign, TrendingUp, Calendar } from 'lucide-react';
import { useDepositReport, DepositReportFilters } from '@/hooks/useDepositReport';
// Função para formatar valores em Real brasileiro
const formatBRL = (value: number | string | null | undefined): string => {
  if (!value && value !== 0) return 'R$ 0,00';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return 'R$ 0,00';
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numValue);
};

export default function DepositReport() {
  const { data, isLoading, error, fetchReport, clearData } = useDepositReport();
  
  const [filters, setFilters] = useState<DepositReportFilters>({
    whitelabel: 'TODOS',
    data_inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 dias atrás
    data_fim: new Date().toISOString().split('T')[0], // hoje
    ordenacao: 'maior_deposito',
    incluir_detalhes: 'false'
  });

  const handleSearch = async () => {
    await fetchReport(filters);
  };

  const handleClear = () => {
    clearData();
  };

  const exportToCSV = () => {
    if (!data?.response.usuarios) return;

    // console.log('📄 EXPORTANDO CSV - Total de usuários:', data.response.usuarios.length);
    // console.log('📄 PRIMEIRO USUÁRIO PARA EXPORT:', data.response.usuarios[0]);

    const headers = [
      'ID Usuário',
      'Nome',
      'Documento', 
      'Email',
      'ID Brasil Bitcoin',
      'Whitelabel',
      'Total Depositado',
      'Quantidade Depósitos'
    ];

    // Função para escapar valores CSV
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      // Se contém vírgula, aspas ou quebra de linha, colocar entre aspas e escapar aspas internas
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.join(','),
      ...data.response.usuarios.map(user => [
        escapeCSV(user.id_usuario || ''),
        escapeCSV(user.nome || 'Nome não informado'),
        escapeCSV(user.documento || ''),
        escapeCSV(user.email || ''),
        escapeCSV(user.id_brasil_bitcoin || ''),
        escapeCSV(user.whitelabel || ''),
        escapeCSV(user.total_depositado || 0),
        escapeCSV(user.quantidade_depositos || 0)
      ].join(','))
    ].join('\n');

    // Adicionar BOM (Byte Order Mark) para Excel reconhecer UTF-8
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const whitelabelSuffix = filters.whitelabel && filters.whitelabel !== 'TODOS' ? `-${filters.whitelabel}` : '';
    link.setAttribute('download', `relatorio-depositos${whitelabelSuffix}-${filters.data_inicio}-${filters.data_fim}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Relatório de Depósitos por Whitelabel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="whitelabel">Whitelabel</Label>
              <Select
                value={filters.whitelabel}
                onValueChange={(value: 'EMX' | 'TCR' | 'TODOS') => 
                  setFilters(prev => ({ ...prev, whitelabel: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o whitelabel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  <SelectItem value="EMX">EMX</SelectItem>
                  <SelectItem value="TCR">TCR</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_inicio">Data Início</Label>
              <Input
                id="data_inicio"
                type="date"
                value={filters.data_inicio}
                onChange={(e) => setFilters(prev => ({ ...prev, data_inicio: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_fim">Data Fim</Label>
              <Input
                id="data_fim"
                type="date"
                value={filters.data_fim}
                onChange={(e) => setFilters(prev => ({ ...prev, data_fim: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ordenacao">Ordenação</Label>
              <Select
                value={filters.ordenacao}
                onValueChange={(value: 'maior_deposito' | 'menor_deposito') =>
                  setFilters(prev => ({ ...prev, ordenacao: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a ordenação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="maior_deposito">Maiores Depositadores</SelectItem>
                  <SelectItem value="menor_deposito">Menores Depositadores</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="incluir_detalhes"
              checked={filters.incluir_detalhes === 'true'}
              onCheckedChange={(checked) =>
                setFilters(prev => ({ ...prev, incluir_detalhes: checked ? 'true' : 'false' }))
              }
            />
            <Label htmlFor="incluir_detalhes">Incluir detalhes dos depósitos</Label>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={isLoading || !filters.data_inicio || !filters.data_fim}>
              {isLoading ? 'Gerando...' : 'Gerar Relatório'}
            </Button>
            {data && (
              <>
                <Button variant="outline" onClick={handleClear}>
                  Limpar
                </Button>
                <Button variant="outline" onClick={exportToCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <Card>
          <CardContent className="py-6">
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Resultados */}
      {data && !isLoading && (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Total de Usuários</p>
                    <p className="text-2xl font-bold">{data.response.resumo.total_usuarios.toLocaleString('pt-BR')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">Total Depositado</p>
                    <p className="text-2xl font-bold">{formatBRL(data.response.resumo.total_depositos)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="text-sm font-medium">Quantidade Depósitos</p>
                    <p className="text-2xl font-bold">{data.response.resumo.total_quantidade_depositos.toLocaleString('pt-BR')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="text-sm font-medium">Período</p>
                    <p className="text-sm font-bold">
                      {new Date(data.response.resumo.periodo.inicio).toLocaleDateString('pt-BR')} a{' '}
                      {new Date(data.response.resumo.periodo.fim).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resumo por Whitelabel */}
          {Object.keys(data.response.resumo.por_whitelabel).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Resumo por Whitelabel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(data.response.resumo.por_whitelabel).map(([whitelabel, stats]) => (
                    <div key={whitelabel} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={whitelabel === 'EMX' ? 'default' : 'secondary'}>
                          {whitelabel}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Usuários:</span>
                          <span className="font-medium">{stats.usuarios}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total:</span>
                          <span className="font-medium">{formatBRL(stats.total_depositos)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Depósitos:</span>
                          <span className="font-medium">{stats.quantidade_depositos}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabela de Usuários */}
          <Card>
            <CardHeader>
              <CardTitle>Usuários ({data.response.usuarios.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>ID Brasil Bitcoin</TableHead>
                      <TableHead>Whitelabel</TableHead>
                      <TableHead className="text-right">Total Depositado</TableHead>
                      <TableHead className="text-right">Qtd. Depósitos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.response.usuarios.map((user) => (
                      <TableRow key={user.id_usuario}>
                        <TableCell>{user.id_usuario || 'N/A'}</TableCell>
                        <TableCell className="font-medium">{user.nome || 'Nome não informado'}</TableCell>
                        <TableCell>{user.documento || 'Documento não informado'}</TableCell>
                        <TableCell>{user.email || 'Email não informado'}</TableCell>
                        <TableCell>{user.id_brasil_bitcoin || 'Não informado'}</TableCell>
                        <TableCell>
                          <Badge variant={user.whitelabel === 'EMX' ? 'default' : 'secondary'}>
                            {user.whitelabel || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatBRL(user.total_depositado)}
                        </TableCell>
                        <TableCell className="text-right">{user.quantidade_depositos || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Metadados */}
          <Card>
            <CardHeader>
              <CardTitle>Informações do Relatório</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Data de Geração:</span>
                  <p>{new Date(data.response.metadados.data_geracao).toLocaleString('pt-BR')}</p>
                </div>
                <div>
                  <span className="font-medium">Ordenação:</span>
                  <p>{data.response.metadados.ordenacao_aplicada === 'maior_deposito' ? 'Maiores Depositadores' : 'Menores Depositadores'}</p>
                </div>
                <div>
                  <span className="font-medium">Detalhes Incluídos:</span>
                  <p>{data.response.metadados.detalhes_incluidos ? 'Sim' : 'Não'}</p>
                </div>
                <div>
                  <span className="font-medium">Registros Brutos:</span>
                  <p>{data.response.metadados.total_registros_brutos.toLocaleString('pt-BR')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}