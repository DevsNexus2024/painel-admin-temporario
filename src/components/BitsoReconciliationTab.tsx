import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RefreshCw, AlertTriangle, CheckCircle2, Loader2, Copy, ArrowRightLeft, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  searchDeposit,
  listUnreconciled,
  reconcileDeposit,
  formatCurrency,
  formatDate,
  getTenantName,
  type BitsoReconciliationTransaction,
  type BitsoUnreconciledTransaction,
} from "@/services/bitso-reconciliation";

export default function BitsoReconciliationTab() {
  const [searchValue, setSearchValue] = useState("");
  const [searchResult, setSearchResult] = useState<BitsoReconciliationTransaction | null>(null);
  const [unreconciledList, setUnreconciledList] = useState<BitsoUnreconciledTransaction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingUnreconciled, setIsLoadingUnreconciled] = useState(false);
  const [reconciliationDialogOpen, setReconciliationDialogOpen] = useState(false);
  const [reconciliationId, setReconciliationId] = useState("");
  const [correctTenantId, setCorrectTenantId] = useState<2 | 3>(2);
  const [forceReconciliation, setForceReconciliation] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);

  // Carregar lista de não reconciliados ao montar
  useEffect(() => {
    loadUnreconciled();
  }, []);

  // Buscar depósito por endToEndId
  const handleSearch = async () => {
    if (!searchValue.trim()) {
      toast.error('Digite um End-to-End ID para buscar');
      return;
    }

    setIsSearching(true);
    setSearchResult(null);

    try {
      const result = await searchDeposit(searchValue.trim());
      setSearchResult(result);
      toast.success('Depósito encontrado!');
    } catch (error: any) {
      toast.error('Erro ao buscar depósito', {
        description: error.message || 'Não foi possível encontrar o depósito'
      });
      setSearchResult(null);
    } finally {
      setIsSearching(false);
    }
  };

  // Carregar lista de não reconciliados
  const loadUnreconciled = async () => {
    setIsLoadingUnreconciled(true);
    try {
      const list = await listUnreconciled(50);
      setUnreconciledList(list);
    } catch (error: any) {
      toast.error('Erro ao carregar lista', {
        description: error.message || 'Não foi possível carregar os depósitos não reconciliados'
      });
    } finally {
      setIsLoadingUnreconciled(false);
    }
  };

  // Abrir dialog de reconciliação
  const handleOpenReconciliation = (transaction: BitsoReconciliationTransaction | BitsoUnreconciledTransaction) => {
    const alreadyReconciled = 'reconciliationId' in transaction && transaction.reconciliationId;
    
    // Se já foi reconciliado, permitir abrir dialog com force habilitado como opção
    setReconciliationDialogOpen(true);
    setReconciliationId(transaction.payerDocument || "");
    setCorrectTenantId(transaction.currentTenant === 'otc' ? 2 : 3); // Inverter tenant
    setForceReconciliation(false); // Reset force ao abrir
  };

  // Executar reconciliação
  const handleReconcile = async () => {
    if (!searchResult || !reconciliationId.trim()) {
      toast.error('Dados incompletos para reconciliação');
      return;
    }

    // Se já foi reconciliado e não está usando force, mostrar erro
    if (searchResult.reconciliationId && !forceReconciliation) {
      toast.error('Este depósito já foi reconciliado', {
        description: 'Use "Forçar Reconciliação" se precisar sobrescrever'
      });
      return;
    }

    if (searchResult.currentTenant === (correctTenantId === 2 ? 'tcr' : 'otc')) {
      toast.error('O depósito já está no tenant correto');
      return;
    }

    setIsReconciling(true);

    try {
      const result = await reconcileDeposit({
        endToEndId: searchResult.endToEndId,
        reconciliationId: reconciliationId.trim(),
        correctTenantId,
        force: forceReconciliation || undefined, // Enviar apenas se true
      });

      toast.success('Reconciliação realizada com sucesso!', {
        description: result.message
      });

      // Atualizar resultado da busca
      const updatedResult = await searchDeposit(searchResult.endToEndId);
      setSearchResult(updatedResult);

      // Recarregar lista de não reconciliados
      await loadUnreconciled();

      setReconciliationDialogOpen(false);
      setReconciliationId("");
    } catch (error: any) {
      toast.error('Erro ao reconciliar', {
        description: error.message || 'Não foi possível realizar a reconciliação'
      });
    } finally {
      setIsReconciling(false);
    }
  };

  // Copiar endToEndId
  const handleCopyEndToEnd = (endToEndId: string) => {
    navigator.clipboard.writeText(endToEndId);
    toast.success('End-to-End ID copiado!');
  };

  return (
    <div className="space-y-6">
      {/* Card de Busca */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Buscar Depósito por End-to-End ID</h3>
            <p className="text-sm text-muted-foreground">
              Digite o End-to-End ID do depósito para visualizar detalhes e realizar reconciliação
            </p>
          </div>
          
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="E3674167520251103092729529669902"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="font-mono"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={isSearching || !searchValue.trim()}
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Resultado da Busca */}
      {searchResult && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Detalhes do Depósito</h3>
              <Badge variant={searchResult.reconciliationId ? "default" : "secondary"}>
                {searchResult.reconciliationId ? "Reconciliado" : "Não Reconciliado"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">End-to-End ID</Label>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm font-mono break-all">{searchResult.endToEndId}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyEndToEnd(searchResult.endToEndId)}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Transaction ID</Label>
                <p className="text-sm font-mono">{searchResult.transactionId}</p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Valor</Label>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(searchResult.amount)}
                </p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Badge variant={searchResult.status === 'COMPLETE' ? "default" : "secondary"}>
                  {searchResult.status}
                </Badge>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Tenant Atual</Label>
                <Badge variant={searchResult.currentTenant === 'otc' ? "default" : "secondary"}>
                  {getTenantName(searchResult.currentTenant)}
                </Badge>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Data</Label>
                <p className="text-sm">{formatDate(searchResult.createdAt)}</p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Pagador</Label>
                <p className="text-sm font-medium">{searchResult.payerName}</p>
                <p className="text-xs text-muted-foreground font-mono">{searchResult.payerDocument}</p>
              </div>

              {searchResult.reconciliationId && (
                <div>
                  <Label className="text-xs text-muted-foreground">Reconciliation ID</Label>
                  <p className="text-sm font-mono">{searchResult.reconciliationId}</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t">
              <Button
                onClick={() => handleOpenReconciliation(searchResult)}
                className="w-full"
                variant={searchResult.reconciliationId ? "outline" : "default"}
              >
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                {searchResult.reconciliationId ? "Reconciliar Novamente (Forçar)" : "Reconciliar Depósito"}
              </Button>
              {searchResult.reconciliationId && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Este depósito já foi reconciliado. Use o botão acima para forçar uma nova reconciliação.
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Lista de Não Reconciliados */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-2">Depósitos Não Reconciliados</h3>
              <p className="text-sm text-muted-foreground">
                Lista de depósitos que ainda não foram reconciliados (sem reconciliation_id)
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadUnreconciled}
              disabled={isLoadingUnreconciled}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoadingUnreconciled && "animate-spin")} />
              Atualizar
            </Button>
          </div>

          {isLoadingUnreconciled ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : unreconciledList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum depósito não reconciliado encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {unreconciledList.map((item) => (
                <Card
                  key={item.endToEndId}
                  className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSearchValue(item.endToEndId);
                    handleSearch();
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-mono">{item.endToEndId.substring(0, 32)}...</p>
                        <Badge variant={item.currentTenant === 'otc' ? "default" : "secondary"}>
                          {getTenantName(item.currentTenant)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {item.payerName} • {formatDate(item.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(item.amount)}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSearchValue(item.endToEndId);
                          handleSearch();
                        }}
                        className="mt-1"
                      >
                        Ver Detalhes
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Dialog de Reconciliação */}
      <Dialog open={reconciliationDialogOpen} onOpenChange={setReconciliationDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Reconciliar Depósito
            </DialogTitle>
            <DialogDescription>
              Esta ação irá estornar o depósito do tenant atual e creditá-lo no tenant correto.
            </DialogDescription>
          </DialogHeader>

          {searchResult && (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Atenção:</strong> Esta operação é irreversível e requer permissão SUPER_ADMIN.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>End-to-End ID</Label>
                <p className="text-sm font-mono bg-muted p-2 rounded">{searchResult.endToEndId}</p>
              </div>

              <div className="space-y-2">
                <Label>Tenant Atual</Label>
                <Badge variant={searchResult.currentTenant === 'otc' ? "default" : "secondary"}>
                  {getTenantName(searchResult.currentTenant)}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label>Tenant de Destino *</Label>
                <Select
                  value={correctTenantId.toString()}
                  onValueChange={(value) => setCorrectTenantId(parseInt(value) as 2 | 3)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">TCR</SelectItem>
                    <SelectItem value="3">OTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Reconciliation ID (CPF/CNPJ ou UUID) *</Label>
                <Input
                  placeholder="14283885000198"
                  value={reconciliationId}
                  onChange={(e) => setReconciliationId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  CPF/CNPJ do pagador ou UUID de identificação
                </p>
              </div>

              <div className="bg-muted/50 p-3 rounded">
                <div className="flex items-center justify-between text-sm">
                  <span>Valor:</span>
                  <span className="font-bold text-green-600">
                    {formatCurrency(searchResult.amount)}
                  </span>
                </div>
              </div>

              {/* Opção de Forçar Reconciliação */}
              {searchResult.reconciliationId && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p>
                        <strong>Este depósito já foi reconciliado</strong> com o ID: <code className="text-xs">{searchResult.reconciliationId}</code>
                      </p>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="force-reconciliation"
                          checked={forceReconciliation}
                          onCheckedChange={(checked) => setForceReconciliation(checked as boolean)}
                        />
                        <label
                          htmlFor="force-reconciliation"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          Forçar Reconciliação (sobrescrever ID existente)
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ⚠️ Use apenas se tiver certeza absoluta. Isso sobrescreverá o reconciliation_id anterior e criará um novo Journal.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReconciliationDialogOpen(false);
                setReconciliationId("");
                setForceReconciliation(false);
              }}
              disabled={isReconciling}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleReconcile}
              disabled={isReconciling || !reconciliationId.trim()}
            >
              {isReconciling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reconciliando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirmar Reconciliação
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

