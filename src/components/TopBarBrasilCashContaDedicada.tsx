import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Loader2, CheckCircle, AlertCircle, FileText, Banknote, Lock, ArrowDownCircle, ArrowUpCircle, AlertTriangle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import {
  CONTA_DEDICADA_BRASILCASH,
  contaEstaConfigurada,
  obterSaldoContaDedicada,
  rotuloConta,
  type ResultadoSaldo,
} from "@/services/brasilcash-conta-dedicada";

const CONTA = CONTA_DEDICADA_BRASILCASH;

/**
 * TopBar da conta BrasilCash dedicada.
 *
 * PORQUÊ não reusa `TopBarBrasilCashTcr`: aquele componente escreve o saldo
 * recebido pelo WebSocket da TCR (`newBalance`) por cima do estado. Numa conta de
 * cliente isso exibiria o saldo da TCR sob o nome do cliente — exatamente o que
 * esta tela não pode fazer. Aqui não há WebSocket e não há caminho de saldo.
 *
 * PORQUÊ o saldo é uma união discriminada e não `number`: enquanto não houver
 * como endereçar o saldo desta conta, NÃO existe número a exibir. Guardar 0 no
 * estado — como faz a TopBar da OTC no catch — deixa um zero armado atrás de um
 * `if`; qualquer mudança no render passaria a mostrar "R$ 0,00" como se fosse
 * saldo real. O estado de falha É o estado.
 */
export default function TopBarBrasilCashContaDedicada() {
  const [saldo, setSaldo] = useState<ResultadoSaldo>({
    status: 'indisponivel',
    motivo: 'Consultando…',
  });
  const [isLoading, setIsLoading] = useState(false);

  const configurada = contaEstaConfigurada(CONTA);

  const consultarSaldo = useCallback(() => {
    setIsLoading(true);
    setSaldo(obterSaldoContaDedicada(CONTA));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    consultarSaldo();
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
    <div className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
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

  const v = saldo.status === 'ok'
    ? {
        total: saldo.disponivelCentavos + saldo.bloqueadoCentavos + saldo.futuroCentavos,
        disponivel: saldo.disponivelCentavos,
        bloqueado: saldo.bloqueadoCentavos,
        futuro: saldo.futuroCentavos,
      }
    : { total: null, disponivel: null, bloqueado: null, futuro: null };

  return (
    <div className="sticky top-0 z-30 bg-background border-b border-border h-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-orange-600 shadow-xl">
            <Banknote className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <Banknote className="h-5 w-5 text-orange-500" />
              <h1 className="text-2xl font-bold text-foreground">
                BrasilCash → {rotuloConta(CONTA)}
              </h1>
              <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs font-medium">
                Banking
              </Badge>
              {saldo.status === 'ok'
                ? <CheckCircle className="h-4 w-4 text-green-500" />
                : <AlertCircle className="h-4 w-4 text-amber-500" />}
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground text-sm">Extrato da conta dedicada</p>
              {configurada && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-mono text-[10px]">Conta: {CONTA.referenciaConta}</span>
                  {CONTA.otcId && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-[10px]">OTC: {CONTA.otcId}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={consultarSaldo}
            disabled={isLoading}
            className="hover:bg-muted rounded-xl"
          >
            {isLoading
              ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              : <RefreshCcw className="h-4 w-4 text-muted-foreground" />}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
        <Card
          icone={<FileText className="h-[18px] w-[18px] text-[rgb(0,105,209)]" />}
          titulo="Total" cor="rgb(0,105,209)" valorCentavos={v.total}
        />
        <Card
          icone={<CheckCircle className="h-[18px] w-[18px] text-[rgb(56,209,0)]" />}
          titulo="Disponível" cor="rgb(56,209,0)" valorCentavos={v.disponivel}
        />
        <Card
          icone={<Lock className="h-[18px] w-[18px] text-[rgb(184,0,0)]" />}
          titulo="Bloqueado" cor="rgb(184,0,0)" valorCentavos={v.bloqueado}
        />
        <Card
          icone={<ArrowDownCircle className="h-[18px] w-[18px] text-[rgb(218,114,45)]" />}
          titulo="Depósito Pendente" cor="rgb(218,114,45)" valorCentavos={v.futuro}
        />
        <Card
          icone={<ArrowUpCircle className="h-[18px] w-[18px] text-[rgb(160,38,29)]" />}
          titulo="Saque Pendente" cor="rgb(160,38,29)" valorCentavos={null}
        />
      </div>
    </div>
  );
}
