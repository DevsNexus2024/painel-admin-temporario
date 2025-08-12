/**
 * 🏦 CONFIGURAÇÕES CENTRALIZADAS DOS BANCOS
 * 
 * Sistema escalável para configurar N bancos diferentes
 * Facilita adição de novos providers sem mudanças estruturais
 */

import {
  BankProvider,
  BankFeature
} from '../types';
import type {
  BankConfig,
  BankCredentials
} from '../types';

/**
 * Configurações de ambiente
 */
interface Environment {
  name: 'development' | 'staging' | 'production';
  apiUrl: string;
  timeout: number;
}

/**
 * Configuração completa de um banco
 */
interface BankSettings {
  provider: BankProvider;
  name: string;
  displayName: string;
  environments: Record<string, Environment>;
  features: BankFeature[];
  defaultCredentials: Partial<BankCredentials>;
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerHour: number;
    burstLimit?: number;
  };
  customHeaders?: Record<string, string>;
}

/**
 * Registry de todos os bancos suportados
 */
const BANK_REGISTRY: Record<BankProvider, BankSettings> = {
  
  // ===============================
  // BMP - BANCO MASTER PAGAMENTOS
  // ===============================
  [BankProvider.BMP]: {
    provider: BankProvider.BMP,
    name: 'BMP',
    displayName: 'BMP - Banco Master',
    environments: {
      development: {
        name: 'development',
        apiUrl: 'http://localhost:3000',
        timeout: 30000
      },
      staging: {
        name: 'staging',
        apiUrl: 'https://api-bank.gruponexus.com.br',
        timeout: 20000
      },
      production: {
        name: 'production',
        apiUrl: 'https://api-bank.gruponexus.com.br',
        timeout: 15000
      }
    },
    features: [
      BankFeature.BALANCE,
      BankFeature.STATEMENT,
      BankFeature.PIX_SEND,
      BankFeature.PIX_RECEIVE,
      BankFeature.PIX_KEYS,
      BankFeature.TRANSFER,
      BankFeature.BOLETO,
      BankFeature.WEBHOOK
    ],
    defaultCredentials: {
      // BMP usa autenticação via headers customizados
    },
    rateLimit: {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      burstLimit: 10
    },
    customHeaders: {
      'User-Agent': 'TCR-BaaS-Frontend/1.0'
    }
  },

  // ===============================
  // BITSO - CRYPTO EXCHANGE
  // ===============================
  [BankProvider.BITSO]: {
    provider: BankProvider.BITSO,
    name: 'Bitso',
    displayName: 'Bitso - PIX & Crypto',
    environments: {
      development: {
        name: 'development',
        apiUrl: 'http://localhost:3000/api/bitso',
        timeout: 30000
      },
      staging: {
        name: 'staging',
        apiUrl: 'https://api-bank.gruponexus.com.br/api/bitso',
        timeout: 20000
      },
      production: {
        name: 'production',
        apiUrl: 'https://api-bank.gruponexus.com.br/api/bitso',
        timeout: 15000
      }
    },
    features: [
      BankFeature.BALANCE,
      BankFeature.STATEMENT,
      BankFeature.PIX_SEND,
      BankFeature.PIX_RECEIVE,
      BankFeature.PIX_KEYS,
      BankFeature.WEBHOOK
    ],
    defaultCredentials: {
      // Bitso usa API Key + Secret
    },
    rateLimit: {
      requestsPerMinute: 100,
      requestsPerHour: 2000,
      burstLimit: 20
    },
    customHeaders: {
      'User-Agent': 'TCR-BaaS-Frontend/1.0'
    }
  },

  // ===============================
  // BMP-531 - BANCO MASTER PAGAMENTOS 531
  // ===============================
  [BankProvider.BMP_531]: {
    provider: BankProvider.BMP_531,
    name: 'BMP-531',
    displayName: 'BMP 531 - Pagamentos',
    environments: {
      development: {
        name: 'development',
        apiUrl: 'http://localhost:3000',
        timeout: 30000
      },
      staging: {
        name: 'staging',
        apiUrl: 'https://api-bank.gruponexus.com.br',
        timeout: 20000
      },
      production: {
        name: 'production',
        apiUrl: 'https://api-bank.gruponexus.com.br',
        timeout: 15000
      }
    },
    features: [
      BankFeature.BALANCE,
      BankFeature.STATEMENT,
      BankFeature.PIX_SEND,
      BankFeature.PIX_RECEIVE,
      BankFeature.PIX_KEYS,
      BankFeature.TRANSFER,
      BankFeature.WEBHOOK
    ],
    defaultCredentials: {
      // BMP-531 usa autenticação similar ao BMP
    },
    rateLimit: {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      burstLimit: 10
    },
    customHeaders: {
      'User-Agent': 'TCR-BaaS-Frontend/1.0'
    }
  },

  // ===============================
  // FUTUROS BANCOS (TEMPLATES)
  // ===============================
  [BankProvider.BRADESCO]: {
    provider: BankProvider.BRADESCO,
    name: 'Bradesco',
    displayName: 'Banco Bradesco',
    environments: {
      development: {
        name: 'development',
        apiUrl: 'https://sandbox.bradesco.com.br',
        timeout: 30000
      },
      production: {
        name: 'production',
        apiUrl: 'https://api.bradesco.com.br',
        timeout: 15000
      }
    },
    features: [
      BankFeature.BALANCE,
      BankFeature.STATEMENT,
      BankFeature.PIX_SEND,
      BankFeature.PIX_RECEIVE,
      BankFeature.PIX_KEYS,
      BankFeature.TRANSFER,
      BankFeature.BOLETO
    ],
    defaultCredentials: {
      // Bradesco usa OAuth2
    },
    rateLimit: {
      requestsPerMinute: 30,
      requestsPerHour: 500
    }
  },

  [BankProvider.ITAU]: {
    provider: BankProvider.ITAU,
    name: 'Itau',
    displayName: 'Banco Itaú',
    environments: {
      development: {
        name: 'development',
        apiUrl: 'https://sandbox.itau.com.br',
        timeout: 30000
      },
      production: {
        name: 'production',
        apiUrl: 'https://api.itau.com.br',
        timeout: 15000
      }
    },
    features: [
      BankFeature.BALANCE,
      BankFeature.STATEMENT,
      BankFeature.PIX_SEND,
      BankFeature.PIX_RECEIVE,
      BankFeature.PIX_KEYS,
      BankFeature.TRANSFER,
      BankFeature.BOLETO
    ],
    defaultCredentials: {
      // Itaú usa certificado digital
    },
    rateLimit: {
      requestsPerMinute: 50,
      requestsPerHour: 800
    }
  },

  [BankProvider.SANTANDER]: {
    provider: BankProvider.SANTANDER,
    name: 'Santander',
    displayName: 'Banco Santander',
    environments: {
      development: {
        name: 'development',
        apiUrl: 'https://sandbox.santander.com.br',
        timeout: 30000
      },
      production: {
        name: 'production',
        apiUrl: 'https://api.santander.com.br',
        timeout: 15000
      }
    },
    features: [
      BankFeature.BALANCE,
      BankFeature.STATEMENT,
      BankFeature.PIX_SEND,
      BankFeature.PIX_RECEIVE,
      BankFeature.TRANSFER,
      BankFeature.BOLETO
    ],
    defaultCredentials: {},
    rateLimit: {
      requestsPerMinute: 40,
      requestsPerHour: 600
    }
  },

  [BankProvider.CAIXA]: {
    provider: BankProvider.CAIXA,
    name: 'Caixa',
    displayName: 'Caixa Econômica Federal',
    environments: {
      development: {
        name: 'development',
        apiUrl: 'https://sandbox.caixa.gov.br',
        timeout: 30000
      },
      production: {
        name: 'production',
        apiUrl: 'https://api.caixa.gov.br',
        timeout: 15000
      }
    },
    features: [
      BankFeature.BALANCE,
      BankFeature.STATEMENT,
      BankFeature.PIX_SEND,
      BankFeature.PIX_RECEIVE,
      BankFeature.PIX_KEYS,
      BankFeature.TRANSFER,
      BankFeature.BOLETO
    ],
    defaultCredentials: {},
    rateLimit: {
      requestsPerMinute: 20,
      requestsPerHour: 300
    }
  },

  [BankProvider.BB]: {
    provider: BankProvider.BB,
    name: 'BB',
    displayName: 'Banco do Brasil',
    environments: {
      development: {
        name: 'development',
        apiUrl: 'https://sandbox.bb.com.br',
        timeout: 30000
      },
      production: {
        name: 'production',
        apiUrl: 'https://api.bb.com.br',
        timeout: 15000
      }
    },
    features: [
      BankFeature.BALANCE,
      BankFeature.STATEMENT,
      BankFeature.PIX_SEND,
      BankFeature.PIX_RECEIVE,
      BankFeature.PIX_KEYS,
      BankFeature.TRANSFER,
      BankFeature.BOLETO
    ],
    defaultCredentials: {},
    rateLimit: {
      requestsPerMinute: 60,
      requestsPerHour: 1200
    }
  },

  [BankProvider.NUBANK]: {
    provider: BankProvider.NUBANK,
    name: 'Nubank',
    displayName: 'Nubank',
    environments: {
      development: {
        name: 'development',
        apiUrl: 'https://sandbox.nubank.com.br',
        timeout: 30000
      },
      production: {
        name: 'production',
        apiUrl: 'https://api.nubank.com.br',
        timeout: 15000
      }
    },
    features: [
      BankFeature.BALANCE,
      BankFeature.STATEMENT,
      BankFeature.PIX_SEND,
      BankFeature.PIX_RECEIVE,
      BankFeature.PIX_KEYS,
      BankFeature.TRANSFER
    ],
    defaultCredentials: {},
    rateLimit: {
      requestsPerMinute: 100,
      requestsPerHour: 2000
    }
  },

  [BankProvider.INTER]: {
    provider: BankProvider.INTER,
    name: 'Inter',
    displayName: 'Banco Inter',
    environments: {
      development: {
        name: 'development',
        apiUrl: 'https://sandbox.bancointer.com.br',
        timeout: 30000
      },
      production: {
        name: 'production',
        apiUrl: 'https://api.bancointer.com.br',
        timeout: 15000
      }
    },
    features: [
      BankFeature.BALANCE,
      BankFeature.STATEMENT,
      BankFeature.PIX_SEND,
      BankFeature.PIX_RECEIVE,
      BankFeature.PIX_KEYS,
      BankFeature.TRANSFER,
      BankFeature.BOLETO
    ],
    defaultCredentials: {},
    rateLimit: {
      requestsPerMinute: 80,
      requestsPerHour: 1500
    }
  },

  [BankProvider.C6]: {
    provider: BankProvider.C6,
    name: 'C6Bank',
    displayName: 'C6 Bank',
    environments: {
      development: {
        name: 'development',
        apiUrl: 'https://sandbox.c6bank.com.br',
        timeout: 30000
      },
      production: {
        name: 'production',
        apiUrl: 'https://api.c6bank.com.br',
        timeout: 15000
      }
    },
    features: [
      BankFeature.BALANCE,
      BankFeature.STATEMENT,
      BankFeature.PIX_SEND,
      BankFeature.PIX_RECEIVE,
      BankFeature.PIX_KEYS,
      BankFeature.TRANSFER
    ],
    defaultCredentials: {},
    rateLimit: {
      requestsPerMinute: 60,
      requestsPerHour: 1000
    }
  }
};

/**
 * Classe para gerenciar configurações dos bancos
 */
export class BankConfigManager {
  
  private static instance: BankConfigManager;
  private currentEnvironment: 'development' | 'staging' | 'production' = 'development';

  private constructor() {
    // 🔧 USAR PRODUCTION para alinhar com api.ts (que está configurado como production)
    this.currentEnvironment = 'production';
    console.log(`🔧 [BANK-CONFIG] Ambiente forçado para PRODUCTION (alinhado com api.ts): ${this.currentEnvironment}`);
  }

  /**
   * Singleton
   */
  public static getInstance(): BankConfigManager {
    if (!BankConfigManager.instance) {
      BankConfigManager.instance = new BankConfigManager();
    }
    return BankConfigManager.instance;
  }

  /**
   * Obtém configuração completa de um banco
   */
  public getBankConfig(
    provider: BankProvider,
    customCredentials?: BankCredentials,
    environment?: 'development' | 'staging' | 'production'
  ): BankConfig {
    const bankSettings = BANK_REGISTRY[provider];
    if (!bankSettings) {
      throw new Error(`Banco ${provider} não encontrado no registry`);
    }

    const env = environment || this.currentEnvironment;
    const envConfig = bankSettings.environments[env];
    if (!envConfig) {
      throw new Error(`Ambiente ${env} não configurado para ${provider}`);
    }

    return {
      provider: bankSettings.provider,
      name: bankSettings.name,
      displayName: bankSettings.displayName,
      apiUrl: envConfig.apiUrl,
      timeout: envConfig.timeout,
      features: bankSettings.features,
      credentials: {
        ...bankSettings.defaultCredentials,
        ...customCredentials
      },
      rateLimit: bankSettings.rateLimit,
      customHeaders: bankSettings.customHeaders
    };
  }

  /**
   * Lista todos os providers disponíveis
   */
  public getAvailableProviders(): BankProvider[] {
    return Object.keys(BANK_REGISTRY) as BankProvider[];
  }

  /**
   * Lista providers que suportam uma funcionalidade
   */
  public getProvidersByFeature(feature: BankFeature): BankProvider[] {
    return Object.values(BANK_REGISTRY)
      .filter(bank => bank.features.includes(feature))
      .map(bank => bank.provider);
  }

  /**
   * Verifica se um provider está disponível
   */
  public isProviderAvailable(provider: BankProvider): boolean {
    return provider in BANK_REGISTRY;
  }

  /**
   * Obtém informações básicas de um banco
   */
  public getBankInfo(provider: BankProvider) {
    const bankSettings = BANK_REGISTRY[provider];
    if (!bankSettings) return null;

    return {
      provider: bankSettings.provider,
      name: bankSettings.name,
      displayName: bankSettings.displayName,
      features: bankSettings.features
    };
  }

  /**
   * Define ambiente atual
   */
  public setEnvironment(env: 'development' | 'staging' | 'production'): void {
    this.currentEnvironment = env;
  }

  /**
   * Obtém ambiente atual
   */
  public getCurrentEnvironment(): string {
    return this.currentEnvironment;
  }



  /**
   * Detecta ambiente automaticamente
   */
  private detectEnvironment(): 'development' | 'staging' | 'production' {
    // Detectar via hostname ou variáveis de ambiente
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      
      if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
        return 'development';
      }
      
      if (hostname.includes('staging') || hostname.includes('dev')) {
        return 'staging';
      }
      
      return 'production';
    }

    // Server-side: usar variável de ambiente
    return (process.env.NODE_ENV as any) || 'development';
  }
}

/**
 * Instância singleton para uso global
 */
export const bankConfigManager = BankConfigManager.getInstance(); 