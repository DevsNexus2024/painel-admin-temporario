import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { setTotpRequester } from '@/services/totpBridge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ShieldCheck } from 'lucide-react';

/**
 * TotpProvider — modal único, promise-based, para coletar o código TOTP antes
 * de ações sensíveis. As páginas só chamam:
 *
 *   const code = await requestTotp({ mode: 'user' });   // ou 'master'
 *   if (!code) return;                                   // usuário cancelou
 *   await algumServico.acao(payload, code);              // serviço seta x-totp-code
 *
 * Não injeta header sozinho — quem chama repassa o código ao serviço. Assim o
 * código só é pedido na ação que precisa (login tem campo próprio).
 */
type TotpMode = 'user' | 'master';

interface TotpRequestOptions {
  mode?: TotpMode;
  title?: string;
  description?: string;
  /** Mensagem de erro (ex.: re-tentativa após código inválido). */
  errorMessage?: string;
}

interface TotpContextValue {
  requestTotp: (opts?: TotpRequestOptions) => Promise<string | null>;
}

const TotpContext = createContext<TotpContextValue | null>(null);

export const useTotp = (): TotpContextValue => {
  const ctx = useContext(TotpContext);
  if (!ctx) throw new Error('useTotp deve ser usado dentro de <TotpProvider>');
  return ctx;
};

export const TotpProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [opts, setOpts] = useState<TotpRequestOptions>({});
  const resolverRef = useRef<((v: string | null) => void) | null>(null);

  const requestTotp = useCallback((options?: TotpRequestOptions) => {
    setOpts(options || {});
    setCode('');
    setOpen(true);
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  // Disponibiliza o prompt para a camada HTTP (fetchWithTotp) tratar 403 de TOTP.
  useEffect(() => {
    setTotpRequester(requestTotp);
    return () => setTotpRequester(null);
  }, [requestTotp]);

  const finish = useCallback((value: string | null) => {
    setOpen(false);
    setCode('');
    const resolve = resolverRef.current;
    resolverRef.current = null;
    if (resolve) resolve(value);
  }, []);

  const valid = /^\d{6}$/.test(code);
  const confirm = () => {
    if (valid) finish(code);
  };

  const isMaster = opts.mode === 'master';
  const title =
    opts.title ||
    (isMaster ? 'Código MASTER — operação crítica' : 'Confirmar com código');
  const description =
    opts.description ||
    (isMaster
      ? 'Esta operação crítica exige o código TOTP master.'
      : 'Digite o código de 6 dígitos do seu autenticador para confirmar.');

  return (
    <TotpContext.Provider value={{ requestTotp }}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) finish(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-orange-500" />
              {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="totp-prompt-input">Código (6 dígitos)</Label>
            <Input
              id="totp-prompt-input"
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirm();
              }}
              placeholder="000000"
              className="text-center text-lg tracking-[0.4em]"
            />
            {opts.errorMessage && (
              <p className="text-sm text-red-500">{opts.errorMessage}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => finish(null)}>
              Cancelar
            </Button>
            <Button onClick={confirm} disabled={!valid}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TotpContext.Provider>
  );
};
