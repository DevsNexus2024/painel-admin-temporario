import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, AlertTriangle, CheckCircle2, Loader2, Copy, RotateCcw, ArrowLeft, Info, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  listFailedWithdrawals,
  getFailedWithdrawalDetails,
  retryFailedWithdrawal,
  reverseFailedWithdrawal,
  formatCurrency,
  formatDate,
  getTenantName,
  type FailedWithdrawal,
  type FailedWithdrawalDetail,
} from "@/services/bitso-failed-withdrawals";

export default function FailedPixManagement() {
  const [withdrawals, setWithdrawals] = useState<FailedWithdrawal[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<string>("all");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<FailedWithdrawalDetail | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [retryDialogOpen, setRetryDialogOpen] = useState(false);
  const [reverseDialogOpen, setReverseDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Carregar lista ao montar
  useEffect(() => {
    loadWithdrawals();
  }, [selectedTenant]);

  // Carregar lista de PIX falhados
  const loadWithdrawals = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (selectedTenant && selectedTenant !== 'all') {
        params.tenantId = selectedTenant;
      }
      
      const response = await listFailedWithdrawals(params);
      setWithdrawals(response.failed_withdrawals || []);
    } catch (error: any) {
      toast.error('Erro ao carregar PIX falhados', {
        description: error.message || 'Não foi possível carregar a lista'
      });
    } finally {
      setLoading(false);
    }
  };

  // Abrir detalhes de um PIX
  const handleViewDetails = async (journalId: string) => {
    setLoadingDetails(true);
    setDetailDialogOpen(true);
    
    try {
      const details = await getFailedWithdrawalDetails(journalId);
      setSelectedWithdrawal(details);
    } catch (error: any) {
      toast.error('Erro ao carregar detalhes', {
        description: error.message || 'Não foi possível carregar os detalhes'
      });
      setDetailDialogOpen(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Refazer PIX
  const handleRetry = async () => {
    if (!selectedWithdrawal) return;

    setProcessing(true);
    try {
      const result = await retryFailedWithdrawal(selectedWithdrawal.journal.id);
      
      toast.success('PIX refeito com sucesso!', {
        description: `Novo Journal: #${result.new_journal_id} • Novo End-to-End: ${result.new_end_to_end_id}`
      });

      setRetryDialogOpen(false);
      setDetailDialogOpen(false);
      await loadWithdrawals();
    } catch (error: any) {
      toast.error('Erro ao refazer PIX', {
        description: error.message || 'Não foi possível refazer o PIX'
      });
    } finally {
      setProcessing(false);
    }
  };

  // Estornar PIX
  const handleReverse = async () => {
    if (!selectedWithdrawal) return;

    setProcessing(true);
    try {
      const result = await reverseFailedWithdrawal(selectedWithdrawal.journal.id);
      
      toast.success('PIX estornado com sucesso!', {
        description: `Valor de ${formatCurrency(result.amount)} devolvido para a conta`
      });

      setReverseDialogOpen(false);
      setDetailDialogOpen(false);
      await loadWithdrawals();
    } catch (error: any) {
      toast.error('Erro ao estornar PIX', {
        description: error.message || 'Não foi possível estornar o PIX'
      });
    } finally {
      setProcessing(false);
    }
  };

  // Copiar texto
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gerenciamento de PIX Falhados</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Liste, visualize detalhes, refaça ou estorne PIX que falharam no processamento
          </p>
        </div>
        <Button
          variant="outline"
          onClick={loadWithdrawals}
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label>Filtrar por Tenant</Label>
            <Select value={selectedTenant} onValueChange={setSelectedTenant}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os tenants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tenants</SelectItem>
                <SelectItem value="2">TCR Finance</SelectItem>
                <SelectItem value="3">OTC</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Lista de PIX Falhados */}
      <Card className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : withdrawals.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum PIX falhado encontrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {withdrawals.map((withdrawal) => (
              <Card
                key={withdrawal.journal_id}
                className="p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={withdrawal.is_reversed ? "secondary" : "destructive"}>
                        {withdrawal.is_reversed ? "Estornado" : "Falhado"}
                      </Badge>
                      <Badge variant="outline">
                        {getTenantName(withdrawal.tenant)}
                      </Badge>
                      {withdrawal.can_retry && (
                        <Badge variant="default" className="bg-green-600">
                          Pode Refazer
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-mono text-muted-foreground">
                        End-to-End: {withdrawal.end_to_end_id}
                      </p>
                      <p className="text-sm">
                        Journal #{withdrawal.journal_id} • {formatDate(withdrawal.created_at)}
                      </p>
                      {withdrawal.payee_name && (
                        <p className="text-sm text-muted-foreground">
                          Beneficiário: {withdrawal.payee_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right mr-4">
                    <p className="text-lg font-bold text-red-600">
                      {formatCurrency(withdrawal.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {withdrawal.currency.toUpperCase()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(withdrawal.journal_id)}
                    >
                      <Info className="h-4 w-4 mr-2" />
                      Detalhes
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* Dialog de Detalhes */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do PIX Falhado</DialogTitle>
            <DialogDescription>
              Informações completas sobre o PIX que falhou
            </DialogDescription>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : selectedWithdrawal ? (
            <div className="space-y-4">
              {/* Informações Básicas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Journal ID</Label>
                  <p className="text-sm font-mono">{selectedWithdrawal.journal.id}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">End-to-End ID</Label>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-mono break-all">{selectedWithdrawal.journal.end_to_end_id}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(selectedWithdrawal.journal.end_to_end_id, "End-to-End ID")}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Valor</Label>
                  <p className="text-lg font-bold text-red-600">
                    {formatCurrency(selectedWithdrawal.journal.metadata.amount)}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Badge variant="destructive">
                    {selectedWithdrawal.journal.metadata.withdrawal_status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Tenant</Label>
                  <p className="text-sm">{getTenantName(selectedWithdrawal.journal.tenant)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Criado em</Label>
                  <p className="text-sm">{formatDate(selectedWithdrawal.journal.created_at)}</p>
                </div>
                {selectedWithdrawal.journal.metadata.failed_at && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Falhou em</Label>
                    <p className="text-sm">{formatDate(selectedWithdrawal.journal.metadata.failed_at)}</p>
                  </div>
                )}
              </div>

              {/* QR Code ou Chave PIX */}
              {(selectedWithdrawal.journal.metadata.pix_qr_code || selectedWithdrawal.journal.metadata.pix_key) && (
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {selectedWithdrawal.journal.metadata.pix_qr_code ? "QR Code PIX" : "Chave PIX"}
                  </Label>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs font-mono break-all bg-muted p-2 rounded flex-1">
                      {selectedWithdrawal.journal.metadata.pix_qr_code || selectedWithdrawal.journal.metadata.pix_key}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(
                        selectedWithdrawal.journal.metadata.pix_qr_code || selectedWithdrawal.journal.metadata.pix_key || '',
                        "QR Code"
                      )}
                      className="h-8 w-8 p-0"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Postings */}
              {selectedWithdrawal.journal.postings && selectedWithdrawal.journal.postings.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Lançamentos Contábeis</Label>
                  <div className="space-y-2">
                    {selectedWithdrawal.journal.postings.map((posting, idx) => (
                      <div key={idx} className="bg-muted/50 p-2 rounded text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">{posting.account_purpose || posting.account_type}</span>
                          <span className={posting.side === 'PAY_IN' ? 'text-green-600' : 'text-red-600'}>
                            {posting.side === 'PAY_IN' ? '+' : '-'} {formatCurrency(posting.amount)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">Account ID: {posting.account_id}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Estorno */}
              {selectedWithdrawal.reversal && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Este PIX foi estornado em {formatDate(selectedWithdrawal.reversal.created_at)}.
                    Journal de estorno: #{selectedWithdrawal.reversal.journal_id}
                  </AlertDescription>
                </Alert>
              )}

              {/* Ações */}
              <div className="flex gap-2 pt-4 border-t">
                {selectedWithdrawal.can_retry && (
                  <Button
                    onClick={() => setRetryDialogOpen(true)}
                    className="flex-1"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Refazer PIX
                  </Button>
                )}
                {selectedWithdrawal.can_reverse && (
                  <Button
                    variant="destructive"
                    onClick={() => setReverseDialogOpen(true)}
                    className="flex-1"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Estornar Manualmente
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação - Refazer */}
      <Dialog open={retryDialogOpen} onOpenChange={setRetryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refazer PIX</DialogTitle>
            <DialogDescription>
              Uma nova transação será criada e enviada para a Bitso novamente.
            </DialogDescription>
          </DialogHeader>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Esta ação criará um novo Journal com um novo End-to-End ID. O Journal original permanecerá para auditoria.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetryDialogOpen(false)} disabled={processing}>
              Cancelar
            </Button>
            <Button onClick={handleRetry} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Confirmar Refazer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação - Estornar */}
      <Dialog open={reverseDialogOpen} onOpenChange={setReverseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Estornar PIX Manualmente</DialogTitle>
            <DialogDescription>
              O saldo será devolvido para a conta através de um Journal de ajuste.
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Atenção: Esta operação é irreversível. O saldo será devolvido imediatamente.
            </AlertDescription>
          </Alert>
          {selectedWithdrawal && (
            <div className="bg-muted/50 p-3 rounded">
              <div className="flex justify-between text-sm">
                <span>Valor a ser estornado:</span>
                <span className="font-bold">{formatCurrency(selectedWithdrawal.journal.metadata.amount)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReverseDialogOpen(false)} disabled={processing}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReverse} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Confirmar Estorno
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

