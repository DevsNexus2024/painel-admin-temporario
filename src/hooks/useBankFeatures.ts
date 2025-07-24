/**
 * 🏦 HOOK PARA VERIFICAR FEATURES DO BANCO ATIVO
 * 
 * Facilita a verificação de funcionalidades suportadas pelo banco atual
 * Usado para mostrar/esconder funcionalidades no frontend
 */

import { useState, useEffect } from 'react';
import { BankFeature, BankProvider } from '@/services/banking/types';
import { unifiedBankingService } from '@/services/banking';
import { bankConfigManager } from '@/services/banking/config/BankConfigs';

interface BankFeaturesState {
  provider: BankProvider | null;
  displayName: string;
  hasBalance: boolean;
  hasStatement: boolean;
  hasPixSend: boolean;
  hasPixReceive: boolean;
  hasPixKeys: boolean;
  hasQrCodePayment: boolean; // Funcionalidade específica para QR Code
  hasTransfer: boolean;
  hasBoleto: boolean;
  hasWebhook: boolean;
  features: BankFeature[];
  isLoading: boolean;
}

/**
 * Hook para verificar funcionalidades do banco ativo
 */
export function useBankFeatures(): BankFeaturesState {
  const [featuresState, setFeaturesState] = useState<BankFeaturesState>({
    provider: null,
    displayName: '',
    hasBalance: false,
    hasStatement: false,
    hasPixSend: false,
    hasPixReceive: false,
    hasPixKeys: false,
    hasQrCodePayment: false,
    hasTransfer: false,
    hasBoleto: false,
    hasWebhook: false,
    features: [],
    isLoading: true
  });

  const updateFeatures = () => {
    try {
      const activeAccount = unifiedBankingService.getActiveAccount();
      
      if (!activeAccount) {
        setFeaturesState(prev => ({
          ...prev,
          provider: null,
          displayName: '',
          isLoading: false
        }));
        return;
      }

      const bankInfo = bankConfigManager.getBankInfo(activeAccount.provider);
      
      if (!bankInfo) {
        setFeaturesState(prev => ({
          ...prev,
          provider: activeAccount.provider,
          displayName: activeAccount.displayName,
          isLoading: false
        }));
        return;
      }

      const features = bankInfo.features;
      
      // ⚠️ REGRAS ESPECÍFICAS PARA QR CODE:
      // - BMP: Suporta QR Code payment 
      // - Bitso: NÃO suporta QR Code payment (só envio por chave)
      const hasQrCodePayment = features.includes(BankFeature.PIX_RECEIVE) && 
                               activeAccount.provider !== BankProvider.BITSO;

      // ⚠️ REGRAS ESPECÍFICAS PARA CHAVES PIX:
      // - BMP: Suporta gerenciamento de chaves PIX
      // - Bitso: NÃO suporta gerenciamento de chaves PIX
      const hasPixKeysManagement = features.includes(BankFeature.PIX_KEYS) && 
                                   activeAccount.provider !== BankProvider.BITSO;

      setFeaturesState({
        provider: activeAccount.provider,
        displayName: activeAccount.displayName,
        hasBalance: features.includes(BankFeature.BALANCE),
        hasStatement: features.includes(BankFeature.STATEMENT),
        hasPixSend: features.includes(BankFeature.PIX_SEND),
        hasPixReceive: features.includes(BankFeature.PIX_RECEIVE),
        hasPixKeys: hasPixKeysManagement, // Usar regra específica
        hasQrCodePayment: hasQrCodePayment, // Usar regra específica
        hasTransfer: features.includes(BankFeature.TRANSFER),
        hasBoleto: features.includes(BankFeature.BOLETO),
        hasWebhook: features.includes(BankFeature.WEBHOOK),
        features,
        isLoading: false
      });

      console.log(`🏦 [useBankFeatures] Features atualizadas para ${activeAccount.displayName}:`, {
        provider: activeAccount.provider,
        hasQrCodePayment,
        hasPixKeys: hasPixKeysManagement,
        features: features
      });

    } catch (error) {
      console.error('🏦 [useBankFeatures] Erro ao atualizar features:', error);
      setFeaturesState(prev => ({
        ...prev,
        isLoading: false
      }));
    }
  };

  useEffect(() => {
    // Atualizar features na inicialização
    updateFeatures();

    // Verificar mudanças de conta periodicamente
    const interval = setInterval(updateFeatures, 2000);

    return () => clearInterval(interval);
  }, []);

  return featuresState;
}

/**
 * Hook simplificado para verificar uma feature específica
 */
export function useBankFeature(feature: BankFeature): boolean {
  const { features } = useBankFeatures();
  return features.includes(feature);
}

/**
 * Hook para verificar se é uma conta específica
 */
export function useIsBankProvider(provider: BankProvider): boolean {
  const { provider: currentProvider } = useBankFeatures();
  return currentProvider === provider;
} 