import { useState } from "react";
import { RefreshCcw, Check, RotateCcw, Clock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { mockPendingTransactions, PendingTransaction } from "./mock";

export default function PendingTable() {
  const [transactions] = useState<PendingTransaction[]>(mockPendingTransactions);

  const handleReconsult = (transaction: PendingTransaction) => {
    console.log("Reconsultar:", transaction);
    toast.info("Reconsultando transação...");
  };

  const handleMarkResolved = (transaction: PendingTransaction) => {
    console.log("Marcar como resolvido:", transaction);
    toast.success("Transação marcada como resolvida!");
  };

  const handleRepeat = (transaction: PendingTransaction) => {
    console.log("Repetir transação:", transaction);
    toast.info("Preparando nova transação...");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PENDENTE':
        return {
          className: "bg-amber-500/20 text-amber-400 border-amber-500/30",
          icon: Clock,
          color: "text-amber-400"
        };
      case 'REJEITADO':
        return {
          className: "bg-tcr-red/20 text-tcr-red border-tcr-red/30",
          icon: AlertTriangle,
          color: "text-tcr-red"
        };
      default:
        return {
          className: "bg-muted/20 text-muted-foreground border-border",
          icon: Clock,
          color: "text-muted-foreground"
        };
    }
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'CHAVE':
        return {
          className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
          color: "text-blue-400"
        };
      case 'QR':
        return {
          className: "bg-purple-500/20 text-purple-400 border-purple-500/30",
          color: "text-purple-400"
        };
      default:
        return {
          className: "bg-muted/20 text-muted-foreground border-border",
          color: "text-muted-foreground"
        };
    }
  };

  return (
    <Card className="bg-card border border-border shadow-2xl rounded-3xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-muted/20 to-muted/30 border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg">
            <Clock className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold text-card-foreground">
              Transações Pendentes
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {transactions.filter(t => t.status === 'PENDENTE').length} aguardando processamento
            </p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/20">
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="font-semibold text-card-foreground py-4">Data/Hora</TableHead>
                <TableHead className="font-semibold text-card-foreground py-4">Valor</TableHead>
                <TableHead className="font-semibold text-card-foreground py-4">Tipo</TableHead>
                <TableHead className="font-semibold text-card-foreground py-4">Status</TableHead>
                <TableHead className="font-semibold text-card-foreground py-4">Tempo Pendente</TableHead>
                <TableHead className="font-semibold text-card-foreground py-4 text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 rounded-full bg-muted/20">
                        <Clock className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground font-medium">Nenhuma transação pendente</p>
                      <p className="text-sm text-muted-foreground">Todas as transações foram processadas</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((transaction, index) => {
                  const statusConfig = getStatusConfig(transaction.status);
                  const typeConfig = getTypeConfig(transaction.type);
                  
                  return (
                    <TableRow 
                      key={transaction.id} 
                      className="hover:bg-muted/10 transition-all duration-200 border-b border-border"
                    >
                      <TableCell className="font-medium text-card-foreground py-4">
                        {transaction.dateTime}
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="font-bold text-lg text-tcr-red font-mono">
                          -{formatCurrency(transaction.value)}
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge className={`${typeConfig.className} rounded-full px-3 py-1 font-semibold`}>
                          {transaction.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge className={`${statusConfig.className} rounded-full px-3 py-1 font-semibold flex items-center gap-1 w-fit`}>
                          <statusConfig.icon className="h-3 w-3" />
                          {transaction.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                          <span className="text-sm text-muted-foreground font-mono font-medium">
                            {transaction.pendingTime}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center justify-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleReconsult(transaction)}
                                  className="h-9 w-9 p-0 rounded-xl hover:bg-blue-500/10 hover:text-blue-400 transition-all duration-200"
                                >
                                  <RefreshCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reconsultar status</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleMarkResolved(transaction)}
                                  className="h-9 w-9 p-0 rounded-xl hover:bg-tcr-green/10 hover:text-tcr-green transition-all duration-200"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Marcar como resolvido</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRepeat(transaction)}
                                  className="h-9 w-9 p-0 rounded-xl hover:bg-tcr-orange/10 hover:text-tcr-orange transition-all duration-200"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Repetir transação</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
} 