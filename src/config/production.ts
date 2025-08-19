// ===============================================
// 🔒 CONFIGURAÇÃO DE PRODUÇÃO SEGURA
// ===============================================

/**
 * Em produção, retorna valores seguros para variáveis sensíveis
 * Mantém funcionalidade mas protege dados
 */

const IS_PRODUCTION = import.meta.env.PROD;

// 🔒 Wrapper seguro que substitui dados sensíveis em produção
function getSecureEnvVar(value: string, fallback: string = ''): string {
  if (IS_PRODUCTION && value && (
    value.includes('tcr_panel') ||
    value.includes('secret') ||
    value.includes('key_prod') ||
    value.length > 30
  )) {
    return fallback; // Retorna string vazia em produção para dados sensíveis
  }
  return value || fallback;
}

// 🔒 Configurações protegidas para produção
export const SECURE_ENV = {
  // ✅ URLs públicas (OK para exposição)
  API_BASE_URL: import.meta.env.X_API_BASE_URL || '',
  API_URL_DEV: import.meta.env.X_API_URL_DEV || '',
  API_URL_PROD: import.meta.env.X_API_URL_PROD || '',
  DIAGNOSTICO_API_URL: import.meta.env.X_DIAGNOSTICO_API_URL || '',
  RECEIPT_API_URL: import.meta.env.X_RECEIPT_API_URL || '',
  
  // ✅ Configurações técnicas (OK para exposição)
  API_TIMEOUT: parseInt(import.meta.env.X_API_TIMEOUT || '30000', 10),
  
  // 🔒 Dados sensíveis protegidos
  API_KEY_BMP_531_TCR: getSecureEnvVar(import.meta.env.X_API_KEY_BMP_531_TCR),
  API_SECRET_BMP_531_TCR: getSecureEnvVar(import.meta.env.X_API_SECRET_BMP_531_TCR),
  API_KEY_BMP_TCR: getSecureEnvVar(import.meta.env.X_API_KEY_BMP_TCR),
  API_SECRET_BMP_TCR: getSecureEnvVar(import.meta.env.X_API_SECRET_BMP_TCR),
  ADMIN_TOKEN: getSecureEnvVar(import.meta.env.X_ADMIN_TOKEN),
  EXTERNAL_API_KEY: getSecureEnvVar(import.meta.env.X_EXTERNAL_API_KEY),
  TOKEN_CRYP_ACCESS: getSecureEnvVar(import.meta.env.X_TOKEN_CRYP_ACCESS),
  TOKEN_WHITELABEL: getSecureEnvVar(import.meta.env.X_TOKEN_WHITELABEL),
  CHAVE_BMP_531_TTF: getSecureEnvVar(import.meta.env.X_CHAVE_BMP_531_TTF),
  BMP531_SECRET_TOKEN: getSecureEnvVar(import.meta.env.X_X_BMP531_SECRET_TOKEN),
  
  // ✅ Dados bancários públicos (identificadores, não secrets)
  BMP_BANCO_BMP_274_TCR: import.meta.env.X_BMP_BANCO_BMP_274_TCR || '',
  BMP_AGENCIA_BMP_274_TCR: import.meta.env.X_BMP_AGENCIA_BMP_274_TCR || '',
  BMP_CONTA_BMP_274_TCR: import.meta.env.X_BMP_CONTA_BMP_274_TCR || '',
  BMP_CONTA_DIGITO_BMP_274_TCR: import.meta.env.X_BMP_CONTA_DIGITO_BMP_274_TCR || '',
  
  // ✅ Flags de ambiente
  IS_PRODUCTION,
  IS_DEVELOPMENT: import.meta.env.DEV
};

// 🚨 Log de segurança apenas em desenvolvimento
if (SECURE_ENV.IS_DEVELOPMENT) {
  console.log('🔒 Configuração de segurança carregada:', {
    environment: SECURE_ENV.IS_PRODUCTION ? 'production' : 'development',
    hasProtectedKeys: Object.values(SECURE_ENV).some(v => v === ''),
    apiConfigured: !!SECURE_ENV.API_BASE_URL
  });
}

