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
  Hash
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
type QRDynamicData = z.infer<typeof qrDynamicSchema>;
type QRStaticData = z.infer<typeof qrStaticSchema>;

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
  const sendForm = useForm<PixSendData>({
    resolver: zodResolver(pixSendSchema),
    defaultValues: {
      keyType: isTcrPage ? "EVP" : undefined,
      pixKey: defaultPixKey,
      amount: "",
      externalId: "",
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
  const onSendPix = async (data: PixSendData) => {
    try {
      setIsLoading(true);
      setPixResult(null);

      // Converter tipo de chave para formato da API BrasilCash
      // API aceita: document, phone, email, randomKey
      const keyTypeMap: Record<string, 'document' | 'phone' | 'email' | 'randomKey'> = {
        'CPF': 'document',
        'CNPJ': 'document',
        'EMAIL': 'email',
        'PHONE': 'phone',
        'EVP': 'randomKey',
      };

      // Converter valor de string para número
      // Suporta tanto vírgula quanto ponto como separador decimal
      // Exemplo: "289649,00" ou "289649.00" → 289649.00
      const amountValue = parseFloat(data.amount.replace(',', '.'));
      
      if (isNaN(amountValue) || amountValue <= 0) {
        throw new Error('Valor inválido. O valor deve ser maior que zero.');
      }

      // Usar nova API BrasilCash
      // O serviço converterá de reais para centavos (ex: 289649.00 → 28964900)
      const result = await sendPixBrasilCash({
        amount: amountValue,
        key_type: keyTypeMap[data.keyType] || 'randomKey',
        key: data.pixKey,
        external_id: data.externalId?.trim() || undefined, // ID externo opcional (só envia se não estiver vazio)
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
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Chave PIX */}
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

                  {/* External ID (opcional) */}
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

                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando PIX...
                      </>
                    ) : (
                      <>
                        <SendHorizontal className="mr-2 h-4 w-4" />
                        Enviar PIX
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