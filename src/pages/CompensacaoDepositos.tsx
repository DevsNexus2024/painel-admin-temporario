import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    AlertCircle,
    ArrowUpCircle,
    CheckCircle2,
    Clock,
    Filter,
    PlayCircle,
    RefreshCw,
    Search,
    Upload,
    XCircle,
    Loader2,
    BarChart2,
    FileText,
    Calendar as CalendarIcon,
    Mail,
    User,
    X,
    Edit
} from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatTimestamp } from "@/utils/date";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "primereact/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetFooter,
    SheetTitle,
    SheetClose,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from 'date-fns/locale';
import { PUBLIC_ENV } from '@/config/env';
import { TOKEN_STORAGE } from '@/config/api';

// Tipos que representam o modelo de dados da API
interface ApiDeposito {
    id: number;
    id_usuario: number;
    id_moeda: number;
    pix_transaction_id_brbtc: string | null;
    pix_userDocument: string | null;
    pix_transactionId: string | null;
    pix_movementId: string | null;
    pix_operationId: string | null;
    pix_uniqueId: string | null;
    pix_from_name: string | null;
    pix_from_userDocument: string | null;
    pix_from_bankNumber: string | null;
    pix_to_name: string | null;
    pix_to_accountNumber: string | null;
    pix_to_key: string | null;
    pix_identifier: string | null;
    pix_timestamp: string; // ISO Date String
    quantia: string;
    crypto_hash: string | null;
    status_deposito: 'processing' | 'error' | 'finished' | string; // Permitir outros status se a API retornar algo inesperado
    step: '01newdeposit' | '02internal_transfer_b8cash' | '03bolsao_deposit' | '04internal_transfer_caas' | string; // Permitir outros steps
    webhook_payload: string | null;
    id_deposito_caas_tcr: string | null;
    id_caas_tcr_x_user: string | null;
    id_internal_b8cash: string | null;
    createdAt: string; // ISO Date String
    created_at: string; // ISO Date String
    // Campos adicionais podem existir
    errorMessage?: string; // Adicionado para compatibilidade, mas não presente na API diretamente
    errorTimestamp?: number; // Adicionado para compatibilidade
}

interface ApiTransacaoNaoRegistrada {
    type: string;
    event: string;
    side: string;
    amount: string;
    fee: string;
    userDocument: string;
    id: string;
    transactionId: string;
    movementId: string;
    operationId: string;
    uniqueId: string | null;
    from: {
        name: string;
        userDocument: string;
        bankNumber: string | null;
        bankISPB: string;
    };
    to: {
        name: string;
        agencyNumber: string;
        agencyDigit: string;
        accountNumber: string;
        accountDigit: string;
        bankNumber: string;
        userDocument: string;
        key: string;
    };
    description: string | null;
    identifier: string;
    balanceAfter: string;
    createdTimestamp: number; // Unix Timestamp seconds
}

interface ApiResponse {
    sucesso: boolean;
    mensagem: string;
    resultado: {
        depositosComErro: ApiDeposito[];
        transacoesNaoRegistradas: ApiTransacaoNaoRegistrada[];
    };
}

// Tipos para status e etapas do depósito
type DepositoStatus = 'processing' | 'error' | 'finished';
type ProcessStep = '01newdeposit' | '02internal_transfer_b8cash' | '03bolsao_deposit' | '04internal_transfer_caas';

// Tipos que representam o modelo de dados da UI (mapeado da API)
interface Deposito {
    id: string; // Mapeado de ApiDeposito.id (convertido para string) ou ApiTransacaoNaoRegistrada.id/transactionId
    userId: string; // Mapeado de ApiDeposito.id_usuario (convertido para string) ou ApiTransacaoNaoRegistrada.identifier (extrair ID do usuário?)
    userName: string; // Mapeado de ApiDeposito.pix_from_name ou ApiTransacaoNaoRegistrada.from.name
    amount: string; // Mapeado de ApiDeposito.quantia ou ApiTransacaoNaoRegistrada.amount (ambos precisam de parseFloat)
    createdAt: number; // Timestamp numérico (convertido de ApiDeposito.createdAt ou ApiTransacaoNaoRegistrada.createdTimestamp * 1000)
    originalTimestamp?: string | number | null; // Timestamp original da API (string ISO ou número Unix)
    status: DepositoStatus | 'pending_registration' | 'unknown'; // Mapeado de ApiDeposito.status_deposito ou 'pending_registration'/'unknown' para transações
    step: ProcessStep | 'unknown_step'; // Mapeado de ApiDeposito.step ou 'unknown_step' para transações
    pixKey: string | null; // Mapeado de ApiDeposito.pix_to_key ou ApiTransacaoNaoRegistrada.to.key
    pixKeyType: string | null; // Inferir ou deixar null
    txId: string | null; // Mapeado de ApiDeposito.pix_transactionId ou ApiTransacaoNaoRegistrada.transactionId
    tipoRegistro: 'depositoComErro' | 'transacaoNaoRegistrada'; // Indica a origem do dado
    // Campos adicionais relevantes
    errorMessage?: string; // Mapeado de ApiDeposito.errorMessage (se houver) ou gerado internamente
    errorTimestamp?: number; // Mapeado de ApiDeposito.errorTimestamp (se houver)
    lastUpdated?: number; // Usar createdAt por enquanto
    b8cashTransactionId?: string | null; // Mapeado de ApiDeposito.id_internal_b8cash
    caasTransactionId?: string | null; // Mapeado de ApiDeposito.id_deposito_caas_tcr
    comprovante?: string; // Mantido para upload
    rawData?: ApiDeposito | ApiTransacaoNaoRegistrada; // Guardar dados brutos
}

// Mock de dados - SERÁ REMOVIDO/SUBSTITUÍDO PELA API
const mockDepositos: Deposito[] = [
    // ... Mocks serão removidos
];

// Estilos Padrão para Toasts
const toastStyles = {
    success: {
        backgroundColor: 'hsl(140 65% 25%)', // Dark Green
        color: 'hsl(140 15% 95%)', // Light Greenish White
        border: '1px solid hsl(140 50% 35%)'
    },
    error: {
        backgroundColor: 'hsl(0 70% 30%)', // Dark Red
        color: 'hsl(0 15% 95%)', // Light Reddish White
        border: '1px solid hsl(0 60% 40%)'
    },
    warning: {
        backgroundColor: 'hsl(38 80% 30%)', // Dark Amber/Orange
        color: 'hsl(38 15% 95%)', // Light Orangey White
        border: '1px solid hsl(38 70% 40%)'
    },
    info: {
        backgroundColor: 'hsl(210 50% 30%)', // Dark Blue
        color: 'hsl(210 15% 95%)', // Light Bluish White
        border: '1px solid hsl(210 40% 40%)'
    }
};

// Função de serviço para buscar dados da API - Modificada para aceitar datas opcionais
async function buscarDepositosComErro(startDate?: string, endDate?: string): Promise<Deposito[]> {
    const API_URL = `${PUBLIC_ENV.DIAGNOSTICO_API_URL}/depositos/consultar-erros`;
    const ACCOUNT_NUMBER = PUBLIC_ENV.ACCOUNT_NUMBER_B8_TCR;
    // ✅ Credenciais agora são gerenciadas pelo backend via JWT
    const USER_TOKEN = TOKEN_STORAGE.get(); // Token do usuário logado

    const url = new URL(API_URL);
    url.searchParams.append('accountNumber', ACCOUNT_NUMBER);
    // Adiciona os parâmetros de data apenas se forem fornecidos
    if (startDate) {
        url.searchParams.append('startDate', startDate);
    }
    if (endDate) {
        url.searchParams.append('endDate', endDate);
    }

    try {

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-api-enterprise': 'tcr',
                'Authorization': `Bearer ${USER_TOKEN}`,
                'xPassRouteTCR': 'ISRVdeWTZ5jYFKJQytjH9ZylF1ZrwhTdrrdKY4uFqXm041XIL3aVjCwojSH1EeYbUOQjPx0aO',
                // Backend adiciona automaticamente: x-secret-admin-hd, Token-Cryp-Access, Token-Whitelabel
                'User-Agent': PUBLIC_ENV.APP_USER_AGENT
            },
        });

        if (!response.ok) {
            const errorData = await response.text();
            // console.error("Erro na resposta da API:", response.status, "Detalhes omitidos por segurança");
            throw new Error(`Erro ao buscar depósitos: ${response.statusText}`);
        }

        const data: ApiResponse = await response.json();

        // Log dos dados brutos da API
        // Debug removido por performance

        if (!data.sucesso) {
            // console.error("API retornou erro:", data.mensagem);
            throw new Error(data.mensagem || "API retornou sucesso=false");
        }

        // Mapeamento dos Depósitos com Erro
        const depositosMapeados: Deposito[] = (data.resultado?.depositosComErro || []).map((apiDep): Deposito => {
            let status: Deposito['status'] = 'unknown';
            if (['processing', 'error', 'finished'].includes(apiDep.status_deposito)) {
                status = apiDep.status_deposito as DepositoStatus;
            } else if (apiDep.status_deposito) {

            }

            let step: Deposito['step'] = 'unknown_step';
            if (['01newdeposit', '02internal_transfer_b8cash', '03bolsao_deposit', '04internal_transfer_caas'].includes(apiDep.step)) {
                step = apiDep.step as ProcessStep;
            } else if (apiDep.step) {

            }

            const createdAtTimestamp = new Date(apiDep.createdAt || apiDep.created_at).getTime();

            // Tenta extrair o operationId do webhook se disponível
            let operationIdFromWebhook: string | null = null;
            if (apiDep.webhook_payload) {
                try {
                    const payload = JSON.parse(apiDep.webhook_payload);
                    operationIdFromWebhook = payload?.operationId || null;
                } catch (e) {
                    // Ignora erro de parse
                }
            }

            return {
                id: String(apiDep.id),
                userId: String(apiDep.id_usuario),
                userName: apiDep.pix_from_name || 'Nome Indisponível',
                amount: String(parseFloat(apiDep.quantia || '0')),
                createdAt: createdAtTimestamp,
                originalTimestamp: apiDep.createdAt || apiDep.created_at || null,
                status: status,
                step: step,
                pixKey: apiDep.pix_to_key || null,
                pixKeyType: null, // Inferir se necessário
                // Usar operationId do webhook se existir, senão o do payload principal, senão null
                txId: operationIdFromWebhook || apiDep.pix_operationId || apiDep.pix_transactionId || null,
                tipoRegistro: 'depositoComErro',
                errorMessage: apiDep.errorMessage, // Mapear se existir na API futuramente
                errorTimestamp: apiDep.errorTimestamp, // Mapear se existir
                lastUpdated: createdAtTimestamp,
                b8cashTransactionId: apiDep.id_internal_b8cash,
                caasTransactionId: apiDep.id_deposito_caas_tcr,
                rawData: apiDep,
            };
        });

        // Mapeamento das Transações Não Registradas
        const transacoesMapeadas: Deposito[] = (data.resultado?.transacoesNaoRegistradas || []).map((apiTx): Deposito => {
            const userIdMatch = apiTx.identifier?.match(/xU(\d+)$/);
            const userId = userIdMatch ? userIdMatch[1] : 'Desconhecido';
            const createdAtTimestamp = apiTx.createdTimestamp ? apiTx.createdTimestamp * 1000 : Date.now();

            return {
                id: apiTx.id || apiTx.transactionId, // Usar ID ou transactionId como identificador único
                userId: userId,
                userName: apiTx.from?.name || 'Nome Indisponível',
                amount: String(parseFloat(apiTx.amount || '0')),
                createdAt: createdAtTimestamp,
                originalTimestamp: apiTx.createdTimestamp || null,
                status: 'pending_registration', // Status específico para essas transações
                step: 'unknown_step', // Etapa não aplicável ou desconhecida
                pixKey: apiTx.to?.key || null,
                pixKeyType: null, // Inferir se necessário
                txId: apiTx.transactionId || apiTx.operationId || null,
                tipoRegistro: 'transacaoNaoRegistrada',
                lastUpdated: createdAtTimestamp,
                errorMessage: "Transação PIX recebida mas não registrada no sistema de depósitos.",
                rawData: apiTx,
            };
        });

        // Unificar e ordenar por data (mais recentes primeiro)
        const todosRegistros = [...depositosMapeados, ...transacoesMapeadas];
        todosRegistros.sort((a, b) => b.createdAt - a.createdAt);

        // Log dos dados mapeados antes de retornar
              // Debug de mapeamento removido por performance

        return todosRegistros;

    } catch (error) {
        // console.error("Falha ao buscar ou processar depósitos:", error);
        if (error instanceof Error) {
            toast.error(`Erro ao buscar depósitos: ${error.message}`, {
                style: toastStyles.error
            });
        } else {
            toast.error("Ocorreu um erro desconhecido ao buscar depósitos.", {
                style: toastStyles.error
            });
        }
        return []; // Retorna array vazio em caso de erro
    }
}

// Componente para o status do depósito
const DepositoStatusBadge = ({ status }: { status: Deposito['status'] }) => {
    switch (status) {
        case 'processing':
            return (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/10 border-blue-500/20 rounded-full">
                    <Clock className="w-3 h-3 mr-1" />
                    Processando
                </Badge>
            );
        case 'error':
            return (
                <Badge variant="outline" className="bg-red-500/10 text-red-500 hover:bg-red-500/10 border-red-500/20 rounded-full">
                    <XCircle className="w-3 h-3 mr-1" />
                    Erro
                </Badge>
            );
        case 'finished':
            return (
                <Badge variant="outline" className="bg-green-500/10 text-green-500 hover:bg-green-500/10 border-green-500/20 rounded-full">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Finalizado
                </Badge>
            );
        case 'pending_registration':
            return (
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/10 border-yellow-500/20 rounded-full">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Pendente Registro
                </Badge>
            );
        case 'unknown':
        default:
            return (
                <Badge variant="secondary" className="rounded-full">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Desconhecido
                </Badge>
            );
    }
};

// Componente para indicar em qual step o depósito está
const DepositoStepBadge = ({ step }: { step: Deposito['step'] }) => {
    // Verificar se o step é válido antes de tentar acessar stepMap
    if (step === 'unknown_step') {
        return (
            <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-400/20 rounded-full">
                Etapa Desconhecida
            </Badge>
        );
    }

    const stepMap: Record<ProcessStep, { label: string; color: string }> = {
        '01newdeposit': {
            label: 'Depósito PIX',
            color: 'bg-purple-500/10 text-purple-400 border-purple-400/20'
        },
        '02internal_transfer_b8cash': {
            label: 'Transferência B8Cash',
            color: 'bg-orange-500/10 text-orange-400 border-orange-400/20'
        },
        '03bolsao_deposit': {
            label: 'Depósito BRBTC',
            color: 'bg-yellow-500/10 text-yellow-400 border-yellow-400/20'
        },
        '04internal_transfer_caas': {
            label: 'Transferência CAAS',
            color: 'bg-teal-500/10 text-teal-400 border-teal-400/20'
        }
    };

    const stepInfo = stepMap[step];
    return (
        <Badge variant="outline" className={`${stepInfo.color} rounded-full`}>
            {stepInfo.label}
        </Badge>
    );
};

// Componente para mostrar o progresso do depósito - melhorando o visual
function DepositoProgressoIndicator({ step }: { step: Deposito['step'] }) {
    // Mapeamento dos valores de step com prefixo para o tipo ProcessStep
    const stepMapping: Record<ProcessStep, ProcessStep> = {
        '01newdeposit': '01newdeposit',
        '02internal_transfer_b8cash': '02internal_transfer_b8cash',
        '03bolsao_deposit': '03bolsao_deposit',
        '04internal_transfer_caas': '04internal_transfer_caas'
    };

    // Lidar com 'unknown_step'
    if (step === 'unknown_step') {
        // Você pode retornar um indicador de progresso vazio ou com um estado específico
        return (
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                (Progresso indisponível)
            </div>
        );
    }

    const processStep = stepMapping[step];
    const steps: ProcessStep[] = ["01newdeposit", "02internal_transfer_b8cash", "03bolsao_deposit", "04internal_transfer_caas"];
    const currentIndex = steps.indexOf(processStep);

    return (
        <div className="flex items-center gap-1 mt-2">
            {steps.map((s, index) => (
                <div key={s} className="flex items-center">
                    <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm
                        ${index <= currentIndex
                                ? index === currentIndex
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-orange-500 text-white'
                                : 'bg-muted text-muted-foreground'}`}
                    >
                        {index + 1}
                    </div>
                    {index < steps.length - 1 && (
                        <div
                            className={`h-1 w-6 ${index < currentIndex ? 'bg-orange-500' : 'bg-muted'}`}
                        ></div>
                    )}
                </div>
            ))}
        </div>
    );
}

// Componente para editar depósito
function DepositoEdicaoModal({
    deposito,
    isOpen,
    onClose,
    onSave,
    isSaving
}: {
    deposito: Deposito | null,
    isOpen: boolean,
    onClose: () => void,
    onSave: (depositoId: string, novoUserId: string, novoStatus: string, novaEtapa: string) => void,
    isSaving: boolean
}) {
    const [novoUserId, setNovoUserId] = useState("");
    const [novoStatus, setNovoStatus] = useState("");
    const [novaEtapa, setNovaEtapa] = useState("");
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    // Resetar campos quando o modal abrir com um novo depósito
    useEffect(() => {
        if (deposito && isOpen) {
            setNovoUserId(deposito.userId);
            setNovoStatus(deposito.status);
            setNovaEtapa(deposito.step);
        }
    }, [deposito, isOpen]);

    const handleSave = () => {
        if (!deposito) return;
        
        // Validações básicas
        if (!novoUserId.trim()) {
            toast.error("ID do usuário é obrigatório", { style: toastStyles.error });
            return;
        }

        if (!novoStatus) {
            toast.error("Status é obrigatório", { style: toastStyles.error });
            return;
        }

        if (!novaEtapa) {
            toast.error("Etapa é obrigatória", { style: toastStyles.error });
            return;
        }

        // Mostrar modal de confirmação
        setShowConfirmDialog(true);
    };

    const handleConfirmSave = () => {
        if (!deposito) return;
        setShowConfirmDialog(false);
        onSave(deposito.id, novoUserId, novoStatus, novaEtapa);
    };

    const handleCancelConfirm = () => {
        setShowConfirmDialog(false);
    };

    const handleClose = () => {
        if (!isSaving) {
            onClose();
        }
    };

    if (!deposito) return null;

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md bg-[#1e1e1e] border-[#333]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Edit className="h-5 w-5" />
                        Editar Depósito {deposito.id}
                    </DialogTitle>
                    <DialogDescription>
                        Altere os dados do depósito conforme necessário. Tenha cuidado ao modificar informações críticas.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                    {/* ID do Usuário */}
                    <div className="space-y-2">
                        <Label htmlFor="novo-user-id">ID do Usuário</Label>
                        <Input
                            id="novo-user-id"
                            type="number"
                            value={novoUserId}
                            onChange={(e) => setNovoUserId(e.target.value)}
                            className="bg-[#121212] border-[#333]"
                            disabled={isSaving}
                            placeholder="Digite o novo ID do usuário"
                        />
                        <p className="text-xs text-muted-foreground">
                            Atual: {deposito.userId} ({deposito.userName})
                        </p>
                    </div>

                    {/* Status */}
                    <div className="space-y-2">
                        <Label htmlFor="novo-status">Status</Label>
                        <Select
                            value={novoStatus}
                            onValueChange={setNovoStatus}
                            disabled={isSaving}
                        >
                            <SelectTrigger className="bg-[#121212] border-[#333]">
                                <SelectValue placeholder="Selecione o status" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1e1e1e] border-[#333]">
                                <SelectItem value="processing">processing</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Etapa */}
                    <div className="space-y-2">
                        <Label htmlFor="nova-etapa">Etapa</Label>
                        <Select
                            value={novaEtapa}
                            onValueChange={setNovaEtapa}
                            disabled={isSaving}
                        >
                            <SelectTrigger className="bg-[#121212] border-[#333]">
                                <SelectValue placeholder="Selecione a etapa" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1e1e1e] border-[#333]">
                                <SelectItem value="01newdeposit">01newdeposit</SelectItem>
                                <SelectItem value="02internal_transfer_b8cash">02internal_transfer_b8cash</SelectItem>
                                <SelectItem value="03bolsao_deposit">03bolsao_deposit</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Aviso para mudanças críticas */}
                    {(novoStatus !== deposito.status || novaEtapa !== deposito.step) && (
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-yellow-500" />
                                <span className="text-sm text-yellow-500 font-medium">Atenção</span>
                            </div>
                            <p className="text-xs text-yellow-500 mt-1">
                                Você está alterando informações críticas do depósito. Certifique-se de que as mudanças estão corretas.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        disabled={isSaving}
                        className="border-[#333] hover:bg-[#333]"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-primary hover:bg-primary/90"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            "Salvar Alterações"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>

            {/* Modal de Confirmação */}
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogContent className="sm:max-w-md bg-[#1e1e1e] border-[#333]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-yellow-500">
                            <AlertCircle className="h-5 w-5" />
                            Confirmar Alterações
                        </DialogTitle>
                        <DialogDescription className="text-red-400">
                            ⚠️ <strong>ATENÇÃO:</strong> Esta ação não pode ser revertida!
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4">
                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-md">
                            <h4 className="text-sm font-medium text-red-400 mb-2">Alterações que serão aplicadas:</h4>
                            <div className="space-y-1 text-sm">
                                {novoUserId !== deposito?.userId && (
                                    <p>• <strong>ID do Usuário:</strong> {deposito?.userId} → {novoUserId}</p>
                                )}
                                {novoStatus !== deposito?.status && (
                                    <p>• <strong>Status:</strong> {deposito?.status} → {novoStatus}</p>
                                )}
                                {novaEtapa !== deposito?.step && (
                                    <p>• <strong>Etapa:</strong> {deposito?.step} → {novaEtapa}</p>
                                )}
                            </div>
                        </div>
                        
                        <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
                            <p className="text-sm text-yellow-500">
                                <strong>Importante:</strong> Após confirmar, essas alterações serão permanentes e não poderão ser desfeitas.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancelConfirm}
                            disabled={isSaving}
                            className="border-[#333] hover:bg-[#333]"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            onClick={handleConfirmSave}
                            disabled={isSaving}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                "Confirmar Alterações"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
}

// Componente para exibir o modal de detalhe do depósito
function DepositoDetalhes({
    deposito,
    onClose,
    onReprocessar,
    onUploadComprovante,
    reprocessando
}: {
    deposito: Deposito,
    onClose: () => void,
    onReprocessar: (id: string) => void,
    onUploadComprovante: (id: string, file: File) => void,
    reprocessando: boolean
}) {
    const [dialogOpen, setDialogOpen] = useState(false);

    // Verifica se podemos reprocessar (não é transação não registrada)
    const canReprocess = deposito.tipoRegistro === 'depositoComErro';
    // Verifica se podemos fazer upload (não é transação não registrada)
    const canUpload = deposito.tipoRegistro === 'depositoComErro';

    const handleReprocessar = () => {
        onReprocessar(deposito.id);
        setDialogOpen(false);
    };

    return (
        <div className="space-y-6">
            {/* Seção de progresso */}
            <div>
                <h4 className="text-sm font-medium mb-3">Progresso do Depósito</h4>
                <DepositoProgressoIndicator step={deposito.step} />
            </div>

            {/* Informações detalhadas do depósito */}
            <div className="space-y-4">
                <h4 className="text-sm font-medium">Detalhes</h4>
                <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <User className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Usuário</p>
                                <p className="text-sm">{deposito.userName}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <Mail className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Chave PIX</p>
                                <p className="text-sm">{deposito.pixKey} ({deposito.pixKeyType})</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">ID Transação PIX</p>
                                <p className="text-sm font-mono text-xs">{deposito.txId || "-"}</p>
                            </div>
                        </div>
                    </div>

                    {deposito.b8cashTransactionId && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">ID B8Cash</p>
                                    <p className="text-sm font-mono text-xs">{deposito.b8cashTransactionId}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {deposito.caasTransactionId && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">ID CAAS</p>
                                    <p className="text-sm font-mono text-xs">{deposito.caasTransactionId}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Exibir mensagem de erro se houver */}
            {deposito.errorMessage && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-md">
                    <Label className="text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        Mensagem de Erro
                    </Label>
                    <div className="text-sm text-red-500 mt-1">{deposito.errorMessage}</div>
                    {deposito.errorTimestamp && (
                        <div className="text-xs text-red-400 mt-1">
                            Em {formatTimestamp(deposito.errorTimestamp)}
                        </div>
                    )}
                </div>
            )}

            <Separator />

            {/* Seção de ações */}
            <div className="space-y-4">
                <h4 className="text-sm font-medium">Ações</h4>

                <div className="space-y-4">
                    <div className="w-full items-center gap-1.5">
                        <Label htmlFor={`comprovante-${deposito.id}`} className={cn("mb-2 block", !canUpload && "text-muted-foreground")}>Upload de Comprovante</Label>
                        <Input
                            id={`comprovante-${deposito.id}`}
                            type="file"
                            accept="image/jpeg,image/png,application/pdf"
                            className="cursor-pointer bg-[#121212] border-[#333]"
                            onChange={(e) => {
                                if (canUpload && e.target.files && e.target.files[0]) {
                                    const file = e.target.files[0];
                                    onUploadComprovante(deposito.id, file);
                                }
                            }}
                            disabled={!canUpload || reprocessando}
                        />
                        {!canUpload && <p className="text-xs text-muted-foreground mt-1">Upload não disponível para este tipo de registro.</p>}
                    </div>
                </div>

                <Button
                    variant="outline"
                    className="w-full mt-4 border-[#333] hover:bg-[#333] hover:text-white h-10"
                    onClick={() => setDialogOpen(true)}
                    disabled={!canReprocess || reprocessando}
                >
                    <ArrowUpCircle className="mr-2 h-4 w-4" />
                    Reprocessar Depósito
                </Button>
                {!canReprocess && <p className="text-xs text-muted-foreground mt-1 text-center">Reprocessamento não disponível para este tipo de registro.</p>}

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Reprocessar depósito</DialogTitle>
                            <DialogDescription>
                                Tem certeza que deseja reprocessar este depósito manualmente?
                                Esta ação tentará retomar o fluxo a partir da etapa atual.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="sm:justify-start">
                            <Button
                                type="button"
                                variant="default"
                                onClick={handleReprocessar}
                                disabled={reprocessando}
                            >
                                {reprocessando ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Reprocessando...
                                    </>
                                ) : (
                                    "Confirmar Reprocessamento"
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDialogOpen(false)}
                                disabled={reprocessando}
                            >
                                Cancelar
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}

// Componente de Tabela de Depósitos 
function TabelaDepositos({
    depositos,
    loading,
    onViewDetails,
    onReprocessar,
    onUploadComprovante,
    onEdit,
    reprocessando
}: {
    depositos: Deposito[],
    loading: boolean,
    onViewDetails: (deposito: Deposito) => void,
    onReprocessar: (id: string) => void,
    onUploadComprovante: (id: string, file: File) => void,
    onEdit: (deposito: Deposito) => void,
    reprocessando: boolean
}) {
    const [selectedDeposit, setSelectedDeposit] = useState<Deposito | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Dados recebidos pela tabela

    const handleViewDetails = (deposito: Deposito) => {
        setSelectedDeposit(deposito);
        setDrawerOpen(true);
        onViewDetails(deposito);
    };

    const closeDrawer = () => {
        setDrawerOpen(false);
        setTimeout(() => setSelectedDeposit(null), 300); // Limpar dados após animação fechar
    };

    if (loading) {
        return (
            <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                        <Skeleton className="h-12 w-full" />
                    </div>
                ))}
            </div>
        );
    }

    if (depositos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="rounded-full bg-primary/10 p-3 mb-4">
                    <AlertCircle className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Nenhum depósito encontrado</h3>
                <p className="text-sm text-muted-foreground mt-2">
                    Não há depósitos pendentes com os filtros selecionados.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="overflow-hidden">
                <Table className="[&_tr:not(:first-child):not(:last-child)_td]:border-0 [&_tr:last-child_td]:border-0 [&_tr_th]:border-0 [&_tr]:border-0">
                    <TableHeader>
                        <TableRow className="bg-[#121212] border-b border-[#333]">
                            <TableHead>ID</TableHead>
                            <TableHead>Usuário</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Etapa</TableHead>
                            <TableHead className="text-right w-32">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {depositos.map((deposito, index) => {
                            // Log para cada item antes de renderizar


                            let formattedValor = "R$ 0,00";
                            try {
                                // Garantir que amount é um número antes de formatar
                                const amountValue = parseFloat(deposito.amount);
                                if (!isNaN(amountValue)) {
                                    formattedValor = new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL'
                                    }).format(amountValue);
                                } else {
                                    // console.warn(`Valor inválido para formatar no depósito ${deposito.id}:`, deposito.amount);
                                }
                            } catch (error) {
                                // console.error(`Erro ao formatar valor do depósito ${deposito.id}:`, error);
                            }

                            let formattedData = "Data inválida";
                            try {
                                // Garantir que createdAt é um timestamp válido
                                if (typeof deposito.createdAt === 'number' && !isNaN(deposito.createdAt)) {
                                    formattedData = new Date(deposito.createdAt).toLocaleDateString('pt-BR');
                                } else {
                                    // console.warn(`Timestamp inválido para formatar no depósito ${deposito.id}:`, deposito.createdAt);
                                }
                            } catch (error) {
                                // console.error(`Erro ao formatar data do depósito ${deposito.id}:`, error);
                            }

                            // Log antes de chamar os Badges
                            // console.log(` > Status para Badge: ${deposito.status}, Step para Badge: ${deposito.step}`);

                            return (
                                <TableRow key={deposito.id} className={`border-b border-[#333] ${index % 2 === 0 ? 'bg-[#1a1a1a]' : 'bg-[#141414]'}`}>
                                    <TableCell className="font-mono text-xs">{deposito.id}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-sm">{deposito.userName}</span>
                                            <span className="text-xs text-muted-foreground">ID: {deposito.userId}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{formattedValor}</TableCell>
                                    <TableCell>{formattedData}</TableCell>
                                    <TableCell><DepositoStatusBadge status={deposito.status} /></TableCell>
                                    <TableCell>{DepositoStepBadge({ step: deposito.step })}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex gap-1 justify-end">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleViewDetails(deposito)}
                                            >
                                                Detalhes
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onEdit(deposito)}
                                                className="text-blue-400 hover:text-blue-300"
                                            >
                                                <Edit className="h-4 w-4 mr-1" />
                                                Editar
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetContent side="right" className="w-[380px] max-w-[380px] p-0 bg-[#121212] border-l border-[#222] shadow-lg overflow-hidden flex flex-col">
                    {selectedDeposit && (
                        <>
                            <SheetHeader className="border-b border-[#222] p-4 shrink-0 space-y-3">
                                <div className="flex justify-between items-start">
                                    <SheetTitle className="text-lg">Depósito {selectedDeposit.id}</SheetTitle>
                                </div>
                                <div className="flex flex-wrap gap-2 items-center">
                                    <DepositoStatusBadge status={selectedDeposit.status} />
                                    <DepositoStepBadge step={selectedDeposit.step} />
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Criado em {new Date(selectedDeposit.createdAt).toLocaleString('pt-BR', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </p>
                                <p className="text-xs text-muted-foreground/70 font-mono">
                                    {(() => {
                                        let specificTimestamp: string | number | null = null;
                                        const rawData = selectedDeposit.rawData;

                                        if (selectedDeposit.tipoRegistro === 'transacaoNaoRegistrada' && rawData && 'createdTimestamp' in rawData) {
                                            specificTimestamp = (rawData as ApiTransacaoNaoRegistrada).createdTimestamp;
                                        } else if (selectedDeposit.tipoRegistro === 'depositoComErro' && rawData && 'webhook_payload' in rawData) {
                                            const payloadString = (rawData as ApiDeposito).webhook_payload;
                                            if (payloadString) {
                                                try {
                                                    const payload = JSON.parse(payloadString);
                                                    if (payload && typeof payload.createdTimestamp !== 'undefined') {
                                                        specificTimestamp = payload.createdTimestamp;
                                                    } else {
                                                        // console.warn("Timestamp não encontrado no webhook_payload", payload);
                                                    }
                                                } catch (e) {
                                                    // console.error("Erro ao fazer parse do webhook_payload:", e);
                                                }
                                            } else {
                                                // console.warn("webhook_payload está vazio ou nulo");
                                            }
                                        }

                                        // Fallback para o timestamp original mapeado se nada for encontrado
                                        if (specificTimestamp === null) {
                                            specificTimestamp = selectedDeposit.originalTimestamp ?? 'N/A';
                                        }

                                        return `Timestamp Específico: ${String(specificTimestamp)}`;
                                    })()}
                                </p>
                            </SheetHeader>
                            <ScrollArea className="flex-1 p-4 overflow-auto">
                                <DepositoDetalhes
                                    deposito={selectedDeposit}
                                    onClose={closeDrawer}
                                    onReprocessar={onReprocessar}
                                    onUploadComprovante={onUploadComprovante}
                                    reprocessando={reprocessando}
                                />
                            </ScrollArea>
                            <SheetFooter className="border-t border-[#222] p-4 mt-auto shrink-0">
                                <SheetClose asChild>
                                    <Button variant="outline" className="w-full border-[#333] hover:bg-[#333] hover:text-white h-10">
                                        Fechar
                                    </Button>
                                </SheetClose>
                            </SheetFooter>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </>
    );
}

// Componente para resumo financeiro
function ResumoDepositos({ isLoading, data }: { isLoading: boolean, data: { total: number, erros: number, processando: number, concluidos: number, pendenteRegistro: number, desconhecido: number } }) {
    if (isLoading) {
        return (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="overflow-hidden">
                        <CardContent className="p-0">
                            <div className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <Skeleton width="40%" height="20px" className="rounded-md" />
                                    <Skeleton shape="circle" size="32px" />
                                </div>
                                <Skeleton width="60%" height="36px" className="rounded-md mt-2" />
                                <Skeleton width="80%" height="16px" className="rounded-md" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-6">
            <Card className="bg-[#1e1e1e] border-[#333]">
                <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Total de Depósitos</p>
                            <p className="text-3xl font-bold">{data.total}</p>
                        </div>
                        <div className="rounded-full p-2 bg-primary/10">
                            <BarChart2 className="h-5 w-5 text-primary" />
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Todos os depósitos no sistema
                    </p>
                </CardContent>
            </Card>

            <Card className="bg-[#1e1e1e] border-[#333]">
                <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Em Processamento</p>
                            <p className="text-3xl font-bold text-blue-500">{data.processando}</p>
                        </div>
                        <div className="rounded-full p-2 bg-blue-500/10">
                            <Clock className="h-5 w-5 text-blue-500" />
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Depósitos em andamento
                    </p>
                </CardContent>
            </Card>

            <Card className="bg-[#1e1e1e] border-[#333]">
                <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Com Erro</p>
                            <p className="text-3xl font-bold text-red-500">{data.erros}</p>
                        </div>
                        <div className="rounded-full p-2 bg-red-500/10">
                            <XCircle className="h-5 w-5 text-red-500" />
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Depósitos com falha
                    </p>
                </CardContent>
            </Card>

            <Card className="bg-[#1e1e1e] border-[#333]">
                <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Concluídos</p>
                            <p className="text-3xl font-bold text-green-500">{data.concluidos}</p>
                        </div>
                        <div className="rounded-full p-2 bg-green-500/10">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Depósitos finalizados
                    </p>
                </CardContent>
            </Card>

            <Card className="bg-[#1e1e1e] border-[#333]">
                <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Pendente Registro</p>
                            <p className="text-3xl font-bold text-yellow-500">{data.pendenteRegistro}</p>
                        </div>
                        <div className="rounded-full p-2 bg-yellow-500/10">
                            <AlertCircle className="h-5 w-5 text-yellow-500" />
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Transações PIX sem depósito
                    </p>
                </CardContent>
            </Card>

            <Card className="bg-[#1e1e1e] border-[#333]">
                <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Desconhecido</p>
                            <p className="text-3xl font-bold text-gray-500">{data.desconhecido}</p>
                        </div>
                        <div className="rounded-full p-2 bg-gray-500/10">
                            <AlertCircle className="h-5 w-5 text-gray-500" />
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Status não mapeado
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

// Componente principal
export default function CompensacaoDepositos() {
    const [depositos, setDepositos] = useState<Deposito[]>([]);
    const [filteredDepositos, setFilteredDepositos] = useState<Deposito[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [stepFilter, setStepFilter] = useState<string>("all");
    const [selectedDeposito, setSelectedDeposito] = useState<Deposito | null>(null);
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
    const [reprocessando, setReprocessando] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [activeTab, setActiveTab] = useState("depositos");
    const [startDateFilter, setStartDateFilter] = useState<Date | undefined>(undefined);
    const [endDateFilter, setEndDateFilter] = useState<Date | undefined>(undefined);
    
    // Estados para o modal de edição
    const [depositoParaEditar, setDepositoParaEditar] = useState<Deposito | null>(null);
    const [isEdicaoModalOpen, setIsEdicaoModalOpen] = useState(false);
    const [isSavingEdicao, setIsSavingEdicao] = useState(false);

    // Log para verificar o estado principal de depósitos
    // Log de estado removido para reduzir ruído no console

    // Calcular estatísticas dos depósitos
    const depositosStats = {
        total: depositos.length,
        erros: depositos.filter(d => d.status === 'error').length,
        processando: depositos.filter(d => d.status === 'processing').length,
        concluidos: depositos.filter(d => d.status === 'finished').length,
        pendenteRegistro: depositos.filter(d => d.status === 'pending_registration').length,
        desconhecido: depositos.filter(d => d.status === 'unknown').length
    };

    // Função para filtrar depósitos (status, step, search term) - NÃO filtra mais por data aqui
    const filterDepositosByCriteria = (depositosToFilter: Deposito[]) => {
        const filtered = depositosToFilter.filter(dep => {
            // Filtrar por status
            if (statusFilter && statusFilter !== 'all' && dep.status !== statusFilter) {
                return false;
            }

            // Filtrar por step
            if (stepFilter && stepFilter !== 'all' && dep.step !== stepFilter) {
                return false;
            }

            // Filtrar por termo de busca (nome ou ID)
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                return (
                    dep.id.toLowerCase().includes(searchLower) ||
                    dep.userName.toLowerCase().includes(searchLower) ||
                    dep.userId.toLowerCase().includes(searchLower) || // Adicionar busca por ID do usuário
                    (dep.txId && dep.txId.toLowerCase().includes(searchLower)) // Adicionar busca por Tx ID
                );
            }

            return true;
        });
        // Aplicar filtros
        return filtered;
    };

    // Efeito para aplicar filtros
    useEffect(() => {
        let dadosAposFiltroData: Deposito[];

        if (startDateFilter && endDateFilter) {
            const inicioDia = startOfDay(startDateFilter).getTime();
            const fimDia = endOfDay(endDateFilter).getTime();
            dadosAposFiltroData = depositos.filter(dep => {
                const isInDateRange = dep.createdAt >= inicioDia && dep.createdAt <= fimDia;
                return isInDateRange;
            });

        } else {
            dadosAposFiltroData = [...depositos];

        }

        // Aplicar filtros adicionais
        const dadosFiltradosFinal = filterDepositosByCriteria(dadosAposFiltroData);
        // Filtragem concluída

        setFilteredDepositos(dadosFiltradosFinal);

    }, [searchTerm, statusFilter, stepFilter, depositos, startDateFilter, endDateFilter]);

    // Função para reprocessar depósito
    const handleReprocessDeposito = async (depositoId: string) => {
        const depositoParaReprocessar = depositos.find(d => d.id === depositoId);
        if (depositoParaReprocessar?.tipoRegistro === 'transacaoNaoRegistrada') {
            toast.warning("Não é possível reprocessar uma transação não registrada.", {
                style: toastStyles.warning
            });
            return;
        }
        if (depositoParaReprocessar?.status === 'finished') {
            toast.info("Este depósito já está finalizado.", {
                style: toastStyles.info
            });
            return;
        }

        setReprocessando(true);

        const API_URL = `${PUBLIC_ENV.DIAGNOSTICO_API_URL}/depositos/compensar`;
        // ✅ Credenciais agora são gerenciadas pelo backend via JWT
        const USER_TOKEN = TOKEN_STORAGE.get(); // Token do usuário logado

        try {
            const depositoIdNum = parseInt(depositoId, 10);
            if (isNaN(depositoIdNum)) {
                throw new Error("ID do depósito inválido.");
            }

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-enterprise': 'tcr',
                    'Authorization': `Bearer ${USER_TOKEN}`,
                    // Backend adiciona automaticamente: x-secret-admin-hd, Token-Cryp-Access, Token-Whitelabel
                    'User-Agent': PUBLIC_ENV.APP_USER_AGENT
                },
                body: JSON.stringify({ id_deposito: depositoIdNum })
            });

            const responseData = await response.json();

            if (!response.ok) {

                throw new Error(`Erro HTTP ${response.status}`);
            }

            if (!responseData.sucesso) {

                throw new Error(responseData.mensagem || "Erro geral retornado pela API.");
            }

            // A variável 'detalhe' é definida aqui, dentro do try
            const detalhe = responseData.resultado?.detalhes?.find(
                (d: { id_deposito: number }) => d.id_deposito === depositoIdNum
            );



            if (!detalhe) {

                throw new Error("Resposta da API inesperada (detalhes não encontrados).");
            }



            if (detalhe.sucesso) {
                toast.success(detalhe.mensagem || 'Depósito compensado com sucesso!', {
                    style: toastStyles.success
                });
                await fetchDepositos();
            } else {
                // console.error("Falha na compensação do depósito específico:", detalhe);
                toast.error(detalhe.mensagem || 'Falha ao compensar o depósito.', {
                    style: toastStyles.error
                });
            }

        } catch (error) {
            // console.error("Erro ao chamar API de compensação:", error);
            const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido";
            toast.error(`Erro ao reprocessar: ${errorMessage}`, {
                style: toastStyles.error
            });
        } finally {
            setReprocessando(false);
        }
    };

    // Função para receber upload do comprovante
    const handleUploadComprovante = async (id: string, file: File) => {
        const depositoParaUpload = depositos.find(d => d.id === id);
        if (depositoParaUpload?.tipoRegistro === 'transacaoNaoRegistrada') {
            toast.warning("Não é possível anexar comprovante a uma transação não registrada.", {
                style: toastStyles.warning
            });
            return;
        }

        setIsUploading(true);

        try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            toast.success("Comprovante enviado para análise!", {
                style: toastStyles.success
            });

            const updatedDepositos = depositos.map(dep => {
                if (dep.id === id) {
                    return {
                        ...dep,
                        status: 'processing' as const,
                        comprovante: URL.createObjectURL(file),
                        lastUpdated: Date.now()
                    };
                }
                return dep;
            });

            setDepositos(updatedDepositos);
            setIsUploadDialogOpen(false);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido";
            toast.error(`Erro ao processar comprovante: ${errorMessage}`, {
                style: toastStyles.error
            });
        } finally {
            setIsUploading(false);
        }
    };

    // Função para buscar depósitos (agora chamada pelo botão Filtrar)
    const fetchDepositos = async () => {
        setIsLoading(true);
        let startDateAPI: string | undefined = undefined;
        let endDateAPI: string | undefined = undefined;

        // Formata as datas para a API APENAS se estiverem definidas
        if (startDateFilter && endDateFilter) {
            const formatDateToAPI = (date: Date) => format(date, "yyyy-MM-dd");
            startDateAPI = formatDateToAPI(startDateFilter);
            endDateAPI = formatDateToAPI(endDateFilter);

        } else {

        }

        try {
            const dadosDaApi = await buscarDepositosComErro(
                startDateAPI,
                endDateAPI
            );
            setDepositos(dadosDaApi);
        } catch (error) {
            setDepositos([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Função para mostrar detalhes de um depósito
    const showDepositoDetails = (deposito: Deposito) => {
        setSelectedDeposito(deposito);
    };

    // Função para abrir o modal de edição
    const handleEditDeposito = (deposito: Deposito) => {
        setDepositoParaEditar(deposito);
        setIsEdicaoModalOpen(true);
    };

    // Função para fechar o modal de edição
    const handleCloseEdicaoModal = () => {
        setIsEdicaoModalOpen(false);
        setTimeout(() => setDepositoParaEditar(null), 300);
    };

    // Função para salvar as alterações do depósito - VERSÃO SIMPLES SEM HEADERS ESPECIAIS
    const handleSaveEdicaoDeposito = async (
        depositoId: string, 
        novoUserId: string, 
        novoStatus: string, 
        novaEtapa: string
    ) => {
        setIsSavingEdicao(true);

        try {


            // ✅ VERSÃO SUPER SIMPLES - SEM HEADERS ESPECIAIS
            const response = await fetch(`${PUBLIC_ENV.DIAGNOSTICO_API_URL}/api/externos/depositos/atualizar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                    // SEM Token-Acesso
                    // SEM Token-Cryp-Access  
                    // SEM x-external-api-key
                },
                body: JSON.stringify({
                    id_deposito: parseInt(depositoId, 10),
                    id_usuario: parseInt(novoUserId, 10),
                    status_deposito: novoStatus,
                    step: novaEtapa
                })
            });

            const data = await response.json();


            // ✅ VERIFICAÇÃO DA RESPOSTA
            if (!response.ok) {
                throw new Error(`Erro HTTP ${response.status}: ${data.mensagem || data.erro || response.statusText}`);
            }

            if (data.sucesso === false) {
                throw new Error(data.mensagem || data.erro || 'Erro retornado pela API');
            }

            // Atualizar o depósito localmente
            const depositosAtualizados = depositos.map(dep => {
                if (dep.id === depositoId) {
                    return {
                        ...dep,
                        userId: novoUserId,
                        status: novoStatus as Deposito['status'],
                        step: novaEtapa as Deposito['step'],
                        lastUpdated: Date.now()
                    };
                }
                return dep;
            });

            setDepositos(depositosAtualizados);
            handleCloseEdicaoModal();


            toast.success('✅ Depósito atualizado com sucesso!', {
                style: toastStyles.success
            });

        } catch (error) {
            // console.error('❌ Erro ao salvar alterações do depósito:', error);
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            
            toast.error(`❌ Erro ao salvar alterações: ${errorMessage}`, {
                style: toastStyles.error
            });
        } finally {
            setIsSavingEdicao(false);
        }
    };

    return (
        <div className="flex flex-col p-6 space-y-6 bg-[#090909]">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Compensação de Depósitos</h1>
                <p className="text-muted-foreground">
                    Visualize e gerencie depósitos pendentes que precisam ser compensados manualmente
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-[#121212] border border-[#333]">
                    <TabsTrigger value="depositos" className="data-[state=active]:bg-[#1e1e1e]">Depósitos</TabsTrigger>
                    <TabsTrigger value="relatorios" className="data-[state=active]:bg-[#1e1e1e]">Relatórios</TabsTrigger>
                </TabsList>

                <TabsContent value="depositos" className="space-y-6">
                    {/* Cards de resumo financeiro */}
                    <ResumoDepositos
                        isLoading={isLoading}
                        data={depositosStats}
                    />

                    {/* Filtros */}
                    <Card className="bg-[#1e1e1e] border-[#333]">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex justify-between items-center">
                                <span>Filtrar Depósitos</span>
                                {/* Botão Atualizar REMOVIDO */}
                                {/* <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-[#444] text-muted-foreground hover:bg-[#333] hover:text-foreground"
                                    onClick={fetchDepositos}
                                    disabled={isLoading}
                                >
                                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                                    Atualizar
                                </Button> */}
                            </CardTitle>
                            <CardDescription>
                                Use os filtros abaixo para encontrar depósitos específicos
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 grid-cols-1 md:grid-cols-3 lg:grid-cols-5 items-end">
                                {/* Search */}
                                <div className="lg:col-span-2">
                                    <Label htmlFor="search-term">Busca</Label>
                                    <div className="relative mt-1">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="search-term"
                                            placeholder="Buscar por ID, nome..."
                                            className="pl-8 bg-[#121212] border-[#333] h-10"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Filtro de Data Inicial */}
                                <div>
                                    <Label>Data Inicial</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full justify-start text-left font-normal mt-1 bg-[#121212] border-[#333] hover:bg-[#222] h-10",
                                                    !startDateFilter && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {startDateFilter ? format(startDateFilter, "PPP", { locale: ptBR }) : <span>Selecione (Opcional)</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 bg-[#1e1e1e] border-[#333]">
                                            <Calendar
                                                mode="single"
                                                selected={startDateFilter}
                                                onSelect={setStartDateFilter}
                                                initialFocus
                                                locale={ptBR}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Filtro de Data Final */}
                                <div>
                                    <Label>Data Final</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full justify-start text-left font-normal mt-1 bg-[#121212] border-[#333] hover:bg-[#222] h-10",
                                                    !endDateFilter && "text-muted-foreground"
                                                )}
                                                // Desabilita se a data inicial não estiver selecionada
                                                disabled={!startDateFilter}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {endDateFilter ? format(endDateFilter, "PPP", { locale: ptBR }) : <span>Selecione (Opcional)</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 bg-[#1e1e1e] border-[#333]">
                                            <Calendar
                                                mode="single"
                                                selected={endDateFilter}
                                                // Limpa a data final se a data inicial for removida
                                                onSelect={(date) => setEndDateFilter(startDateFilter ? date : undefined)}
                                                // Garante que a data final não seja anterior à inicial
                                                disabled={(date) =>
                                                    startDateFilter ? date < startDateFilter : false
                                                }
                                                initialFocus
                                                locale={ptBR}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Filtro Status */}
                                <div>
                                    <Label>Status</Label>
                                    <Select
                                        value={statusFilter}
                                        onValueChange={setStatusFilter}
                                    >
                                        <SelectTrigger className="bg-[#121212] border-[#333] mt-1 h-10">
                                            <SelectValue placeholder="Filtrar por Status" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#1e1e1e] border-[#333]">
                                            <SelectItem value="all">Todos os Status</SelectItem>
                                            <SelectItem value="processing">Em Processamento</SelectItem>
                                            <SelectItem value="error">Com Erro</SelectItem>
                                            <SelectItem value="finished">Concluídos</SelectItem>
                                            <SelectItem value="pending_registration">Pendente Registro</SelectItem>
                                            <SelectItem value="unknown">Desconhecido</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Filtro Etapa */}
                                <div>
                                    <Label>Etapa</Label>
                                    <Select
                                        value={stepFilter}
                                        onValueChange={setStepFilter}
                                    >
                                        <SelectTrigger className="bg-[#121212] border-[#333] mt-1 h-10">
                                            <SelectValue placeholder="Filtrar por Etapa" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#1e1e1e] border-[#333]">
                                            <SelectItem value="all">Todas as Etapas</SelectItem>
                                            <SelectItem value="01newdeposit">Depósito PIX</SelectItem>
                                            <SelectItem value="02internal_transfer_b8cash">Transferência B8Cash</SelectItem>
                                            <SelectItem value="03bolsao_deposit">Depósito BRBTC</SelectItem>
                                            <SelectItem value="04internal_transfer_caas">Transferência CAAS</SelectItem>
                                            <SelectItem value="unknown_step">Etapa Desconhecida</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Botão Filtrar Adicionado */}
                                <div className="lg:col-start-5 flex items-end">
                                    <Button
                                        className="w-full h-10 bg-primary hover:bg-primary/90"
                                        onClick={fetchDepositos}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Buscando...</>
                                        ) : (
                                            <><Filter className="mr-2 h-4 w-4" /> Filtrar</>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tabela de Depósitos */}
                    <Card className="bg-[#121212] border-[#333]">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex justify-between items-center">
                                <span>Depósitos Pendentes</span>
                                <Badge variant="outline" className="ml-2 bg-[#333] text-foreground border-[#444]">
                                    {filteredDepositos.length} depósitos
                                </Badge>
                            </CardTitle>
                            <CardDescription>
                                Lista de depósitos que precisam de atenção ou acompanhamento
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="space-y-4 p-6">
                                    <div className="flex justify-between items-center">
                                        <Skeleton width="150px" height="32px" />
                                        <div className="flex gap-2">
                                            <Skeleton width="100px" height="32px" />
                                            <Skeleton width="100px" height="32px" />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <Skeleton key={i} className="h-12 w-full" />
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <TabelaDepositos
                                    depositos={filteredDepositos}
                                    loading={isLoading}
                                    onViewDetails={showDepositoDetails}
                                    onReprocessar={handleReprocessDeposito}
                                    onUploadComprovante={handleUploadComprovante}
                                    onEdit={handleEditDeposito}
                                    reprocessando={reprocessando}
                                />
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="relatorios" className="space-y-6">
                    <Card className="bg-[#121212] border-[#333]">
                        <CardHeader>
                            <CardTitle>Relatórios</CardTitle>
                            <CardDescription>
                                Estatísticas e análises sobre os depósitos processados
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col items-center justify-center py-6 text-center">
                                <div className="rounded-full bg-muted p-3 mb-4">
                                    <BarChart2 className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-medium">Relatórios em desenvolvimento</h3>
                                <p className="text-sm text-muted-foreground mt-2 max-w-md">
                                    Esta funcionalidade está sendo implementada e estará disponível em breve.
                                    Você poderá visualizar estatísticas avançadas e exportar relatórios de depósitos.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Modal de Edição */}
            <DepositoEdicaoModal
                deposito={depositoParaEditar}
                isOpen={isEdicaoModalOpen}
                onClose={handleCloseEdicaoModal}
                onSave={handleSaveEdicaoDeposito}
                isSaving={isSavingEdicao}
            />
        </div>
    );
}