import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCcw,
  Loader2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  FileText,
  Building2,
  Lock,
  DollarSign,
} from "lucide-react";
import {
  CONTA_DEDICADA_CORPX,
  contaEstaConfigurada,
  obterSaldoContaDedicada,
  rotuloConta,
  titularEstaPendente,
  type ResultadoSaldo,
} from "@/services/corpx-conta-dedicada";

const CONTA = CONTA_DEDICADA_CORPX;

/**
 * TopBar da conta CorpX dedicada do Edition.
 *
 * PORQUÊ não reusa `TopBarCorpX`: aquele componente lê a conta do
 * `CorpXContext` (o seletor global) e, no modo consolidado, SOMA o saldo de
 * todas as contas. Numa tela de cliente isso exibiria dinheiro de terceiros sob
 * o nome dele. Aqui a conta é fixa e não passa pelo seletor — o que também
 * mantém esta tela viva quando o Edition sair do seletor.
 *
 * PORQUÊ o saldo é uma união discriminada e não `number`: `consultarSaldoCorpX`
 * NUNCA lança — toda falha vira `{ erro: true, saldo: 0, ... }`. Guardar esse
 * objeto no estado e ler `.saldo` deixa um zero armado atrás de um `if`, e a
 * tela passa a exibir "R$ 0,00" como se fosse o saldo real do cliente. O estado
 * de falha É o estado.
 */
export default function TopBarCorpXContaDedicada() {
  const [saldo, setSaldo] = useState<ResultadoSaldo>({
    status: 'indisponivel',
    motivo: 'Consultando…',
  });
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const configurada = contaEstaConfigurada(CONTA);

  const consultarSaldo = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    const resultado = await obterSaldoContaDedicada(CONTA, { signal: controller.signal });
    if (controller.signal.aborted) return;
    setSaldo(resultado);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void consultarSaldo();
    return () => abortRef.current?.abort();
  }, [consultarSaldo]);

  const formatarBRL = (centavos: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);

  /** Um card. Sem saldo disponível, mostra travessão — nunca 0. */
  const Card = ({
    icone,
    titulo,
    cor,
    valorCentavos,
  }: {
    icone: React.ReactNode;
    titulo: string;
    cor: string;
    valorCentavos: number | null;
  }) => (
    <div className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200">
      <div className="flex items-center gap-2 mb-1">
        {icone}
        <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">{titulo}</span>
      </div>
      <div className="text-[1.3rem] lg:text-[1.5rem] font-bold mt-1 overflow-hidden" style={{ color: cor }}>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : valorCentavos === null ? (
          <span className="text-muted-foreground" title="Saldo indisponível para esta conta">—</span>
        ) : (
          <div className="whitespace-nowrap">{formatarBRL(valorCentavos)}</div>
        )}
      </div>
    </div>
  );

  const v =
    saldo.status === 'ok'
      ? {
          total: saldo.totalCentavos,
          disponivel: saldo.disponivelCentavos,
          bloqueado: saldo.bloqueadoCentavos,
        }
      : { total: null, disponivel: null, bloqueado: null };

  return (
    <div className="sticky top-0 z-30 bg-background border-b border-border h-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-purple-600 shadow-xl">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">
                CorpX → {rotuloConta(CONTA)}
              </h1>
              <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs font-medium">
                Banking
              </Badge>
              {saldo.status === 'ok' ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-500" />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground text-sm">Extrato da conta dedicada</p>
              {configurada && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {/* O titular bancário é DADO DA CONTA; o dono do saldo é o
                      cliente. Rotular os dois separadamente evita que o suporte
                      atribua o dinheiro à empresa que aparece no nome da conta. */}
                  <span>
                    Cliente: <span className="font-medium text-foreground">{rotuloConta(CONTA)}</span>
                  </span>
                  <span>•</span>
                  <span>
                    Titular da conta bancária:{' '}
                    {titularEstaPendente(CONTA) ? (
                      <span
                        className="font-medium text-amber-500"
                        title="Dado ainda não levantado. Não é o cliente — não presuma que sejam a mesma entidade."
                      >
                        não informado
                      </span>
                    ) : (
                      <span className="font-medium">{CONTA.titular.razaoSocial}</span>
                    )}
                  </span>
                  <span>•</span>
                  <span>CNPJ {CONTA.cnpj}</span>
                  {/* `vinculadoEm` está pendente: enquanto não for medido, a tela
                      não afirma nada sobre a data do vínculo. */}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void consultarSaldo()}
            disabled={isLoading}
            className="hover:bg-muted rounded-xl"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <RefreshCcw className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="ml-2 text-sm">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Falha de saldo é exibida, nunca substituída por zero. */}
      {saldo.status !== 'ok' && !isLoading && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-500">Não foi possível obter o saldo desta conta</p>
            <p className="text-muted-foreground mt-0.5">
              {saldo.motivo} O extrato abaixo não é afetado.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4">
        <Card
          icone={<FileText className="h-[18px] w-[18px] text-[rgb(147,51,234)]" />}
          titulo="Saldo"
          cor="rgb(147,51,234)"
          valorCentavos={v.total}
        />
        <Card
          icone={<DollarSign className="h-[18px] w-[18px] text-[rgb(56,209,0)]" />}
          titulo="Saldo Disponível"
          cor="rgb(56,209,0)"
          valorCentavos={v.disponivel}
        />
        <Card
          icone={<Lock className="h-[18px] w-[18px] text-[rgb(218,114,45)]" />}
          titulo="Saldo Bloqueado"
          cor="rgb(218,114,45)"
          valorCentavos={v.bloqueado}
        />
      </div>
    </div>
  );
}
