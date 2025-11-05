/**
 * 🔍 TESTES E DIAGNÓSTICOS GLOBAIS
 * Ferramentas para debug e solução de problemas no sistema bancário
 */

// ✅ Importar ferramentas de diagnóstico
import BankingDiagnostic from '@/utils/bankingDiagnostic';
import { unifiedBankingService, initializeBankingSystem, getAvailableAccounts, switchAccount } from '@/services/banking';
import { bankManager } from '@/services/banking/BankManager';

// ===============================
// FERRAMENTAS DE DIAGNÓSTICO
// ===============================

/**
 * 🔍 Diagnóstico completo do sistema bancário
 */
export const diagnoseBanking = async () => {
  const result = await BankingDiagnostic.runFullDiagnostic();
  
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Executando diagnóstico completo...');
    console.log('📊 RELATÓRIO DE DIAGNÓSTICO:', result);
    
    if (result.conflicts.length > 0) {
      console.warn('⚠️ CONFLITOS DETECTADOS:', result.conflicts);
      console.info('💡 RECOMENDAÇÕES:', result.recommendations);
    } else {
      console.log('✅ Sistema sem conflitos detectados');
    }
  }
  
  return result;
};

/**
 * 🔄 Forçar sincronização dos sistemas
 */
export const fixAccountSwitching = async () => {
  const result = await BankingDiagnostic.forceSynchronization();
  
  if (process.env.NODE_ENV === 'development') {
    console.log('🔄 Forçando sincronização...');
    if (result.success) {
      console.log('✅', result.message);
    } else {
      console.error('❌', result.message);
    }
  }
  
  return result;
};

/**
 * 🏦 Trocar conta com validação
 */
export const testAccountSwitch = async (accountId: string) => {
  const result = await BankingDiagnostic.forceAccountSwitch(accountId);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`🏦 Testando troca para conta: ${accountId}`);
    if (result.success) {
      console.log('✅', result.message);
    } else {
      console.error('❌', result.message);
    }
  }
  
  return result;
};

/**
 * 📋 Listar contas disponíveis
 */
export const listAccounts = () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('📋 Contas disponíveis:');
    
    try {
      const unified = unifiedBankingService.getAvailableAccounts();
      console.log('Sistema Unificado:', unified);
      
      const apiRouter = (window as any).apiRouter;
      if (apiRouter) {
        const legacy = apiRouter.getCurrentAccount();
        console.log('Sistema Legado (ativo):', legacy);
      }
      
      const saved = localStorage.getItem('selected_account_id');
      console.log('LocalStorage:', saved);
      
    } catch (error) {
      console.error('Erro ao listar contas:', error);
    }
  }
};

/**
 * 🧹 Limpar caches e resetar sistema
 */
export const resetBankingSystem = () => {
  BankingDiagnostic.clearAllCaches();
  
  if (process.env.NODE_ENV === 'development') {
    console.log('🧹 Limpando sistema bancário...');
    console.log('🔄 Recarregando página para reinicializar...');
  }
  
  setTimeout(() => {
    window.location.reload();
  }, 1000);
};

// ===============================
// TESTES ESPECÍFICOS POR BANCO
// ===============================

export const testBMP = async () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('🏦 Testando BMP...');
  }
  return await testAccountSwitch('bmp-main');
};

export const testBitso = async () => {
  if (process.env.NODE_ENV === 'development') {
    // Testando Bitso
  }
  return await testAccountSwitch('bitso-crypto');
};

export const testBMP531 = async () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('🏦 Testando BMP-531...');
  }
  return await testAccountSwitch('bmp-531-ttf');
};

// ===============================
// AUTO-EXPOSIÇÃO NO CONSOLE
// ===============================

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).bankingTests = {
    diagnose: diagnoseBanking,
    fix: fixAccountSwitching,
    switch: testAccountSwitch,
    list: listAccounts,
    reset: resetBankingSystem,
    testBMP,
    testBitso,
    testBMP531,
    
    // Atalhos rápidos
    bmp: () => testBMP(),
    bitso: () => testBitso(),
    bmp531: () => testBMP531(),
    
    help: () => {
      console.log(`
🔍 FERRAMENTAS DE TESTE BANCÁRIO (DESENVOLVIMENTO)

Diagnóstico:
  bankingTests.diagnose()  - Diagnóstico completo
  bankingTests.fix()       - Corrigir problemas
  bankingTests.list()      - Listar contas
  bankingTests.reset()     - Resetar sistema

Testes por banco:
  bankingTests.bmp()       - Testar BMP
  bankingTests.bitso()     - Testar Bitso  
  bankingTests.bmp531()    - Testar BMP-531

Troca manual:
  bankingTests.switch('account-id')  - Trocar conta específica
      `);
    }
  };
}

export const TESTS_ENABLED = true;