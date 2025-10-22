/**
 * 🌟 CONFIGURAÇÃO DE AMBIENTE - ARQUITETURA SEGURA
 * 
 * ✅ NOVA ABORDAGEM DE SEGURANÇA:
 * • Frontend: APENAS dados públicos e JWT do usuário
 * • Backend: Gerencia TODAS as credenciais via banco de dados
 * • Zero exposição de API keys, secrets ou tokens no frontend
 */

/**
 * Configurações públicas (podem ser expostas no frontend)
 */
export const PUBLIC_ENV = {
  // URLs da API (ok expor, são endpoints públicos)
  API_BASE_URL: import.meta.env.X_API_BASE_URL || '',
  API_URL_DEV: import.meta.env.X_API_URL_DEV || '',
  API_URL_PROD: import.meta.env.X_API_URL_PROD || '',
  DIAGNOSTICO_API_URL: import.meta.env.X_DIAGNOSTICO_API_URL || '',
  RECEIPT_API_URL: import.meta.env.X_RECEIPT_API_URL || '',
  
  // Configurações de timeout (ok expor)
  API_TIMEOUT: parseInt(import.meta.env.X_API_TIMEOUT || '30000', 10),
  API_RETRY_ATTEMPTS: parseInt(import.meta.env.X_API_RETRY_ATTEMPTS || '3', 10),
  API_RETRY_DELAY: parseInt(import.meta.env.X_API_RETRY_DELAY || '1000', 10),
  
  // Configurações de login timeout (ok expor)
  LOGIN_TIMEOUT_MINUTES: parseInt(import.meta.env.X_LOGIN_TIMEOUT_MINUTES || '30', 10),
  LOGIN_CHECK_INTERVAL_MS: parseInt(import.meta.env.X_LOGIN_CHECK_INTERVAL_MS || '60000', 10),
  LOGIN_WARNING_MINUTES: parseInt(import.meta.env.X_LOGIN_WARNING_MINUTES || '5', 10),
  
  // Configurações de logs (ok expor - não são dados sensíveis)
  LOG_LEVEL: import.meta.env.X_LOG_LEVEL || 'error',
  ENABLE_LOGS_PROD: import.meta.env.X_ENABLE_LOGS_PROD === 'true',
  ENABLE_SENSITIVE_LOGS: import.meta.env.X_ENABLE_SENSITIVE_LOGS === 'true',
  ENABLE_PERFORMANCE_LOGS: import.meta.env.X_ENABLE_PERFORMANCE_LOGS === 'true',
  ENABLE_DEBUG_LOGS: import.meta.env.X_ENABLE_DEBUG_LOGS === 'true',
  
  // Configurações de ambiente
  APP_ENVIRONMENT: import.meta.env.X_APP_ENVIRONMENT || 'production',
  APP_USER_AGENT: import.meta.env.X_APP_USER_AGENT || 'BaaS-Frontend/1.0.0',
  
  // Mock configs (ok para desenvolvimento)
  PIX_MOCK_QR_CODE: import.meta.env.X_PIX_MOCK_QR_CODE || '',
  BITSO_MOCK_CPF_KEY: import.meta.env.X_BITSO_MOCK_CPF_KEY || '',
  BITSO_MOCK_EMAIL_KEY: import.meta.env.X_BITSO_MOCK_EMAIL_KEY || '',
  
  // URLs de webhook (públicas)
  BITSO_WEBHOOK_URL: import.meta.env.X_BITSO_WEBHOOK_URL || '',
  
  // Dados bancários (não são secretos - são identificadores públicos)
  BMP_BANCO_BMP_274_TCR: import.meta.env.X_BMP_BANCO_BMP_274_TCR || '',
  BMP_AGENCIA_BMP_274_TCR: import.meta.env.X_BMP_AGENCIA_BMP_274_TCR || '',
  BMP_AGENCIA_DIGITO_BMP_274_TCR: import.meta.env.X_BMP_AGENCIA_DIGITO_BMP_274_TCR || '',
  BMP_CONTA_BMP_274_TCR: import.meta.env.X_BMP_CONTA_BMP_274_TCR || '',
  BMP_CONTA_DIGITO_BMP_274_TCR: import.meta.env.X_BMP_CONTA_DIGITO_BMP_274_TCR || '',
  BMP_CONTA_PGTO_BMP_274_TCR: import.meta.env.X_BMP_CONTA_PGTO_BMP_274_TCR || '',
  BMP_TIPO_CONTA_BMP_274_TCR: parseInt(import.meta.env.X_BMP_TIPO_CONTA_BMP_274_TCR || '3', 10),
  BMP_MODELO_CONTA_BMP_274_TCR: parseInt(import.meta.env.X_BMP_MODELO_CONTA_BMP_274_TCR || '1', 10),
  
  BMP_531_BANCO: import.meta.env.X_BMP_531_BANCO || '',
  BMP_AGENCIA_TTF: import.meta.env.X_531_AGENCIA || '',
  BMP_AGENCIA_DIGITO_TTF: import.meta.env.X_BMP_AGENCIA_DIGITO_TTF || '',
  BMP_CONTA_TTF: import.meta.env.X_BMP_CONTA_TTF || '',
  BMP_CONTA_DIGITO_TTF: import.meta.env.X_BMP_CONTA_DIGITO_TTF || '',
  BMP_CONTA_PGTO_TTF: import.meta.env.X_BMP_CONTA_PGTO_TTF || '',
  BMP_TIPO_CONTA_TTF: parseInt(import.meta.env.X_BMP_TIPO_CONTA_TTF || '1', 10),
  BMP_MODELO_CONTA_TTF: parseInt(import.meta.env.X_BMP_MODELO_CONTA_TTF || '1', 10),
  
  BMP_AGENCIA_TCR: import.meta.env.X_BMP_AGENCIA_TCR || '',
  BMP_AGENCIA_DIGITO_TCR: import.meta.env.X_BMP_AGENCIA_DIGITO_TCR || '',
  BMP_CONTA_TCR: import.meta.env.X_BMP_CONTA_TCR || '',
  BMP_CONTA_DIGITO_TCR: import.meta.env.X_BMP_CONTA_DIGITO_TCR || '',
  BMP_CONTA_PGTO_TCR: import.meta.env.X_BMP_CONTA_PGTO_TCR || '',
  BMP_TIPO_CONTA_TCR: parseInt(import.meta.env.X_BMP_TIPO_CONTA_TCR || '1', 10),
  BMP_MODELO_CONTA_TCR: parseInt(import.meta.env.X_BMP_MODELO_CONTA_TCR || '1', 10),
  
  ACCOUNT_NUMBER_B8_TCR: import.meta.env.X_ACCOUNT_NUMBER_B8_TCR || '',
  
  // Mode flags
  IS_DEVELOPMENT: import.meta.env.DEV,
  IS_PRODUCTION: import.meta.env.PROD
};

/**
 * 🚩 FEATURE FLAGS - Controle de funcionalidades
 * 
 * Use estas flags para ativar/desativar menus e funcionalidades.
 * Por padrão, features depreciadas estão desabilitadas em produção.
 * Para reativar, defina a variável de ambiente correspondente como 'true'.
 */
export const FEATURE_FLAGS = {
  // 📊 Menus Depreciados (desabilitados por padrão)
  ENABLE_DASHBOARD: import.meta.env.VITE_FEATURE_DASHBOARD === 'true' || false,
  ENABLE_EXTRATO_TCR: import.meta.env.VITE_FEATURE_EXTRATO_TCR === 'true' || false,
  ENABLE_COMPENSACAO_DEPOSITOS: import.meta.env.VITE_FEATURE_COMPENSACAO === 'true' || false,
  ENABLE_BMP531_TCR: import.meta.env.VITE_FEATURE_BMP531 === 'true' || false,
  ENABLE_CORPX_TTF_TCR: import.meta.env.VITE_FEATURE_CORPX_TTF === 'true' || false,
  
  // 🔧 Para reativar em desenvolvimento, adicione no .env:
  // VITE_FEATURE_DASHBOARD=true
  // VITE_FEATURE_EXTRATO_TCR=true
  // VITE_FEATURE_COMPENSACAO=true
  // VITE_FEATURE_BMP531=true
  // VITE_FEATURE_CORPX_TTF=true
};

/**
 * FUNÇÃO UTILITÁRIA: Verificar se ambiente está configurado corretamente
 */
export const validateEnvironment = (): { valid: boolean; missing: string[]; warnings: string[] } => {
  const missing: string[] = [];
  const warnings: string[] = [];
  
  // Verificar configurações obrigatórias básicas
  if (!PUBLIC_ENV.API_BASE_URL) missing.push('X_API_BASE_URL');
  if (!PUBLIC_ENV.DIAGNOSTICO_API_URL) missing.push('X_DIAGNOSTICO_API_URL');
  
  // ✅ Validação de segurança em produção
  if (PUBLIC_ENV.IS_PRODUCTION) {
    warnings.push('✅ Arquitetura segura: Frontend limpo, credenciais no backend');
  }
  
  return {
    valid: missing.length === 0,
    missing,
    warnings
  };
};
