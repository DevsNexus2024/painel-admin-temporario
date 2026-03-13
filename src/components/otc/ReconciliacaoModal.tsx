import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Check,
  AlertTriangle,
  X,
  FileCheck,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { otcService } from '@/services/otc';
import {
  OTCClient,
  ReconciliacaoResponse,
  DepositoReconciliacao,
  ReconciliacaoCreditarResponse,
} from '@/types/otc';

type Step = 'step1' | 'loading' | 'step2' | 'confirming' | 'crediting' | 'result' | 'error';

interface ReconciliacaoModalProps {
  isOpen: boolean;
  onClose: (wasSuccessful?: boolean) => void;
  client: OTCClient | null;
}

const formatCurrency = (value: number) =>
  otcService.formatCurrency(value);

const truncateE2E = (str: string, max = 24) =>
  str.length > max ? `${str.slice(0, max)}...` : str;

const formatDateTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
};

export const ReconciliacaoModal: React.FC<ReconciliacaoModalProps> = ({
  isOpen,
  onClose,
  client,
}) => {
  const [step, setStep] = useState<Step>('step1');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [resultado, setResultado] = useState<ReconciliacaoResponse | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [creditarResult, setCreditarResult] = useState<ReconciliacaoCreditarResponse | null>(null);
  const [showDetalhes, setShowDetalhes] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [creditadosOpen, setCreditadosOpen] = useState(false);

  const clienteId = client?.id ?? 0;
  const clienteNome = client?.name ?? '';

  const resetState = () => {
    setStep('step1');
    setDataInicio('');
    setDataFim('');
    setError(null);
    setResultado(null);
    setSelecionados(new Set());
    setCreditarResult(null);
    setShowDetalhes(false);
    setExpandedRow(null);
    setCreditadosOpen(false);
  };

  useEffect(() => {
    if (isOpen) {
      resetState();
      const hoje = new Date();
      const seteDiasAtras = new Date(hoje);
      seteDiasAtras.setDate(hoje.getDate() - 7);
      setDataFim(hoje.toISOString().split('T')[0]);
      setDataInicio(seteDiasAtras.toISOString().split('T')[0]);
    }
  }, [isOpen, clienteId]);

  const handleClose = (wasSuccessful?: boolean) => {
    resetState();
    onClose(wasSuccessful);
  };

  const validatePeriod = (): string | null => {
    if (!dataInicio || !dataFim) return 'Preencha as datas de início e fim.';
    const d1 = new Date(dataInicio);
    const d2 = new Date(dataFim);
    if (d1 > d2) return 'Data início deve ser menor ou igual à data fim.';
    return null;
  };

  const handleVerificar = async () => {
    const err = validatePeriod();
    if (err) {
      setError({ message: err });
      return;
    }
    setError(null);
    setStep('loading');

    try {
      const res = await otcService.getReconciliacao(clienteId, dataInicio, dataFim);
      setResultado(res);
      const defaultSelected = new Set(res.nao_creditados.map((d) => d.endToEnd));
      setSelecionados(defaultSelected);
      setStep('step2');
    } catch (e: any) {
      const status = e?.response?.status;
      const data = e?.response?.data ?? {};
      if (status === 422 && data.error === 'ESTRATEGIA_NAO_DISPONIVEL') {
        setError({
          message:
            'Reconciliação BelmontX ainda não implementada. Use a exportação CSV do provider.',
          code: 'ESTRATEGIA_NAO_DISPONIVEL',
        });
      } else if (status === 403) {
        setError({ message: 'Sem permissão para reconciliar.' });
      } else if (status === 400) {
        setError({ message: data?.message || 'Datas inválidas.' });
      } else if (e?.name === 'AbortError' || e?.message?.includes('timeout')) {
        setError({ message: 'A consulta demorou muito. Tente um período menor.' });
      } else {
        setError({
          message: data?.message || 'Erro ao consultar reconciliação. Tente novamente.',
        });
      }
      setStep('error');
    }
  };

  const handleToggleDeposito = (endToEnd: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(endToEnd)) next.delete(endToEnd);
      else next.add(endToEnd);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!resultado) return;
    const all = new Set(resultado.nao_creditados.map((d) => d.endToEnd));
    setSelecionados(all);
  };

  const handleCreditar = () => {
    setStep('confirming');
  };

  const handleConfirmarCredito = async () => {
    if (!resultado) return;
    const toCredit = resultado.nao_creditados.filter((d) => selecionados.has(d.endToEnd));
    if (toCredit.length === 0) return;

    setStep('crediting');

    try {
      const res = await otcService.creditarDepositos(clienteId, toCredit);
      setCreditarResult(res);
      setStep('result');
    } catch (e: any) {
      const data = e?.response?.data ?? {};
      setError({
        message: data?.message || 'Erro ao creditar. Tente novamente.',
      });
      setStep('error');
    }
  };

  const totalSelecionado = resultado
    ? resultado.nao_creditados
        .filter((d) => selecionados.has(d.endToEnd))
        .reduce((s, d) => s + d.valor, 0)
    : 0;

  const estrategiaLabel = resultado?.cliente
    ? resultado.cliente.estrategia === 'account_id'
      ? `Por Account ID (accountId=${resultado.cliente.account_id ?? '—'})`
      : `Por PIX Key (${resultado.cliente.pix_key})`
    : '—';

  if (!client) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Step 1 */}
        {step === 'step1' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Reconciliar depósitos — {clienteNome}
              </DialogTitle>
              <DialogDescription>
                Cliente: {clienteNome} · Selecione o período para consultar depósitos no banco externo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error.message}</AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dataInicio">Data início</Label>
                  <Input
                    id="dataInicio"
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="dataFim">Data fim</Label>
                  <Input
                    id="dataFim"
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => handleClose()}>
                  Cancelar
                </Button>
                <Button onClick={handleVerificar}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Verificar
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Loading */}
        {step === 'loading' && (
          <div className="py-12 flex flex-col items-center justify-center gap-4">
            <RefreshCw className="h-12 w-12 animate-spin text-primary" />
            <p className="font-medium">Consultando banco externo...</p>
            <p className="text-sm text-muted-foreground">
              Buscando transações. Isso pode levar alguns segundos.
            </p>
          </div>
        )}

        {/* Step 2 */}
        {step === 'step2' && resultado && (
          <>
            <DialogHeader>
              <DialogTitle>Reconciliação — {clienteNome}</DialogTitle>
              <DialogDescription>
                Período: {dataInicio} a {dataFim} · {estrategiaLabel}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>End-to-End</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Pagador</TableHead>
                      <TableHead>Provedor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultado.nao_creditados.map((d) => (
                      <React.Fragment key={d.endToEnd}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpandedRow(expandedRow === d.endToEnd ? null : d.endToEnd)}
                        >
                          <TableCell className="w-8" onClick={(e) => e.stopPropagation()}>
                            {expandedRow === d.endToEnd ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selecionados.has(d.endToEnd)}
                              onCheckedChange={() => handleToggleDeposito(d.endToEnd)}
                              aria-label={`Selecionar ${d.endToEnd}`}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {truncateE2E(d.endToEnd)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(d.valor)}
                          </TableCell>
                          <TableCell>{d.pagadorNome || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs font-normal">
                              {d.provedor || '—'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-amber-600 text-sm">⚠ Não cred.</span>
                          </TableCell>
                        </TableRow>
                        {expandedRow === d.endToEnd && (
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={7} className="p-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div>
                                  <span className="text-muted-foreground">End-to-End:</span>
                                  <p className="font-mono text-xs break-all">{d.endToEnd}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Valor:</span>
                                  <p className="font-medium">{formatCurrency(d.valor)}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Data/Hora:</span>
                                  <p>{formatDateTime(d.dataHora)}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Provedor:</span>
                                  <p>{d.provedor || '—'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Pagador:</span>
                                  <p>{d.pagadorNome || '—'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Documento:</span>
                                  <p className="font-mono">{d.pagadorDocumento || '—'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Banco:</span>
                                  <p>{d.pagadorBanco || '—'}</p>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Creditados: collapsible */}
              {resultado.creditados.length > 0 && (
                <Collapsible open={creditadosOpen} onOpenChange={setCreditadosOpen} className="mt-4">
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-between">
                      <span>
                        Ver {resultado.creditados.length} depósito(s) já creditado(s)
                      </span>
                      {creditadosOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="rounded-md border overflow-x-auto mt-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8"></TableHead>
                            <TableHead>End-to-End</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead>Pagador</TableHead>
                            <TableHead>Provedor</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {resultado.creditados.map((d) => (
                            <React.Fragment key={d.endToEnd}>
                              <TableRow
                                className="cursor-pointer hover:bg-muted/50 opacity-90 bg-muted/20"
                                onClick={() =>
                                  setExpandedRow(expandedRow === d.endToEnd ? null : d.endToEnd)
                                }
                              >
                                <TableCell className="w-8">
                                  {expandedRow === d.endToEnd ? (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {truncateE2E(d.endToEnd)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(d.valor)}
                                </TableCell>
                                <TableCell>{d.pagadorNome || '—'}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs font-normal">
                                    {d.provedor || '—'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="text-green-600 text-sm">✅ Já cred.</span>
                                </TableCell>
                              </TableRow>
                              {expandedRow === d.endToEnd && (
                                <TableRow className="bg-muted/20">
                                  <TableCell colSpan={6} className="p-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                      <div>
                                        <span className="text-muted-foreground">End-to-End:</span>
                                        <p className="font-mono text-xs break-all">{d.endToEnd}</p>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Valor:</span>
                                        <p className="font-medium">{formatCurrency(d.valor)}</p>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Data/Hora:</span>
                                        <p>{formatDateTime(d.dataHora)}</p>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Provedor:</span>
                                        <p>{d.provedor || '—'}</p>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Pagador:</span>
                                        <p>{d.pagadorNome || '—'}</p>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Documento:</span>
                                        <p className="font-mono">{d.pagadorDocumento || '—'}</p>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Banco:</span>
                                        <p>{d.pagadorBanco || '—'}</p>
                                      </div>
                                      {d.credito_info && (
                                        <>
                                          <div>
                                            <span className="text-muted-foreground">Tipo crédito:</span>
                                            <p>{d.credito_info.tipo || '—'}</p>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground">Transaction ID:</span>
                                            <p className="font-mono">{d.credito_info.transaction_id}</p>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground">Creditado em:</span>
                                            <p>{formatDateTime(d.credito_info.created_at)}</p>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  Não creditados: {resultado.resumo.nao_creditados} · Total selecionado:{' '}
                  {formatCurrency(totalSelecionado)}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    Selecionar todos
                  </Button>
                  <Button
                    onClick={handleCreditar}
                    disabled={selecionados.size === 0}
                  >
                    Creditar Selecionados ({selecionados.size})
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Confirming */}
        {step === 'confirming' && (
          <div className="py-6 space-y-4">
            <h3 className="font-semibold text-lg">Confirmar crédito</h3>
            <p>
              Cliente: {clienteNome} · {selecionados.size} depósitos ·{' '}
              {formatCurrency(totalSelecionado)}
            </p>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Esta ação não pode ser desfeita.</AlertDescription>
            </Alert>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('step2')}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmarCredito}>Confirmar crédito</Button>
            </div>
          </div>
        )}

        {/* Crediting */}
        {step === 'crediting' && (
          <div className="py-12 flex flex-col items-center justify-center gap-4">
            <RefreshCw className="h-12 w-12 animate-spin text-primary" />
            <p className="font-medium">Creditando depósitos...</p>
          </div>
        )}

        {/* Result */}
        {step === 'result' && creditarResult && (
          <div className="py-6 space-y-4">
            {creditarResult.failed === 0 && creditarResult.duplicates === 0 ? (
              <>
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="h-6 w-6" />
                  <span className="font-semibold">
                    {creditarResult.success} creditados · {formatCurrency(creditarResult.total_creditado)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  0 falhas · 0 duplicatas ignoradas
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-6 w-6" />
                  <span className="font-semibold">
                    {creditarResult.success} creditados · {creditarResult.failed} falhas ·{' '}
                    {creditarResult.duplicates} duplicatas
                  </span>
                </div>
                <p className="text-sm">
                  Total creditado: {formatCurrency(creditarResult.total_creditado)}
                </p>
                {creditarResult.detalhes?.length > 0 && (
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDetalhes(!showDetalhes)}
                    >
                      {showDetalhes ? 'Ocultar detalhes' : 'Ver detalhes'}
                    </Button>
                    {showDetalhes && (
                      <div className="mt-2 rounded border p-3 text-sm max-h-40 overflow-y-auto">
                        {creditarResult.detalhes.map((d, i) => (
                          <div key={i} className="flex justify-between gap-2 py-1">
                            <span className="font-mono text-xs">{d.reference_code}</span>
                            <span
                              className={
                                d.status === 'success'
                                  ? 'text-green-600'
                                  : d.status === 'duplicate'
                                  ? 'text-amber-600'
                                  : 'text-red-600'
                              }
                            >
                              {d.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            <div className="flex justify-end">
              <Button onClick={() => handleClose(true)}>Fechar</Button>
            </div>
          </div>
        )}

        {/* Error */}
        {step === 'error' && error && (
          <div className="py-6 space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <X className="h-6 w-6" />
              <span className="font-semibold">Erro</span>
            </div>
            <p>{error.message}</p>
            <div className="flex justify-end">
              <Button onClick={() => handleClose()}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ReconciliacaoModal;
