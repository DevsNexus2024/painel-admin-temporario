/**
 * Testes Globais - Disponibilizar no Window
 * Centraliza todas as funções de teste para uso no console
 */

import { apiRouter } from './apiRouter';
import { testeBitsoExtrato } from './testExtratoBitso';

// Disponibilizar tudo no window para fácil acesso no console
if (typeof window !== 'undefined') {
  // ApiRouter
  (window as any).apiRouter = apiRouter;
  
  // Testes Bitso
  (window as any).testeBitsoExtrato = testeBitsoExtrato;
  
  // Funções de conveniência
  (window as any).trocarParaBitso = async () => {
    await apiRouter.switchAccount('bitso-crypto');
    console.log('✅ Conta trocada para Bitso');
  };
  
  (window as any).trocarParaBMP = async () => {
    await apiRouter.switchAccount('bmp-main');
    console.log('✅ Conta trocada para BMP');
  };
  
  (window as any).testarSaldo = async () => {
    const saldo = await apiRouter.getSaldo();
    console.log('💰 Saldo:', saldo);
    return saldo;
  };
  
  (window as any).testarExtrato = async (params?: Record<string, string>) => {
    const extrato = await apiRouter.getExtrato(params);
    console.log('📋 Extrato:', extrato);
    return extrato;
  };
  
  // NOVA FUNÇÃO DE TESTE - Verificar roteamento
  (window as any).testarRoteamento = async () => {
    console.log('🧪 [TESTE-ROTEAMENTO] Iniciando teste de roteamento...');
    console.log('🧪 [TESTE-ROTEAMENTO] Estado inicial:', {
      contaAtual: apiRouter.getCurrentAccount().displayName,
      provider: apiRouter.getCurrentAccount().provider
    });
    
    // Teste 1: BMP
    console.log('\n=== 1️⃣ TESTE BMP ===');
    const successBMP = apiRouter.switchAccount('bmp-main');
    console.log('Switch BMP resultado:', successBMP);
    
    const contaBMP = apiRouter.getCurrentAccount();
    console.log('Conta após switch:', contaBMP.displayName, `(${contaBMP.provider})`);
    
    try {
      const extratoBMP = await apiRouter.getExtrato({ limit: '3' });
      console.log('✅ BMP - Extrato obtido:', {
        provider: extratoBMP.provider || 'N/A',
        transacoes: extratoBMP.transacoes?.length || extratoBMP.items?.length || 'N/A',
        hasItems: !!extratoBMP.items,
        hasTransacoes: !!extratoBMP.transacoes,
        keys: Object.keys(extratoBMP)
      });
    } catch (error) {
      console.error('❌ BMP - Erro:', error);
    }
    
    console.log('\n=== 2️⃣ TESTE BITSO ===');
    const successBitso = apiRouter.switchAccount('bitso-crypto');
    console.log('Switch Bitso resultado:', successBitso);
    
    const contaBitso = apiRouter.getCurrentAccount();
    console.log('Conta após switch:', contaBitso.displayName, `(${contaBitso.provider})`);
    
    try {
      const extratoBitso = await apiRouter.getExtrato({ limit: '3' });
      console.log('✅ Bitso - Extrato obtido:', {
        provider: extratoBitso.provider || 'N/A',
        transacoes: extratoBitso.transacoes?.length || extratoBitso.items?.length || 'N/A',
        hasItems: !!extratoBitso.items,
        hasTransacoes: !!extratoBitso.transacoes,
        keys: Object.keys(extratoBitso)
      });
    } catch (error) {
      console.error('❌ Bitso - Erro:', error);
    }
    
    console.log('\n🎉 Teste de roteamento concluído!');
  };
  
  // TESTE DIRETO DOS ENDPOINTS
  (window as any).testarEndpointsDiretos = async () => {
    console.log('🔗 [TESTE-ENDPOINTS] Testando endpoints diretos...');
    
    try {
      console.log('\n=== BMP DIRETO ===');
      const responseBMP = await fetch('http://localhost:3000/internal/account/extrato?limit=3');
      const dataBMP = await responseBMP.json();
      console.log('BMP Response:', {
        status: responseBMP.status,
        ok: responseBMP.ok,
        hasItems: !!dataBMP?.items,
        itemsCount: dataBMP?.items?.length || 0
      });
    } catch (error) {
      console.error('❌ Erro BMP direto:', error);
    }
    
    try {
      console.log('\n=== BITSO DIRETO ===');
      const responseBitso = await fetch('http://localhost:3000/api/bitso/pix/extrato?limit=3');
      const dataBitso = await responseBitso.json();
      console.log('Bitso Response:', {
        status: responseBitso.status,
        ok: responseBitso.ok,
        sucesso: dataBitso?.sucesso,
        hasData: !!dataBitso?.data,
        hasTransacoes: !!dataBitso?.data?.transacoes,
        transacoesCount: dataBitso?.data?.transacoes?.length || 0
      });
    } catch (error) {
      console.error('❌ Erro Bitso direto:', error);
    }
  };
  
  // 🚨 TESTE CRÍTICO DE SEGURANÇA
  (window as any).testarSegurancaRoteamento = async () => {
    console.log('🔒 [TESTE-SEGURANÇA] Iniciando teste crítico de segurança...');
    
    // Importar o service seguro
    const { consultarExtrato } = await import('@/services/extrato');
    
    console.log('\n=== 1️⃣ TESTE BMP ISOLADO ===');
    try {
      const resultBMP = await consultarExtrato({
        provider: 'bmp',
        cursor: 0
      });
      
      console.log('✅ BMP Isolado:', {
        provider: resultBMP.provider,
        transacoes: resultBMP.items?.length || 0,
        primeiraTransacao: resultBMP.items?.[0] ? {
          id: resultBMP.items[0].id,
          tipo: resultBMP.items[0].type,
          valor: resultBMP.items[0].value
        } : null
      });
      
      // Validar provider
      if (resultBMP.provider !== 'bmp') {
        console.error('🚨 FALHA DE SEGURANÇA BMP: Provider incorreto!', resultBMP.provider);
      } else {
        console.log('✅ Segurança BMP: OK');
      }
      
    } catch (error) {
      console.error('❌ Erro BMP isolado:', error);
    }
    
    console.log('\n=== 2️⃣ TESTE BITSO ISOLADO ===');
    try {
      const resultBitso = await consultarExtrato({
        provider: 'bitso',
        cursor: 0
      });
      
      console.log('✅ Bitso Isolado:', {
        provider: resultBitso.provider,
        transacoes: resultBitso.items?.length || 0,
        primeiraTransacao: resultBitso.items?.[0] ? {
          id: resultBitso.items[0].id,
          tipo: resultBitso.items[0].type,
          valor: resultBitso.items[0].value
        } : null
      });
      
      // Validar provider
      if (resultBitso.provider !== 'bitso') {
        console.error('🚨 FALHA DE SEGURANÇA BITSO: Provider incorreto!', resultBitso.provider);
      } else {
        console.log('✅ Segurança Bitso: OK');
      }
      
    } catch (error) {
      console.error('❌ Erro Bitso isolado:', error);
    }
    
    console.log('\n=== 3️⃣ TESTE SEM PROVIDER (DEVE FALHAR) ===');
    try {
      await consultarExtrato({
        cursor: 0
        // SEM provider - deve dar erro
      });
      console.error('🚨 FALHA DE SEGURANÇA: Consulta sem provider não deveria funcionar!');
    } catch (error) {
      console.log('✅ Segurança OK: Bloqueou consulta sem provider', error.message);
    }
    
    console.log('\n🎉 Teste de segurança concluído!');
  };
  
  // TESTE DA NOVA ARQUITETURA
  (window as any).testarNovaArquitetura = () => {
    console.log('🏗️ [TESTE-NOVA-ARQUITETURA] Verificando nova arquitetura...');
    
    try {
      const { unifiedBankingService } = require('@/services/banking');
      
      console.log('✅ [NOVA-ARQUITETURA] Serviço carregado');
      
      // Listar contas disponíveis
      const accounts = unifiedBankingService.getAvailableAccounts();
      console.log('📋 [NOVA-ARQUITETURA] Contas disponíveis:', accounts);
      
      // Conta ativa
      const activeAccount = unifiedBankingService.getActiveAccount();
      console.log('🎯 [NOVA-ARQUITETURA] Conta ativa:', activeAccount);
      
      // Teste de troca
      console.log('🔄 [NOVA-ARQUITETURA] Testando troca para BMP...');
      const bmpSuccess = unifiedBankingService.setActiveAccount('bmp-main');
      console.log('BMP resultado:', bmpSuccess);
      
      console.log('🔄 [NOVA-ARQUITETURA] Testando troca para Bitso...');
      const bitsoSuccess = unifiedBankingService.setActiveAccount('bitso-crypto');
      console.log('Bitso resultado:', bitsoSuccess);
      
      return {
        contas: accounts,
        contaAtiva: activeAccount,
        trocaBMP: bmpSuccess,
        trocaBitso: bitsoSuccess
      };
      
    } catch (error) {
      console.error('❌ [NOVA-ARQUITETURA] Erro:', error);
      return { erro: error.message };
    }
  };
  
  // 🔍 DEBUGGING EXTREMO - Rastrear origem do problema
  (window as any).debugExtratoContaminacao = async () => {
    console.log('🔍 [DEBUG-CONTAMINACAO] INICIANDO INVESTIGAÇÃO EXTREMA...');
    
    // Limpar todos os caches primeiro
    console.log('🧹 [DEBUG] Limpando todos os caches...');
    localStorage.clear();
    sessionStorage.clear();
    
    try {
      const queryClient = (window as any).queryClient;
      if (queryClient) {
        queryClient.clear();
        console.log('✅ React Query cache limpo');
      }
    } catch (e) {
      console.log('⚠️ Não foi possível limpar React Query');
    }
    
    // Verificar conta ativa primeiro
    console.log('\n=== 1️⃣ VERIFICAR CONTA ATIVA ===');
    const contaAtual = apiRouter.getCurrentAccount();
    console.log('Conta ativa:', contaAtual);
    
    // Forçar para BMP se não estiver
    if (contaAtual.provider !== 'bmp') {
      console.log('🔄 Trocando forçadamente para BMP...');
      apiRouter.switchAccount('bmp-main');
    }
    
    // Verificar nova arquitetura
    console.log('\n=== 2️⃣ VERIFICAR NOVA ARQUITETURA ===');
    try {
      const { unifiedBankingService } = require('@/services/banking');
      const novaContaAtiva = unifiedBankingService.getActiveAccount();
      console.log('Nova arquitetura - conta ativa:', novaContaAtiva);
      
      if (!novaContaAtiva || novaContaAtiva.provider !== 'bmp') {
        console.log('🔄 Corrigindo nova arquitetura...');
        unifiedBankingService.setActiveAccount('bmp-main');
      }
    } catch (e) {
      console.log('⚠️ Nova arquitetura indisponível:', e.message);
    }
    
    // Testar endpoint BMP direto
    console.log('\n=== 3️⃣ TESTE BMP DIRETO ===');
    try {
      const urlBMP = 'http://localhost:3000/internal/account/extrato?cursor=0';
      console.log('URL BMP:', urlBMP);
      
      const responseBMP = await fetch(urlBMP, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'debug-test/1.0.0'
        }
      });
      
      console.log('BMP Response Status:', responseBMP.status);
      console.log('BMP Response OK:', responseBMP.ok);
      
      const dataBMP = await responseBMP.json();
      console.log('BMP Response Data:', {
        hasItems: !!dataBMP?.items,
        itemsCount: dataBMP?.items?.length || 0,
        error: dataBMP?.message || dataBMP?.error,
        keys: Object.keys(dataBMP)
      });
      
      if (dataBMP?.items?.length > 0) {
        console.log('✅ BMP funcionando! Primeira transação:', {
          id: dataBMP.items[0].id,
          value: dataBMP.items[0].value,
          type: dataBMP.items[0].type
        });
      }
      
    } catch (error) {
      console.error('❌ BMP endpoint falhou:', error);
    }
    
    // Testar endpoint Bitso direto
    console.log('\n=== 4️⃣ TESTE BITSO DIRETO ===');
    try {
      const urlBitso = 'http://localhost:3000/api/bitso/pix/extrato?cursor=0';
      console.log('URL Bitso:', urlBitso);
      
      const responseBitso = await fetch(urlBitso, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'debug-test/1.0.0'
        }
      });
      
      console.log('Bitso Response Status:', responseBitso.status);
      console.log('Bitso Response OK:', responseBitso.ok);
      
      const dataBitso = await responseBitso.json();
      console.log('Bitso Response Data:', {
        sucesso: dataBitso?.sucesso,
        hasData: !!dataBitso?.data,
        hasTransacoes: !!dataBitso?.data?.transacoes,
        transacoesCount: dataBitso?.data?.transacoes?.length || 0,
        keys: Object.keys(dataBitso)
      });
      
      if (dataBitso?.data?.transacoes?.length > 0) {
        console.log('✅ Bitso funcionando! Primeira transação:', {
          id: dataBitso.data.transacoes[0].id,
          value: dataBitso.data.transacoes[0].value,
          type: dataBitso.data.transacoes[0].type
        });
      }
      
    } catch (error) {
      console.error('❌ Bitso endpoint falhou:', error);
    }
    
    // Testar o service isolado
    console.log('\n=== 5️⃣ TESTE SERVICE CONSULTAREXTRATO ===');
    try {
      const { consultarExtrato } = await import('@/services/extrato');
      
      // Teste BMP isolado
      console.log('🔵 Testando consultarExtrato com provider BMP...');
      const resultBMP = await consultarExtrato({
        provider: 'bmp',
        cursor: 0
      });
      
      console.log('Service BMP resultado:', {
        provider: resultBMP.provider,
        transacoes: resultBMP.items?.length || 0,
        primeiraTransacao: resultBMP.items?.[0] ? {
          id: resultBMP.items[0].id,
          valor: resultBMP.items[0].value,
          tipo: resultBMP.items[0].type
        } : null
      });
      
      // VERIFICAÇÃO CRÍTICA
      if (resultBMP.provider !== 'bmp') {
        console.error('🚨 CONTAMINAÇÃO DETECTADA! Service retornou provider:', resultBMP.provider);
      } else {
        console.log('✅ Service BMP: Provider correto');
      }
      
    } catch (error) {
      console.error('❌ Service consultarExtrato falhou:', error);
    }
    
    // Teste do hook useExtratoSeguro
    console.log('\n=== 6️⃣ INVESTIGAR HOOK ATUAL ===');
    try {
      // Verificar se há algum cache React Query contaminado
             const queryClient = (window as any).queryClient;
      if (queryClient) {
        const cache = queryClient.getQueryCache();
        const queries = cache.getAll();
        
        console.log('React Query - Total de queries:', queries.length);
        
        queries.forEach((query, index) => {
          if (query.queryKey.includes('extrato')) {
            console.log(`Query ${index}:`, {
              key: query.queryKey,
              state: query.state.status,
              hasData: !!query.state.data,
              provider: query.state.data?.provider
            });
          }
        });
      }
    } catch (e) {
      console.log('⚠️ Não foi possível investigar React Query');
    }
    
    console.log('\n🎉 Investigação concluída! Verifique os logs acima.');
  };
  
  // 🔍 DEBUGGING SALDO BMP
  (window as any).debugSaldoBMP = async () => {
    console.log('💰 [DEBUG-SALDO] Investigando saldo BMP...');
    
    // 1. Verificar conta ativa
    const contaAtual = apiRouter.getCurrentAccount();
    console.log('1. Conta ativa:', contaAtual);
    
    // 2. Forçar para BMP
    if (contaAtual.provider !== 'bmp') {
      console.log('🔄 Trocando para BMP...');
      apiRouter.switchAccount('bmp-main');
    }
    
    // 3. Testar endpoint de saldo direto
    console.log('\n=== TESTE SALDO DIRETO ===');
    try {
      const urlSaldo = 'http://localhost:3000/internal/account/saldo';
      console.log('URL Saldo:', urlSaldo);
      
      const response = await fetch(urlSaldo, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'debug-test/1.0.0'
        }
      });
      
      console.log('Response Status:', response.status);
      console.log('Response OK:', response.ok);
      
      const dataSaldo = await response.json();
      console.log('Dados do saldo:', dataSaldo);
      console.log('Chaves:', Object.keys(dataSaldo));
      
      if (dataSaldo.saldoDisponivel !== undefined) {
        console.log('✅ Campo saldoDisponivel:', dataSaldo.saldoDisponivel);
      }
      if (dataSaldo.saldo_disponivel !== undefined) {
        console.log('✅ Campo saldo_disponivel:', dataSaldo.saldo_disponivel);
      }
      if (dataSaldo.saldo !== undefined) {
        console.log('✅ Campo saldo:', dataSaldo.saldo);
      }
      
    } catch (error) {
      console.error('❌ Erro no endpoint de saldo:', error);
    }
    
    // 4. Testar via apiRouter
    console.log('\n=== TESTE VIA APIROUTER ===');
    try {
      const saldoApiRouter = await apiRouter.getSaldo();
      console.log('Saldo via apiRouter:', saldoApiRouter);
      console.log('Tipo de dados:', typeof saldoApiRouter);
      console.log('Chaves:', Object.keys(saldoApiRouter));
      
      console.log('Campos específicos:');
      console.log('- saldo:', saldoApiRouter.saldo);
      console.log('- saldoFormatado:', saldoApiRouter.saldoFormatado);
      console.log('- saldoDisponivel:', saldoApiRouter.saldoDisponivel);
      console.log('- saldo_disponivel:', saldoApiRouter.saldo_disponivel);
      
    } catch (error) {
      console.error('❌ Erro via apiRouter:', error);
    }
    
    // 5. Verificar network tab do browser
    console.log('\n🔍 Verifique o Network tab para ver a resposta real do endpoint /saldo');
    console.log('💡 Compare com os logs acima para identificar discrepâncias');
  };
  
  // Log de inicialização
  console.log('�� [TESTE-GLOBAL] Funções disponíveis no console:');
  console.log('- apiRouter: objeto principal');
  console.log('- testeBitsoExtrato: testes específicos Bitso');
  console.log('- trocarParaBitso(): switch para Bitso');
  console.log('- trocarParaBMP(): switch para BMP');
  console.log('- testarSaldo(): teste rápido saldo');
  console.log('- testarExtrato(): teste rápido extrato');
  console.log('- testarRoteamento(): teste completo de roteamento 🆕');
  console.log('- testarEndpointsDiretos(): teste direto nos endpoints 🆕');
  console.log('- testarSegurancaRoteamento(): 🚨 TESTE CRÍTICO DE SEGURANÇA 🆕');
} 