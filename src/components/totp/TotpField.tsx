import React, { useEffect, useState } from 'react';
import { setManualTotpCode } from '@/services/totpBridge';
import { ShieldCheck } from 'lucide-react';

/**
 * Campo de código TOTP integrado ao form (fica acima do botão de executar).
 * Escreve no engine (setManualTotpCode) e o fetchWithTotp anexa o header
 * `x-totp-code` na requisição. Limpa ao desmontar. O código é o mesmo do
 * autenticador independentemente do form, então um por card é suficiente.
 */
export const TotpField: React.FC<{ className?: string }> = ({ className }) => {
  const [code, setCode] = useState('');

  useEffect(() => () => setManualTotpCode(''), []);

  return (
    <div className={className}>
      <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
        <ShieldCheck className="h-4 w-4 text-orange-500" />
        Código TOTP
      </label>
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
        placeholder="6 dígitos do autenticador"
        className="w-full rounded-md border bg-background px-3 py-2 text-center text-base tracking-[0.3em] outline-none focus:ring-2 focus:ring-orange-500"
      />
    </div>
  );
};

export default TotpField;
