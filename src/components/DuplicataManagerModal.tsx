/**
 * 🔄 Modal para Gerenciar Duplicatas de Movimentações
 * 
 * Componente responsável por:
 * - Buscar duplicatas para uma transação específica
 * - Exibir lista de duplicatas encontradas
 * - Permitir exclusão individual de duplicatas
 * - Feedback visual para ações realizadas
 */

import React, { useState, useEffect } from "react";
import { 
  X, 
  Search, 
  Trash2, 
  AlertTriangle, 
  Clock, 
  DollarSign, 
  Hash,
  CheckCircle,
  Loader2,
  Info
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  buscarDuplicatas, 
  excluirMovimentacao, 
  formatarDuplicataParaUI,
  type DuplicataItem,
  type DuplicataBuscarRequest
} from "@/services/duplicatas";

// ============================== INTERFACES ==============================

interface DuplicataManagerModalProps {
  /** Se o modal está visível */
  isOpen: boolean;
  /** Função para fechar o modal */
  onClose: () => void;
  /** Dados da transação selecionada */
  transacao: {
    id: string;
    value: number;
    client?: string;
    dateTime: string;
    type: 'DÉBITO' | 'CRÉDITO';
  };
  /** ID do usuário para busca */
  idUsuario: number;
  /** Callback opcional após exclusão bem-sucedida */
  onDuplicataExcluida?: (idMovimentacao: number) => void;
  /** ✅ NOVO: Todas as transações do extrato para análise contextual */
  todasTransacoes?: Array<{
    id: string;
    value: number;
    type: 'DÉBITO' | 'CRÉDITO';
    dateTime: string;
    descCliente?: string;
  }>;
}

// ============================== COMPONENTE PRINCIPAL ==============================

export default function DuplicataManagerModal({
  isOpen,
  onClose,
  transacao,
  idUsuario,
  onDuplicataExcluida,
  todasTransacoes = []
}: DuplicataManagerModalProps) {
  
  // ===== ESTADOS =====
  const [duplicatas, setDuplicatas] = useState<DuplicataItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExcluindo, setIsExcluindo] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para análise contextual removidos

  // ===== BUSCAR DUPLICATAS =====
  const handleBuscarDuplicatas = async () => {
    if (!transacao || !idUsuario) return;

    setIsLoading(true);
    setError(null);
    setDuplicatas([]);

    try {
      const request: DuplicataBuscarRequest = {
        id_usuario: idUsuario,
        quantia: Math.abs(transacao.value)
      };

      console.log('[DUPLICATA-MODAL] Buscando duplicatas:', request);

      const response = await buscarDuplicatas(request);
      
      setDuplicatas(response.dados || []);
      
      // ✅ NOVO: Calcular informações contextuais CORRETAS baseadas no extrato atual
      const dataTransacao = new Date(transacao.dateTime).toLocaleDateString('pt-BR');
      const valorTransacao = Math.abs(transacao.value);
      
      // 🎯 Extrair ID do usuário da transação atual para fazer contagem correta
      const extrairIdUsuario = (descCliente: string): number => {
        const match = descCliente?.match(/Usuario\s+(\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
      };
      
      // Lógica de análise contextual removida conforme solicitado
      
      if (response.dados?.length === 0) {
        toast.info('Nenhuma duplicata encontrada para esta transação');
      } else {
        toast.success(`${response.dados.length} duplicata(s) encontrada(s)`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error('[DUPLICATA-MODAL] Erro ao buscar:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ===== EXCLUIR DUPLICATA =====
  const handleExcluirDuplicata = async (duplicata: DuplicataItem) => {
    // Confirmação de segurança
    const confirmacao = window.confirm(
      `⚠️ Tem certeza que deseja excluir esta movimentação?\n\n` +
      `ID: ${duplicata.id}\n` +
      `Valor: ${formatarDuplicataParaUI(duplicata).quantiaFormatada}\n` +
      `Data: ${formatarDuplicataParaUI(duplicata).dataFormatada}\n\n` +
      `Esta ação não pode ser desfeita!`
    );

    if (!confirmacao) return;

    setIsExcluindo(duplicata.id);

    try {
      console.log('[DUPLICATA-MODAL] Excluindo duplicata:', duplicata.id);

      await excluirMovimentacao(duplicata.id);
      
      // Remover da lista local
      setDuplicatas(prev => prev.filter(item => item.id !== duplicata.id));
      
      // Callback opcional
      onDuplicataExcluida?.(duplicata.id);
      
      toast.success(`Movimentação ${duplicata.id} excluída com sucesso!`);

    } catch (error) {
      console.error('[DUPLICATA-MODAL] Erro ao excluir:', error);
      // Toast já é mostrado pelo serviço
    } finally {
      setIsExcluindo(null);
    }
  };

  // ===== BUSCAR AUTOMATICAMENTE QUANDO ABRIR =====
  useEffect(() => {
    if (isOpen && transacao && idUsuario) {
      handleBuscarDuplicatas();
    }
  }, [isOpen, transacao?.id, idUsuario]);

  // ===== FECHAR E LIMPAR =====
  const handleClose = () => {
    setDuplicatas([]);
    setError(null);
    setIsExcluindo(null);
    onClose();
  };

  // Função para formatar moeda (igual ao modal de compensação)
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Math.abs(value));
  };

  // ===== RENDER =====
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* ===== HEADER ===== */}
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-100">
                <Search className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  Gerenciar Duplicatas
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Buscar e excluir movimentações duplicadas
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* ===== INFORMAÇÕES DA TRANSAÇÃO ===== */}
        <Card className="bg-gray-100 border-gray-300 shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-xs text-gray-600 font-medium">Valor da Transação</Label>
                <p className="font-bold text-gray-800 bg-white px-2 py-1 rounded border">{formatCurrency(transacao.value)}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-600 font-medium">Data/Hora</Label>
                <p className="font-medium text-gray-800 bg-white px-2 py-1 rounded border break-words">{transacao.dateTime}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-600 font-medium">Cliente</Label>
                <p className="font-medium text-gray-800 bg-white px-2 py-1 rounded border break-words">{transacao.client || 'Não informado'}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-600 font-medium">Tipo</Label>
                <p className="font-bold text-gray-800 bg-white px-2 py-1 rounded border">{transacao.type}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-600 font-medium">ID do Usuário</Label>
                <p className="font-mono text-sm font-bold text-gray-800 bg-white px-2 py-1 rounded border">{idUsuario}</p>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleBuscarDuplicatas}
                  disabled={isLoading}
                  size="sm"
                  className="bg-blue-500 hover:bg-blue-600 text-white w-full"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  {isLoading ? 'Buscando...' : 'Buscar Novamente'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ===== ANÁLISE CONTEXTUAL ===== */}
{/* Seção de análise contextual removida conforme solicitado */}

        {/* ===== CONTEÚDO PRINCIPAL ===== */}
        <div className="flex-1 overflow-auto">
          
          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500 mb-3" />
                <p className="text-muted-foreground">Buscando duplicatas...</p>
              </div>
            </div>
          )}

          {/* Erro */}
          {error && !isLoading && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  <div>
                    <p className="font-semibold">Erro ao buscar duplicatas</p>
                    <p className="text-sm mt-1">{error}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Nenhuma duplicata */}
          {!isLoading && !error && duplicatas.length === 0 && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-6 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <h3 className="font-semibold text-green-800 mb-2">
                  Nenhuma duplicata encontrada
                </h3>
                <p className="text-green-600 text-sm">
                  Esta transação não possui duplicatas no sistema.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Lista de duplicatas */}
          {!isLoading && duplicatas.length > 0 && (
            <div className="space-y-4">
              {/* Header da lista */}
              <div className="flex items-center gap-3 py-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <h3 className="font-semibold">
                  {duplicatas.length} Duplicata(s) Encontrada(s)
                </h3>
                <Badge variant="outline" className="text-orange-600 border-orange-200">
                  Requer atenção
                </Badge>
              </div>

              {/* Lista */}
              {duplicatas.map((duplicata) => {
                const formatted = formatarDuplicataParaUI(duplicata);
                const isExcluindoEsta = isExcluindo === duplicata.id;

                return (
                  <Card key={duplicata.id} className="border-l-4 border-l-orange-400">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        
                        {/* Informações da duplicata */}
                        <div className="flex-1">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <Hash className="h-3 w-3" />
                                <span>ID</span>
                              </div>
                              <p className="font-mono font-semibold">{duplicata.id}</p>
                            </div>
                            
                            <div>
                              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <DollarSign className="h-3 w-3" />
                                <span>Valor</span>
                              </div>
                              <p className="font-semibold text-green-600">
                                {formatted.quantiaFormatada}
                              </p>
                            </div>
                            
                            <div>
                              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <Clock className="h-3 w-3" />
                                <span>Data</span>
                              </div>
                              <p>{formatted.dataFormatada}</p>
                            </div>
                            
                            <div>
                              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <Info className="h-3 w-3" />
                                <span>Colaborador BB</span>
                              </div>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {formatted.tipo}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {formatted.nomeColaborador}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {/* Transações associadas */}
                          {formatted.temTransacoes && (
                            <div className="mt-3 p-2 bg-muted/50 rounded-lg">
                              <p className="text-xs text-muted-foreground">
                                <strong>{formatted.transacoesCount}</strong> transação(ões) associada(s)
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Botão de excluir */}
                        <div className="ml-4">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleExcluirDuplicata(duplicata)}
                            disabled={isExcluindoEsta || isExcluindo !== null}
                            className="min-w-[100px]"
                          >
                            {isExcluindoEsta ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Excluindo...
                              </>
                            ) : (
                              <>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* ===== FOOTER ===== */}
        {!isLoading && (
          <div className="border-t pt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>
              Fechar
            </Button>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
