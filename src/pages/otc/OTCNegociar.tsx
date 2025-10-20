import React, { useState } from 'react';
import { TrendingUp, ArrowUpDown, ChevronDown, Search, Edit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Transaction {
  id: string;
  type: 'Compra' | 'Venda';
  currency: string;
  quote: number;
  quantity: number;
  total: number;
  date: string;
  status: 'Executada' | 'Pendente' | 'Cancelada';
  note?: string;
}

// Dados mockados para demonstração
const mockTransactions: Transaction[] = [
  {
    id: 'O188150',
    type: 'Compra',
    currency: 'USDT',
    quote: 5.4780,
    quantity: 11801.00000000,
    total: 64645.88,
    date: '15/10/2025 17:01:47',
    status: 'Executada',
  },
  {
    id: 'O188146',
    type: 'Compra',
    currency: 'USDT',
    quote: 5.4746,
    quantity: 10000.00000000,
    total: 54746.00,
    date: '15/10/2025 16:48:06',
    status: 'Executada',
    note: 'SMAILY',
  },
  {
    id: 'O188141',
    type: 'Compra',
    currency: 'USDT',
    quote: 5.4734,
    quantity: 100000.00000000,
    total: 547340.00,
    date: '15/10/2025 16:36:30',
    status: 'Executada',
    note: 'TRKBIT',
  },
  {
    id: 'O188132',
    type: 'Compra',
    currency: 'USDT',
    quote: 5.4705,
    quantity: 3368.00000000,
    total: 18424.64,
    date: '15/10/2025 16:18:38',
    status: 'Executada',
    note: 'RSM',
  },
  {
    id: 'O188128',
    type: 'Compra',
    currency: 'USDT',
    quote: 5.4707,
    quantity: 21945.00000000,
    total: 120054.51,
    date: '15/10/2025 16:15:44',
    status: 'Executada',
    note: 'NEWPAY',
  },
];

const OTCNegociar: React.FC = () => {
  const [operationType, setOperationType] = useState<'buy' | 'sell'>('buy');
  const [selectedCurrency, setSelectedCurrency] = useState('USDT/BRL');
  const [liquidationType, setLiquidationType] = useState('D0');
  const [quantity, setQuantity] = useState('1000');
  const [total, setTotal] = useState('5,475.80');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Valores mockados
  const availableBalance = 'R$5.874.407,41';
  const availableBalanceUSDT = '102196.99236806 USDT';
  const credit = 'R$6.000.000,00';
  const creditUSDT = '0.00000000 USDT';
  const currentQuote = 'R$ 5,4758';
  const quoteQuantity = '1000.00000000';
  const quoteTotal = '5.475,80';

  const handleSolicitarCotacao = () => {
    console.log('Solicitar cotação:', {
      type: operationType,
      currency: selectedCurrency,
      liquidation: liquidationType,
      quantity,
    });
  };

  const handleSolicitarNovaCotacao = () => {
    console.log('Solicitar nova cotação');
  };

  const handleMaxAmount = () => {
    // Lógica para calcular o valor máximo baseado no saldo disponível
    setTotal('5874407.41');
    setQuantity('1073046.29');
  };

  const getStatusBadge = (status: Transaction['status']) => {
    const variants = {
      Executada: 'bg-green-500/10 text-green-500 hover:bg-green-500/20',
      Pendente: 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20',
      Cancelada: 'bg-red-500/10 text-red-500 hover:bg-red-500/20',
    };

    return (
      <Badge className={variants[status]} variant="outline">
        {status}
      </Badge>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-primary" />
            OTC - Negociar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              17:11:57 - Off Market
            </span>
          </p>
        </div>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Coluna Esquerda - Área de Negociação */}
        <div className="flex flex-col gap-6">
          {/* Cards de Saldo e Crédito */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground font-medium">
                  Saldo disponível
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-foreground">
                    {availableBalance}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {availableBalanceUSDT}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground font-medium">
                  Crédito
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-foreground">{credit}</p>
                  <p className="text-xs text-muted-foreground">{creditUSDT}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Card de Negociação */}
          <Card className="hover:shadow-lg transition-shadow flex-1 flex flex-col">
            <CardContent className="pt-6 flex-1 flex flex-col gap-5">
              {/* Seleção de Moeda */}
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-3 block">
                  Moeda selecionada
                </label>
                <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                  <SelectTrigger className="w-full bg-muted/50 h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDT/BRL">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-green-500">₮</span>
                        </div>
                        USDT/BRL
                      </div>
                    </SelectItem>
                    <SelectItem value="BTC/BRL">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-orange-500">₿</span>
                        </div>
                        BTC/BRL
                      </div>
                    </SelectItem>
                    <SelectItem value="ETH/BRL">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-blue-500">Ξ</span>
                        </div>
                        ETH/BRL
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Liquidação */}
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-3 block">
                  Liquidação
                </label>
                <div className="flex gap-3">
                  <Button
                    variant={liquidationType === 'D0' ? 'default' : 'outline'}
                    onClick={() => setLiquidationType('D0')}
                    className="flex-1 h-12 text-base"
                  >
                    D0
                  </Button>
                  <Button
                    variant={liquidationType === 'D1' ? 'default' : 'outline'}
                    onClick={() => setLiquidationType('D1')}
                    className="flex-1 h-12 text-base"
                    disabled
                  >
                    D1
                  </Button>
                  <Button
                    variant={liquidationType === 'D2' ? 'default' : 'outline'}
                    onClick={() => setLiquidationType('D2')}
                    className="flex-1 h-12 text-base"
                    disabled
                  >
                    D2
                  </Button>
                </div>
              </div>

              {/* Botões Comprar/Vender */}
              <div className="grid grid-cols-2 gap-4 flex-1">
                <Button
                  size="lg"
                  className={`h-14 text-lg font-semibold ${
                    operationType === 'buy'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
                  onClick={() => setOperationType('buy')}
                >
                  Comprar
                </Button>
                <Button
                  size="lg"
                  className={`h-14 text-lg font-semibold ${
                    operationType === 'sell'
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
                  onClick={() => setOperationType('sell')}
                >
                  Vender
                </Button>
              </div>

              {/* Quantidade */}
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-3 block">
                  Quantidade (USDT)
                </label>
                <Input
                  type="text"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="bg-muted/50 text-xl h-14"
                />
              </div>

              {/* Total */}
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-3 block">
                  Total (BRL)
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    value={total}
                    onChange={(e) => setTotal(e.target.value)}
                    className="bg-muted/50 text-xl h-14 pr-20"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleMaxAmount}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-600 h-10 px-4 text-base font-semibold"
                  >
                    MAX
                  </Button>
                </div>
              </div>

              {/* Botão Solicitar Cotação */}
              <div className="pt-2">
                <Button
                  size="lg"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-xl font-semibold h-16"
                  onClick={handleSolicitarCotacao}
                >
                  Solicitar cotação
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita - Cotação Atual e Saque */}
        <div className="space-y-6">
          <Card className="hover:shadow-lg transition-shadow sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center justify-between">
                Cotação para Comprar
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-4">
                <div className="p-6 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="text-3xl font-bold text-primary">{currentQuote}</p>
                  <p className="text-sm text-muted-foreground mt-1">Cotação Atual</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-left">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Quantidade(USDT)</p>
                    <p className="font-mono text-sm font-medium">{quoteQuantity}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Total (BRL)</p>
                    <p className="font-mono text-sm font-medium">{quoteTotal}</p>
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleSolicitarNovaCotacao}
              >
                Solicite nova cotação
              </Button>
            </CardContent>
          </Card>

          {/* Card de Saque para Wallets */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center justify-between">
                Saque para Wallets
                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <span className="text-orange-500 text-xs">₿</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Seleção de Moeda */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">
                  Moeda
                </label>
                <Select defaultValue="USDT">
                  <SelectTrigger className="w-full bg-muted/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDT">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-green-500">₮</span>
                        </div>
                        USDT
                      </div>
                    </SelectItem>
                    <SelectItem value="BTC">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-orange-500/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-orange-500">₿</span>
                        </div>
                        BTC
                      </div>
                    </SelectItem>
                    <SelectItem value="ETH">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-blue-500">Ξ</span>
                        </div>
                        ETH
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Endereço da Wallet */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">
                  Endereço da Wallet
                </label>
                <Input
                  type="text"
                  placeholder="0x..."
                  className="bg-muted/50 font-mono text-sm"
                />
              </div>

              {/* Rede */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">
                  Rede
                </label>
                <Select defaultValue="TRC20">
                  <SelectTrigger className="w-full bg-muted/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRC20">TRC20 (Tron)</SelectItem>
                    <SelectItem value="ERC20">ERC20 (Ethereum)</SelectItem>
                    <SelectItem value="BEP20">BEP20 (BSC)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Valor */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">
                  Valor
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="0.00"
                    className="bg-muted/50 text-base pr-16"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-600"
                  >
                    MAX
                  </Button>
                </div>
              </div>

              {/* Info de Taxa */}
              <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Taxa de rede</span>
                  <span className="font-medium">0.0001 USDT</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Você receberá</span>
                  <span className="font-semibold text-foreground">0.0000 USDT</span>
                </div>
              </div>

              {/* Botão de Saque */}
              <Button
                size="lg"
                className="w-full bg-orange-600 hover:bg-orange-700 text-base font-semibold"
              >
                Solicitar Saque
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Histórico de Transações */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-xl font-semibold">Histórico</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted/50"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">ID</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Moeda</TableHead>
                  <TableHead className="text-right">Cotação</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Anotação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockTransactions.map((transaction) => (
                  <TableRow key={transaction.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium text-primary">
                      #{transaction.id}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          transaction.type === 'Compra'
                            ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                            : 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                        }
                      >
                        {transaction.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{transaction.currency}</TableCell>
                    <TableCell className="text-right font-mono">
                      R${transaction.quote.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {transaction.quantity.toLocaleString('pt-BR', {
                        minimumFractionDigits: 8,
                        maximumFractionDigits: 8,
                      })}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      R${transaction.total.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {transaction.date}
                    </TableCell>
                    <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                    <TableCell className="text-center">
                      {transaction.note ? (
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-sm font-medium">{transaction.note}</span>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            {[1, 2, 3, 4, 5].map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentPage(page)}
                className="w-8"
              >
                {page}
              </Button>
            ))}
            <span className="text-sm text-muted-foreground">...</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(11)}
              className="w-8"
            >
              11
            </Button>
            <Button variant="outline" size="sm">
              »
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(11, currentPage + 1))}
              disabled={currentPage === 11}
            >
              Próxima
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OTCNegociar;

