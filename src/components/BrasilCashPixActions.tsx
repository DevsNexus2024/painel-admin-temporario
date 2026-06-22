/**
 * 🎯 COMPONENTE DE AÇÕES PIX DA BRASILCASH
 * 
 * Interface específica para operações PIX da BrasilCash
 * Integrado ao gerenciador unificado de contas
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "react-router-dom";
import { 
  SendHorizontal, 
  QrCode, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Copy,
  DollarSign,
  Key,
  Mail,
  Phone,
  User,
  Building2,
  Hash,
  ArrowRightLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import TotpField from "@/components/totp/TotpField";
import { fetchWithTotp } from "@/services/totpBridge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

// Importar funções do gerenciador unificado (para QR Codes)
import { 
  criarQRCodeDinamicoBitso,
  criarQRCodeEstaticoBitso,
  switchAccount,
  getAvailableAccounts
} from "@/services/banking";

// Nova API para envio de PIX BrasilCash
import { sendPixBrasilCash } from "@/services/brasilcash-pix-send";

const API_BASE_URL = 'https://api-bank-v2.gruponexus.com.br';

// Contas de destino para transferência interna P2P (TCR como origem)
const P2P_DESTINATION_ACCOUNTS_TCR = [
  { value: '78027552', label: 'BrasilCash OTC 7802755', document: null as string | null, description: 'Transferência para OTC 7802755' },
  { value: '17159172', label: 'BrasilCash OTC 1715917', document: null as string | null, description: 'Transferência para OTC 1715917' },
  { value: '73015092', label: 'BrasilCash OTC TTF', document: '14283885000198', description: 'Transferência para TTF SERVIÇOS DIGITAIS LTDA' },
  { value: '24389222', label: 'RXP SERVIÇOS DIGITAIS LTDA', document: '24586576000140', description: 'Transferência para RXP SERVIÇOS DIGITAIS LTDA' },
];

// Schemas de validação
const pixSendSchema = z.object({
  keyType: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"], {
    required_error: "Selecione o tipo de chave",
  }),
  pixKey: z.string().min(1, "Chave PIX é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Valor deve ser maior que zero"
  ),
  externalId: z.string().optional(), // ID externo opcional para rastreamento
});

const pixSendSchemaTcr = z.object({
  keyType: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "EVP", "TRANSFERENCIA_INTERNA"], {
    required_error: "Selecione o tipo de chave",
  }),
  pixKey: z.string().optional(),
  amount: z.string().min(1, "Valor é obrigatório").refine(
    (val) => !isNaN(parseFloat(val.replace(',', '.'))) && parseFloat(val.replace(',', '.')) > 0,
    "Valor deve ser maior que zero"
  ),
  externalId: z.string().optional(),
  description: z.string().optional(),
  document: z.string().optional(),
  account_number: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.keyType === "TRANSFERENCIA_INTERNA") {
    if (!data.description?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["description"], message: "Descrição é obrigatória" });
    if (!data.document?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["document"], message: "CPF/CNPJ é obrigatório" });
    else {
      const digits = data.document.replace(/\D/g, '');
      if (digits.length < 11 || digits.length > 14) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["document"], message: "CPF (11 dígitos) ou CNPJ (14 dígitos)" });
    }
    if (!data.account_number?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["account_number"], message: "Selecione a conta destino" });
  } else {
    if (!data.pixKey?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pixKey"], message: "Chave PIX é obrigatória" });
  }
});

const qrDynamicSchema = z.object({
  keyType: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"]),
  pixKey: z.string().min(1, "Chave PIX é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Valor deve ser maior que zero"
  ),
  description: z.string().optional(),
});

const qrStaticSchema = z.object({
  keyType: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"]),
  pixKey: z.string().min(1, "Chave PIX é obrigatória"),
  description: z.string().optional(),
});

type PixSendData = z.infer<typeof pixSendSchema>;
type PixSendDataTcr = z.infer<typeof pixSendSchemaTcr>;
type QRDynamicData = z.infer<typeof qrDynamicSchema>;
type QRStaticData = z.infer<typeof qrStaticSchema>;

// Conta BrasilCash da tela TCR. Enviada como X-Account-Id / x-otc-id para que o
// guard de pix-out enxergue a permissão por conta (BRASILCASH_ACCOUNT) e o backend
// selecione as credenciais corretas. Mesmos valores usados na transferência P2P.
const TCR_ACCOUNT_ID = '1be0c9de-e87b-4535-b3bb-d0d61515ed9e';
const TCR_OTC_ID = 'DEFAULT';

interface BrasilCashPixActionsProps {
  tenantId?: 2 | 3; // Opcional: se não fornecido, detecta pela rota
}

export default function BrasilCashPixActions({ tenantId }: BrasilCashPixActionsProps = {} as BrasilCashPixActionsProps) {
  const location = useLocation();
  
  // Detectar tenant_id pela rota se não foi fornecido como prop
  const detectedTenantId: 2 | 3 = tenantId || (location.pathname.includes('/brasilcash-tcr') ? 2 : 3);
  const tenantName = detectedTenantId === 2 ? 'TCR' : 'OTC';
  const isTcrPage = detectedTenantId === 2;
  
  const [isLoading, setIsLoading] = useState(false);
  const [pixResult, setPixResult] = useState<any>(null);
  const [qrResult, setQrResult] = useState<any>(null);

  // Chave PIX pré-preenchida apenas para TCR
  const defaultPixKey = isTcrPage ? "453f4628-04ea-4582-a371-db9639ba693d" : "";

  // Forms
  const sendForm = useForm<PixSendData | PixSendDataTcr>({
    resolver: zodResolver(isTcrPage ? pixSendSchemaTcr : pixSendSchema) as any,
    defaultValues: {
      keyType: isTcrPage ? "EVP" : undefined,
      pixKey: defaultPixKey,
      amount: "",
      externalId: "",
      description: "",
      document: "",
      account_number: "",
    },
  });

  const qrDynamicForm = useForm<QRDynamicData>({
    resolver: zodResolver(qrDynamicSchema),
    defaultValues: {
      keyType: undefined,
      pixKey: "",
      amount: "",
      description: "",
    },
  });

  const qrStaticForm = useForm<QRStaticData>({
    resolver: zodResolver(qrStaticSchema),
    defaultValues: {
      keyType: undefined,
      pixKey: "",
      description: "",
    },
  });

  // Verificar se conta Bitso está ativa (usado apenas para QR Codes)
  const checkBitsoActive = () => {
    const accounts = getAvailableAccounts();
    const bitsoAccount = accounts.find(acc => acc.provider === 'bitso');
    
    if (!bitsoAccount?.isActive) {
      // Tentar ativar conta Bitso automaticamente
      const success = switchAccount('bitso-crypto');
      if (!success) {
        toast.error("Conta Bitso não disponível", {
          description: "Selecione a conta Bitso no gerenciador de contas"
        });
        return false;
      }
    }
    return true;
  };

  // Enviar PIX
  const onSendPix = async (data: PixSendData | PixSendDataTcr) => {
    try {
      setIsLoading(true);
      setPixResult(null);

      // Converter valor de string para número
      const amountValue = parseFloat(data.amount.replace(',', '.'));
      if (isNaN(amountValue) || amountValue <= 0) {
        throw new Error('Valor inválido. O valor deve ser maior que zero.');
      }

      // Transferência Interna P2P (apenas na tela TCR)
      if (isTcrPage && data.keyType === "TRANSFERENCIA_INTERNA") {
        const token = sessionStorage.getItem('jwt_token') || localStorage.getItem('jwt_token') ||
          sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
        if (!token) throw new Error('Token de autenticação não encontrado. Faça login novamente.');

        const documentDigits = (data.document || '').replace(/\D/g, '');
        const body = {
          amount: Math.round(amountValue * 100), // centavos
          description: (data.description || '').trim(),
          document: documentDigits,
          account_number: (data.account_number || '').trim(),
        };

        const response = await fetchWithTotp(`${API_BASE_URL}/api/brasilcash/transfer/p2p`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-otc-id': TCR_OTC_ID, // TCR usa conta DEFAULT
            'X-Account-Id': TCR_ACCOUNT_ID,
          },
          body: JSON.stringify(body),
        });

        const responseData = await response.json();

        if (response.ok) {
          setPixResult({
            success: true,
            message: responseData.message || 'Transferência interna realizada com sucesso!',
          });
          toast.success('Transferência interna realizada!', {
            description: `R$ ${data.amount} • TCR`,
            duration: 4000,
          });
          sendForm.reset();
        } else {
          const errorMessage = responseData.error?.message || responseData.message || 'Erro ao realizar transferência';
          setPixResult({ success: false, message: errorMessage });
          toast.error('Erro na transferência', { description: errorMessage, duration: 8000 });
        }
        return;
      }

      // Converter tipo de chave para formato da API BrasilCash
      const keyTypeMap: Record<string, 'document' | 'phone' | 'email' | 'randomKey'> = {
        'CPF': 'document',
        'CNPJ': 'document',
        'EMAIL': 'email',
        'PHONE': 'phone',
        'EVP': 'randomKey',
      };

      // Usar nova API BrasilCash
      const result = await sendPixBrasilCash({
        amount: amountValue,
        key_type: keyTypeMap[data.keyType] || 'randomKey',
        key: data.pixKey!,
        external_id: data.externalId?.trim() || undefined,
        // Na tela TCR, identificar a conta de origem para o guard de pix-out
        // (permissão BRASILCASH_ACCOUNT) e seleção de credenciais no backend.
        ...(isTcrPage ? { accountId: TCR_ACCOUNT_ID, otcId: TCR_OTC_ID } : {}),
      });

      if (result.success) {
        setPixResult({
          success: true,
          transaction: {
            journal_id: result.pix_id || result.transaction_id || '',
            end_to_end_id: result.endToEndId || result.end_to_end_id || '',
            wid: result.pix_id || result.transaction_id || '',
            status: result.status || 'processing',
            external_id: result.external_id,
          },
          message: result.message || "PIX enviado com sucesso!"
        });

        toast.success("PIX enviado!", {
          description: `R$ ${data.amount} para ${data.pixKey} • BrasilCash${data.externalId ? ` • ID: ${data.externalId}` : ''}`,
          duration: 4000,
        });

        sendForm.reset();
      } else {
        // Extrair mensagem de erro da API
        let errorMessage = "Erro ao enviar PIX";
        
        if (result.error) {
          if (typeof result.error === 'object' && result.error.message) {
            // Formato: { error: { code, message, traceId } }
            errorMessage = result.error.message;
            if (result.error.traceId) {
              errorMessage += ` (Trace ID: ${result.error.traceId})`;
            }
          } else if (typeof result.error === 'string') {
            errorMessage = result.error;
          }
        } else if (result.message) {
          errorMessage = result.message;
        }
        
        setPixResult({
          success: false,
          message: errorMessage,
          error: result.error,
        });

        toast.error("Erro ao enviar PIX", {
          description: errorMessage,
          duration: 8000,
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      
      setPixResult({
        success: false,
        message: errorMessage
      });

      toast.error("Erro ao enviar PIX", {
        description: errorMessage,
        duration: 8000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Criar QR Code Dinâmico
  const onCreateDynamicQR = async (data: QRDynamicData) => {
    if (!checkBitsoActive()) return;

    try {
      setIsLoading(true);
      setQrResult(null);

      const result = await criarQRCodeDinamicoBitso({
        valor: parseFloat(data.amount),
        chavePix: data.pixKey,
        tipoChave: data.keyType,
        descricao: data.description || "Cobrança PIX via Bitso"
      });

      setQrResult({
        success: true,
        type: 'dynamic',
        qrCode: result.qrCode,
        txId: result.txId,
        amount: data.amount
      });

      toast.success("QR Code dinâmico criado!", {
        description: `Valor: R$ ${data.amount}`,
        duration: 4000,
      });

      qrDynamicForm.reset();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      
      setQrResult({
        success: false,
        message: errorMessage
      });

      toast.error("Erro ao criar QR Code", {
        description: errorMessage,
        duration: 6000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Criar QR Code Estático  
  const onCreateStaticQR = async (data: QRStaticData) => {
    if (!checkBitsoActive()) return;

    try {
      setIsLoading(true);
      setQrResult(null);

      const result = await criarQRCodeEstaticoBitso({
        chavePix: data.pixKey,
        tipoChave: data.keyType,
        descricao: data.description || "Chave PIX via Bitso"
      });

      setQrResult({
        success: true,
        type: 'static',
        qrCode: result.qrCode,
        txId: result.txId
      });

      toast.success("QR Code estático criado!", {
        description: "QR Code reutilizável gerado",
        duration: 4000,
      });

      qrStaticForm.reset();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      
      setQrResult({
        success: false,
        message: errorMessage
      });

      toast.error("Erro ao criar QR Code", {
        description: errorMessage,
        duration: 6000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Utilitários
  const handleCopyQR = () => {
    if (qrResult?.qrCode) {
      navigator.clipboard.writeText(qrResult.qrCode);
      toast.success("QR Code copiado!");
    }
  };

  const getKeyTypeIcon = (type: string) => {
    switch (type) {
      case 'CPF': return <User className="h-4 w-4" />;
      case 'CNPJ': return <Building2 className="h-4 w-4" />;
      case 'EMAIL': return <Mail className="h-4 w-4" />;
      case 'PHONE': return <Phone className="h-4 w-4" />;
      case 'EVP': return <Hash className="h-4 w-4" />;
      default: return <Key className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-orange-500/10">
          <SendHorizontal className="h-6 w-6 text-orange-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Ações PIX - BrasilCash</h2>
          <p className="text-sm text-muted-foreground">
            Operações PIX integradas ao gerenciador de contas
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto">
          Conta BrasilCash Ativa
        </Badge>
      </div>

      <Tabs defaultValue="send" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="send" className="flex items-center gap-2">
            <SendHorizontal className="h-4 w-4" />
            Enviar PIX
          </TabsTrigger>
          <TabsTrigger value="qr-dynamic" className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            QR Dinâmico
          </TabsTrigger>
          <TabsTrigger value="qr-static" className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            QR Estático
          </TabsTrigger>
        </TabsList>

        {/* Tab: Enviar PIX */}
        <TabsContent value="send">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SendHorizontal className="h-5 w-5" />
                Enviar PIX via BrasilCash
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                Transferência imediata usando chave PIX do destinatário
                <Badge variant="outline" className="ml-2">
                  Tenant: {tenantName} (ID: {detectedTenantId})
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...sendForm}>
                <form onSubmit={sendForm.handleSubmit(onSendPix)} className="space-y-4">
                  {/* Tipo de Chave */}
                  <FormField
                    control={sendForm.control}
                    name="keyType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Chave PIX</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="CPF">CPF</SelectItem>
                            <SelectItem value="CNPJ">CNPJ</SelectItem>
                            <SelectItem value="EMAIL">Email</SelectItem>
                            <SelectItem value="PHONE">Telefone</SelectItem>
                            <SelectItem value="EVP">Chave Aleatória</SelectItem>
                            {isTcrPage && (
                              <SelectItem value="TRANSFERENCIA_INTERNA">
                                <span className="flex items-center gap-2">
                                  <ArrowRightLeft className="h-4 w-4" />
                                  Transferência Interna
                                </span>
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Chave PIX - ocultar quando Transferência Interna */}
                  {sendForm.watch("keyType") !== "TRANSFERENCIA_INTERNA" && (
                    <FormField
                      control={sendForm.control}
                      name="pixKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Chave PIX do Destinatário</FormLabel>
                          <FormControl>
                            <div className="relative">
                              {sendForm.watch("keyType") && getKeyTypeIcon(sendForm.watch("keyType"))}
                              <Input 
                                placeholder="Digite a chave PIX"
                                className="pl-10"
                                disabled={isLoading}
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Campos Transferência Interna (apenas TCR) */}
                  {isTcrPage && sendForm.watch("keyType") === "TRANSFERENCIA_INTERNA" && (
                    <>
                      <FormField
                        control={sendForm.control}
                        name="account_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Conta destino</FormLabel>
                            <Select
                              onValueChange={(value) => {
                                field.onChange(value);
                                const account = P2P_DESTINATION_ACCOUNTS_TCR.find((a) => a.value === value);
                                if (account) {
                                  sendForm.setValue("description", account.description);
                                  sendForm.setValue("document", account.document || "");
                                }
                              }}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione a conta destino" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {P2P_DESTINATION_ACCOUNTS_TCR.map((acc) => (
                                  <SelectItem key={acc.value} value={acc.value}>
                                    {acc.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={sendForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descrição</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: Ajuste de saldo, Teste P2P" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={sendForm.control}
                        name="document"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF/CNPJ do destinatário</FormLabel>
                            <FormControl>
                              <Input placeholder="Apenas números (ex: 01234567890)" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  {/* Valor */}
                  <FormField
                    control={sendForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor (R$)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              placeholder="0,00"
                              className="pl-10"
                              disabled={isLoading}
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* External ID (opcional) - ocultar quando Transferência Interna */}
                  {sendForm.watch("keyType") !== "TRANSFERENCIA_INTERNA" && (
                    <FormField
                      control={sendForm.control}
                      name="externalId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ID Externo (Opcional)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                placeholder="ID para rastreamento (opcional)"
                                className="pl-10"
                                disabled={isLoading}
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                          <p className="text-xs text-muted-foreground">
                            ID externo opcional para rastreamento da transação
                          </p>
                        </FormItem>
                      )}
                    />
                  )}

                  <TotpField className="mb-2" />

                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {sendForm.watch("keyType") === "TRANSFERENCIA_INTERNA" ? "Transferindo..." : "Enviando PIX..."}
                      </>
                    ) : (
                      <>
                        {sendForm.watch("keyType") === "TRANSFERENCIA_INTERNA" ? (
                          <>
                            <ArrowRightLeft className="mr-2 h-4 w-4" />
                            Realizar Transferência
                          </>
                        ) : (
                          <>
                            <SendHorizontal className="mr-2 h-4 w-4" />
                            Enviar PIX
                          </>
                        )}
                      </>
                    )}
                  </Button>
                </form>
              </Form>

              {/* Resultado PIX */}
              {pixResult && (
                <Card className={`mt-4 ${pixResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      {pixResult.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className={`font-medium ${pixResult.success ? 'text-green-800' : 'text-red-800'}`}>
                          {pixResult.message}
                        </p>
                        {pixResult.success && pixResult.transaction && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            {pixResult.transaction.journal_id && (
                              <p>Journal ID: {pixResult.transaction.journal_id}</p>
                            )}
                            {pixResult.transaction.end_to_end_id && (
                              <p>End-to-End ID: {pixResult.transaction.end_to_end_id}</p>
                            )}
                            {pixResult.transaction.wid && (
                              <p>WID: {pixResult.transaction.wid}</p>
                            )}
                            {pixResult.transaction.status && (
                              <p>Status: {pixResult.transaction.status}</p>
                            )}
                          </div>
                        )}
                        {!pixResult.success && pixResult.error && (
                          <div className="mt-2 text-sm text-red-700">
                            {typeof pixResult.error === 'object' && pixResult.error.code && (
                              <p><strong>Código:</strong> {pixResult.error.code}</p>
                            )}
                            {typeof pixResult.error === 'object' && pixResult.error.traceId && (
                              <p><strong>Trace ID:</strong> {pixResult.error.traceId}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: QR Code Dinâmico */}
        <TabsContent value="qr-dynamic">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                QR Code Dinâmico
              </CardTitle>
              <CardDescription>
                Gerar QR Code com valor fixo para recebimento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...qrDynamicForm}>
                <form onSubmit={qrDynamicForm.handleSubmit(onCreateDynamicQR)} className="space-y-4">
                  {/* Campos similares ao envio PIX */}
                  <FormField
                    control={qrDynamicForm.control}
                    name="keyType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo da Sua Chave PIX</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="CPF">CPF</SelectItem>
                            <SelectItem value="CNPJ">CNPJ</SelectItem>
                            <SelectItem value="EMAIL">Email</SelectItem>
                            <SelectItem value="PHONE">Telefone</SelectItem>
                            <SelectItem value="EVP">Chave Aleatória</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={qrDynamicForm.control}
                    name="pixKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sua Chave PIX</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Digite sua chave PIX"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={qrDynamicForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor a Receber (R$)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="0,00"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={qrDynamicForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição (opcional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Motivo da cobrança"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Gerando QR...
                      </>
                    ) : (
                      <>
                        <QrCode className="mr-2 h-4 w-4" />
                        Gerar QR Dinâmico
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: QR Code Estático */}
        <TabsContent value="qr-static">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                QR Code Estático
              </CardTitle>
              <CardDescription>
                Gerar QR Code reutilizável (sem valor fixo)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...qrStaticForm}>
                <form onSubmit={qrStaticForm.handleSubmit(onCreateStaticQR)} className="space-y-4">
                  <FormField
                    control={qrStaticForm.control}
                    name="keyType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo da Sua Chave PIX</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="CPF">CPF</SelectItem>
                            <SelectItem value="CNPJ">CNPJ</SelectItem>
                            <SelectItem value="EMAIL">Email</SelectItem>
                            <SelectItem value="PHONE">Telefone</SelectItem>
                            <SelectItem value="EVP">Chave Aleatória</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={qrStaticForm.control}
                    name="pixKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sua Chave PIX</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Digite sua chave PIX"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={qrStaticForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição (opcional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Identificação da chave"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Gerando QR...
                      </>
                    ) : (
                      <>
                        <QrCode className="mr-2 h-4 w-4" />
                        Gerar QR Estático
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Resultado QR Code */}
      {qrResult && (
        <Card className={`${qrResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <CardContent className="pt-4">
            {qrResult.success ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">
                    QR Code {qrResult.type === 'dynamic' ? 'Dinâmico' : 'Estático'} Criado!
                  </span>
                </div>
                
                {qrResult.amount && (
                  <Badge variant="secondary">
                    Valor: R$ {qrResult.amount}
                  </Badge>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-green-800">
                    Código QR PIX:
                  </label>
                  <div className="flex gap-2">
                    <code className="flex-1 p-3 bg-white border rounded text-xs font-mono break-all">
                      {qrResult.qrCode}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyQR}
                      className="shrink-0"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-green-700">
                  ID da transação: {qrResult.txId}
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Erro ao gerar QR Code</p>
                  <p className="text-sm text-red-700 mt-1">{qrResult.message}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
} 