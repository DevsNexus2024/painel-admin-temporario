import React, { useState } from 'react';
import { setManualTotpCode } from '@/services/totpBridge';
import { ShieldCheck } from 'lucide-react';

/**
 * Campo fixo de código TOTP (canto inferior direito). O operador digita o código
 * de 6 dígitos do autenticador AQUI e executa qualquer PIX/permissão — o
 * fetchWithTotp anexa esse código no header `x-totp-code` de toda requisição.
 * Simples e sempre visível: sem depender de modal.
 */
export const TotpQuickField: React.FC = () => {
  const [code, setCode] = useState('');

  return (
    <div
      style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999 }}
      className="flex items-center gap-2 rounded-lg border bg-card/95 p-3 shadow-xl backdrop-blur"
    >
      <ShieldCheck className="h-5 w-5 text-orange-500" />
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Código TOTP
        </span>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 6);
            setCode(v);
            setManualTotpCode(v);
          }}
          placeholder="000000"
          className="w-24 rounded border bg-background px-2 py-1 text-center text-base tracking-[0.3em] outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>
    </div>
  );
};

export default TotpQuickField;
