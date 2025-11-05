/**
 * TESTE EXTRATO BITSO - Frontend Integrado
 * Arquivo para testar a funcionalidade de extrato via interface web
 */

import { apiRouter } from './apiRouter';

export interface TesteExtratoBitso {
  testeConectividade(): Promise<void>;
  testeExtrato(): Promise<void>;
  testeExtratoComParametros(): Promise<void>;
  executarTodosTestes(): Promise<void>;
}

class TestExtratoBitso implements TesteExtratoBitso {
  
  /**
   * Teste 1: Conectividade básica
   */
  async testeConectividade(): Promise<void> {
    // console.log('🧪 [TESTE-EXTRATO-BITSO] 1. Testando conectividade...');
    
    try {
      // Primeiro verificar se consegue trocar para Bitso
      await apiRouter.switchAccount('bitso-crypto');
      // console.log('✅ Conta Bitso ativada');
      
      // Verificar se extrato está disponível
      const hasExtrato = apiRouter.hasFeature('extrato');
      // console.log(`✅ Feature extrato disponível: ${hasExtrato}`);
      
      if (!hasExtrato) {
        throw new Error('Feature extrato não disponível para Bitso');
      }
      
    } catch (error) {
      // console.error('❌ Erro na conectividade:', error);
      throw error;
    }
  }
  
  /**
   * Teste 2: Extrato básico
   */
  async testeExtrato(): Promise<void> {
    // console.log('🧪 [TESTE-EXTRATO-BITSO] 2. Testando extrato básico...');
    
    try {
      const extrato = await apiRouter.getExtrato();
      
      // console.log('✅ Extrato obtido:', {
        transacoes: extrato.transacoes?.length || 'N/A',
        total: extrato.total,
        provider: extrato.provider,
        ultimaAtualizacao: extrato.ultimaAtualizacao
      });
      
      // Verificar estrutura da resposta
      if (!extrato.transacoes || !Array.isArray(extrato.transacoes)) {
        throw new Error('Formato de extrato inválido - transacoes deve ser array');
      }
      
      if (extrato.provider !== 'bitso') {
        throw new Error(`Provider incorreto: esperado 'bitso', recebido '${extrato.provider}'`);
      }
      
      // Log das primeiras transações para debug
      if (extrato.transacoes.length > 0) {
        // console.log('📋 Primeiras transações:', extrato.transacoes.slice(0, 3));
      } else {
        // console.log('📭 Nenhuma transação encontrada (conta vazia ou sem credenciais)');
      }
      
    } catch (error) {
      // console.error('❌ Erro no teste de extrato:', error);
      throw error;
    }
  }
  
  /**
   * Teste 3: Extrato com parâmetros
   */
  async testeExtratoComParametros(): Promise<void> {
    // console.log('🧪 [TESTE-EXTRATO-BITSO] 3. Testando extrato com parâmetros...');
    
    try {
      const params = {
        limit: '5',
        status: 'PAID'
      };
      
      const extrato = await apiRouter.getExtrato(params);
      
      // console.log('✅ Extrato com parâmetros obtido:', {
        parametros: params,
        transacoes: extrato.transacoes?.length || 'N/A',
        total: extrato.total,
        provider: extrato.provider
      });
      
      // Verificar se respeitou o limite
      if (extrato.transacoes && extrato.transacoes.length > 5) {
        // Limite não respeitado - retornou mais de 5 transações
      }
      
    } catch (error) {
      // console.error('❌ Erro no teste com parâmetros:', error);
      throw error;
    }
  }
  
  /**
   * Executa todos os testes em sequência
   */
  async executarTodosTestes(): Promise<void> {
    // console.log('🚀 [TESTE-EXTRATO-BITSO] Iniciando bateria de testes...\n');
    
    try {
      await this.testeConectividade();
      // console.log('');
      
      await this.testeExtrato();
      // console.log('');
      
      await this.testeExtratoComParametros();
      // console.log('');
      
      // console.log('🎉 [TESTE-EXTRATO-BITSO] Todos os testes passaram!');
      
    } catch (error) {
      // console.error('💥 [TESTE-EXTRATO-BITSO] Falha nos testes:', error);
      throw error;
    }
  }
}

// Instância global para uso no console
const testExtratoBitso = new TestExtratoBitso();

// Exportar funções para uso global
export const testeBitsoExtrato = {
  /**
   * Teste rápido de extrato Bitso
   * Usage: testeBitsoExtrato.rapido()
   */
  async rapido() {
    await testExtratoBitso.testeExtrato();
  },
  
  /**
   * Teste completo de extrato Bitso
   * Usage: testeBitsoExtrato.completo()
   */
  async completo() {
    await testExtratoBitso.executarTodosTestes();
  },
  
  /**
   * Teste apenas conectividade
   * Usage: testeBitsoExtrato.conectividade()
   */
  async conectividade() {
    await testExtratoBitso.testeConectividade();
  },
  
  /**
   * Teste com parâmetros específicos
   * Usage: testeBitsoExtrato.parametros({ limit: '10' })
   */
  async parametros(params: Record<string, string> = { limit: '10' }) {
    // console.log('🧪 [TESTE-EXTRATO-BITSO] Teste com parâmetros customizados...');
    await apiRouter.switchAccount('bitso-crypto');
    const extrato = await apiRouter.getExtrato(params);
    // console.log('✅ Resultado:', { 
      parametros: params,
      transacoes: extrato.transacoes?.length,
      provider: extrato.provider 
    });
    return extrato;
  }
};

// Disponibilizar no window para uso no console
if (typeof window !== 'undefined') {
  (window as any).testeBitsoExtrato = testeBitsoExtrato;
  (window as any).testExtratoBitso = testExtratoBitso;
}

export default testExtratoBitso; 