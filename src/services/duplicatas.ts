/**
 * 🔄 Serviço para gerenciar duplicatas de movimentações
 * 
 * Este serviço fornece funcionalidades para:
 * - Buscar duplicatas por usuário e quantia
 * - Excluir movimentações duplicadas
 * 
 * Base URL: X_DIAGNOSTICO_API_URL
 */

import { toast } from "sonner";

// ✅ Base URL usando variável de ambiente - URL EXATA CONFORME BACKEND
const DUPLICATAS_BASE_URL = `${import.meta.env.X_DIAGNOSTICO_API_URL}/api/duplicatas`;

// ============================== INTERFACES ==============================

export interface DuplicataBuscarRequest {
  id_usuario: number;
  quantia: number;
}

export interface MovimentacaoTipo {
  id: number;
  nome: string;
  descricao: string;
}

export interface MovimentacaoStatus {
  id: number;
  nome: string;
  descricao: string;
}

export interface Moeda {
  id: number;
  nome: string;
  simbolo: string;
}

export interface MovimentacaoTransacao {
  id: number;
  id_externo_bb: number;
  hash: string;
  chave_pix: string;
  taxa_externa: string;
}

export interface DuplicataItem {
  id: number;
  created_at: string;
  updated_at: string;
  id_usuario: number;
  id_moeda: number;
  quantia: string;
  id_tipo_movimentacao: number;
  id_status: number;
  movimentacoes_tipo: MovimentacaoTipo;
  movimentacoes_status: MovimentacaoStatus;
  moeda: Moeda;
  movimentacoes_transacoes: MovimentacaoTransacao[];
  nome_bb_colaborador?: string; // ✅ NOVO: Campo para nome do colaborador BB
}

export interface DuplicatasBuscarResponse {
  mensagem: string;
  dados: DuplicataItem[];
}

export interface DuplicataExcluirResponse {
  mensagem: string;
  dados: {
    id_movimentacao_excluida: number;
    transacoes_excluidas: number;
    dados_movimentacao: {
      id: number;
      id_usuario: number;
      quantia: string;
      id_tipo_movimentacao: number;
      possui_transacoes: boolean;
      transacoes_excluidas: number;
    };
  };
}

// ============================== SERVIÇOS ==============================

/**
 * 🔍 Busca duplicatas para um usuário e quantia específicos
 * 
 * @param request - Dados para busca (id_usuario e quantia)
 * @returns Promise com lista de duplicatas encontradas
 */
export const buscarDuplicatas = async (
  request: DuplicataBuscarRequest
): Promise<DuplicatasBuscarResponse> => {
  try {
    const response = await fetch(`${DUPLICATAS_BASE_URL}/buscar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.mensagem || `Erro HTTP: ${response.status}`);
    }

    const data: DuplicatasBuscarResponse = await response.json();
    
    // Log simples para debug
    console.log('[DUPLICATAS] Busca realizada:', data.dados?.length || 0, 'resultados');
    
    // Log da estrutura do primeiro item (só campos principais)
    if (data.dados?.[0]) {
      const primeiro = data.dados[0];
      console.log('[DUPLICATAS] Campos disponíveis:', Object.keys(primeiro));
    }

    return data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao buscar duplicatas';
    
    console.error('[DUPLICATAS] Erro ao buscar:', {
      error: errorMessage,
      request
    });
    
    toast.error(`Erro ao buscar duplicatas: ${errorMessage}`);
    throw error;
  }
};

/**
 * 🗑️ Exclui uma movimentação duplicada
 * 
 * @param idMovimentacao - ID da movimentação a ser excluída
 * @returns Promise com dados da exclusão
 */
export const excluirMovimentacao = async (
  idMovimentacao: number
): Promise<DuplicataExcluirResponse> => {
  try {
    const response = await fetch(`${DUPLICATAS_BASE_URL}/excluir/${idMovimentacao}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.mensagem || `Erro HTTP: ${response.status}`);
    }

    const data: DuplicataExcluirResponse = await response.json();
    
    // Log para debug
    console.log('[DUPLICATAS] Movimentação excluída:', {
      id: idMovimentacao,
      transacoes_excluidas: data.dados?.transacoes_excluidas
    });

    // Mostrar sucesso
    toast.success(data.mensagem || 'Movimentação excluída com sucesso!');

    return data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao excluir movimentação';
    
    console.error('[DUPLICATAS] Erro ao excluir:', {
      error: errorMessage,
      idMovimentacao
    });
    
    toast.error(`Erro ao excluir movimentação: ${errorMessage}`);
    throw error;
  }
};

/**
 * 📊 Utilitário para formatar dados da duplicata para exibição
 * 
 * @param duplicata - Item de duplicata
 * @returns Objeto formatado para UI
 */
export const formatarDuplicataParaUI = (duplicata: DuplicataItem) => {
  // ✅ Tratamento seguro para campos que podem estar undefined
  const moedaSimbolo = duplicata.moeda?.simbolo || 'R$';
  const valorNumerico = parseFloat(duplicata.quantia || '0');
  const transacoes = duplicata.movimentacoes_transacoes || [];
  
  // 🔍 Tentar diferentes campos para nome do colaborador
  const nomeColaborador = duplicata.nome_bb_colaborador || 
                         (duplicata as any).nome_colaborador ||
                         (duplicata as any).colaborador ||
                         (duplicata as any).nome_bb ||
                         (duplicata as any).bb_colaborador ||
                         'N/A';
  
  return {
    id: duplicata.id,
    dataFormatada: new Date(duplicata.created_at).toLocaleString('pt-BR'),
    quantiaFormatada: `${moedaSimbolo} ${valorNumerico.toFixed(2)}`,
    tipo: duplicata.movimentacoes_tipo?.nome || 'N/A',
    status: duplicata.movimentacoes_status?.nome || 'N/A',
    nomeColaborador, // ✅ Nome do colaborador com fallbacks
    transacoesCount: transacoes.length,
    temTransacoes: transacoes.length > 0,
    moeda: moedaSimbolo,
    valorNumerico
  };
};

/**
 * 🎯 Utilitário para extrair dados necessários de uma transação do extrato
 * Converte dados do formato MovimentoExtrato para DuplicataBuscarRequest
 * 
 * @param transacao - Transação do extrato BMP 531
 * @param idUsuario - ID do usuário (precisa ser fornecido externamente)
 * @returns Request formatado para busca de duplicatas
 */
export const criarRequestDeBusca = (
  transacao: any, 
  idUsuario: number
): DuplicataBuscarRequest => {
  return {
    id_usuario: idUsuario,
    quantia: Math.abs(transacao.value || transacao.vlrMovimento || 0)
  };
};
