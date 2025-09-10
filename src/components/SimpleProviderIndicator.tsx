/**
 * 🚨 INDICADOR SIMPLES DE PROVIDER
 * Só para verificar se está funcionando a sincronização
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useBankFeatures } from '@/hooks/useBankFeatures';

export default function SimpleProviderIndicator() {
  const bankFeatures = useBankFeatures();

  if (!bankFeatures.provider) {
    return (
      <div className="bg-red-100 border border-red-300 rounded-lg p-3 mb-4">
        <p className="text-red-800 text-sm font-medium">⚠️ Nenhum provider detectado</p>
      </div>
    );
  }

  return (
    <div className="bg-green-100 border border-green-300 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2">
        <span className="text-green-800 text-sm font-medium">✅ Provider ativo:</span>
        <Badge className={`${
          bankFeatures.provider === 'bitso' 
            ? 'bg-orange-100 text-orange-800' 
            : 'bg-blue-100 text-blue-800'
        }`}>
          {bankFeatures.provider.toUpperCase()}
        </Badge>
        <span className="text-green-700 text-xs">
          ({bankFeatures.displayName})
        </span>
      </div>
    </div>
  );
}

