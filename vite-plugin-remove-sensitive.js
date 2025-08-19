/**
 * 🔒 Plugin do Vite para Remover Dados Sensíveis
 * Remove completamente dados sensíveis do bundle de produção
 */

function removeSensitiveDataPlugin() {
  return {
    name: 'remove-sensitive-data',
    generateBundle(options, bundle) {
      // Lista de padrões sensíveis para remover
      const sensitivePatterns = [
        // API Keys e Secrets
        /tcr_panel_2025_key_prod_secure/gi,
        /tcr_panel_2025_secret_ultra_hash/gi,
        /tcr_bitso_2025_key_prod/gi,
        /tcr_bitso_2025_secret_hash_prod/gi,
        /tcr_external_2025_key_v1/gi,
        /af31000955206886355c1f675af939602a250977880d76db8ab883dc03e/gi,
        
        // Tokens JWT (padrão)
        /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g,
        
        // Chaves PIX específicas
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
        
        // Valores que parecem com secrets (mais de 20 caracteres alfanuméricos)
        /[A-Za-z0-9]{32,}/g,
        
        // Headers de autenticação
        /"X-API-Key":\s*"[^"]+"/gi,
        /"X-API-Secret":\s*"[^"]+"/gi,
        /"Authorization":\s*"Bearer [^"]+"/gi,
        
        // URLs com tokens
        /[?&](token|key|secret|auth)=[^&\s"]*/gi,
      ];
      
      // Substituições específicas
      const replacements = [
        // API Keys específicas que aparecem no código
        ['tcr_panel_2025_key_prod_secure', '***REMOVED***'],
        ['tcr_panel_2025_secret_ultra_hash_prod_2025', '***REMOVED***'],
        ['af31000955206886355c1f675af939602a250977880d76db8ab883dc03e', '***REMOVED***'],
        
        // Padrões de import.meta.env
        ['import.meta.env.X_API_KEY_BMP_531_TCR', '""'],
        ['import.meta.env.X_API_SECRET_BMP_531_TCR', '""'],
        ['import.meta.env.X_API_KEY_BMP_TCR', '""'],
        ['import.meta.env.X_API_SECRET_BMP_TCR', '""'],
        ['import.meta.env.X_ADMIN_TOKEN', '""'],
        ['import.meta.env.X_EXTERNAL_API_KEY', '""'],
        ['import.meta.env.X_TOKEN_CRYP_ACCESS', '""'],
        ['import.meta.env.X_TOKEN_WHITELABEL', '""'],
        ['import.meta.env.X_CHAVE_BMP_531_TTF', '""'],
        ['import.meta.env.X_X_BMP531_SECRET_TOKEN', '""'],
      ];

      // Processar cada arquivo do bundle
      for (const fileName in bundle) {
        const chunk = bundle[fileName];
        
        if (chunk.type === 'chunk' && chunk.code) {
          let cleanedCode = chunk.code;
          
          // Aplicar substituições específicas
          for (const [search, replace] of replacements) {
            cleanedCode = cleanedCode.replace(new RegExp(search, 'g'), replace);
          }
          
          // Aplicar padrões regex
          for (const pattern of sensitivePatterns) {
            cleanedCode = cleanedCode.replace(pattern, '***REMOVED***');
          }
          
          // Remover linhas que contêm dados sensíveis
          cleanedCode = cleanedCode
            .split('\n')
            .map(line => {
              // Se a linha contém palavras sensíveis, substituir por comentário
              if (
                line.includes('api_key') || 
                line.includes('api_secret') || 
                line.includes('token') && line.includes(':') ||
                line.includes('secret') && line.includes(':') ||
                line.includes('password') && line.includes(':')
              ) {
                return '// Sensitive data removed for security';
              }
              return line;
            })
            .join('\n');
          
          chunk.code = cleanedCode;
        }
      }
    }
  };
}

export default removeSensitiveDataPlugin;
