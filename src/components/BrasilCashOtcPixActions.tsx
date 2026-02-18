/**
 * 🎯 COMPONENTE DE AÇÕES PIX DA BRASILCASH OTC
 * 
 * Interface específica para operações PIX da BrasilCash OTC
 * Integrado ao contexto BrasilCashOtcContext
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  SendHorizontal, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Copy,
  Key,
  Mail,
  Phone,
  User,
  Building2,
  Hash,
  List,
  RefreshCcw,
  QrCode
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useBrasilCashOtc } from "@/contexts/BrasilCashOtcContext";

const API_BASE_URL = 'https://api-bank-v2.gruponexus.com.br';

// Schemas de validação
const pixSendSchema = z.object({
  keyType: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"], {
    required_error: "Selecione o tipo de chave",
  }),
  pixKey: z.string().min(1, "Chave PIX é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório").refine(
    (val) => !isNaN(parseFloat(val.replace(',', '.'))) && parseFloat(val.replace(',', '.')) > 0,
    "Valor deve ser maior que zero"
  ),
  externalId: z.string().optional(),
});

const pixKeySchema = z.object({
  keyType: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"], {
    required_error: "Selecione o tipo de chave",
  }),
  pixKey: z.string().optional(), // Opcional para EVP (chave aleatória)
});

const qrCodePaymentSchema = z.object({
  qr_code: z.string().min(1, "Cole o payload do QR Code PIX (EMV)"),
  external_id: z.string().optional(),
  amount: z.string().optional(),
}).refine(
  (data) => {
    if (!data.amount || data.amount.trim() === "") return true;
    const val = parseFloat(data.amount.replace(",", "."));
    return !isNaN(val) && val > 0;
  },
  { message: "Valor deve ser maior que zero", path: ["amount"] }
);

type PixSendData = z.infer<typeof pixSendSchema>;
type PixKeyData = z.infer<typeof pixKeySchema>;
type QrCodePaymentData = z.infer<typeof qrCodePaymentSchema>;

interface PixKey {
  pixKeyId: string;
  key: string;
  keyType: 'EVP' | 'EMAIL' | 'PHONE' | 'DOCUMENT';
  registerDate: string;
  receiveDict: boolean;
  receiveQRCodeDynamic: boolean;
  receiveQRCodeStatic: boolean;
}

export default function BrasilCashOtcPixActions() {
  const { selectedAccount, getRequestHeaders } = useBrasilCashOtc();
  
  const [isLoading, setIsLoading] = useState(false);
  const [pixResult, setPixResult] = useState<any>(null);
  const [pixKeyResult, setPixKeyResult] = useState<any>(null);
  const [pixKeys, setPixKeys] = useState<PixKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [qrCodeResult, setQrCodeResult] = useState<any>(null);

  // Forms
  const sendForm = useForm<PixSendData>({
    resolver: zodResolver(pixSendSchema),
    defaultValues: {
      keyType: undefined,
      pixKey: "",
      amount: "",
      externalId: "",
    },
  });

  const pixKeyForm = useForm<PixKeyData>({
    resolver: zodResolver(pixKeySchema),
    defaultValues: {
      keyType: undefined,
      pixKey: "",
    },
  });

  const qrCodeForm = useForm<QrCodePaymentData>({
    resolver: zodResolver(qrCodePaymentSchema),
    defaultValues: {
      qr_code: "",
      external_id: "",
      amount: "",
    },
  });

  // Enviar PIX
  const onSendPix = async (data: PixSendData) => {
    try {
      setIsLoading(true);
      setPixResult(null);

      // Converter tipo de chave para formato da API BrasilCash
      const keyTypeMap: Record<string, 'document' | 'phone' | 'email' | 'randomKey'> = {
        'CPF': 'document',
        'CNPJ': 'document',
        'EMAIL': 'email',
        'PHONE': 'phone',
        'EVP': 'randomKey',
      };

      // Converter valor de string para número (suporta vírgula ou ponto)
      const amountValue = parseFloat(data.amount.replace(',', '.'));
      
      if (isNaN(amountValue) || amountValue <= 0) {
        throw new Error('Valor inválido. O valor deve ser maior que zero.');
      }

      // Converter de reais para centavos
      const amountInCents = Math.round(amountValue * 100);

      // Preparar headers com x-otc-id
      const headers = getRequestHeaders();

      // Preparar body
      const requestBody: {
        amount: number;
        key_type: string;
        key: string;
        external_id?: string;
      } = {
        amount: amountInCents,
        key_type: keyTypeMap[data.keyType] || 'randomKey',
        key: data.pixKey.trim(),
      };

      if (data.externalId?.trim()) {
        requestBody.external_id = data.externalId.trim();
      }

      const response = await fetch(`${API_BASE_URL}/api/brasilcash/pix/cashout/payments`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();

      if (response.ok) {
        setPixResult({
          success: true,
          transaction: {
            journal_id: responseData.pix_id || responseData.pixId || '',
            end_to_end_id: responseData.endToEndId || responseData.end_to_end_id || '',
            wid: responseData.pix_id || responseData.pixId || '',
            status: responseData.status || 'processing',
            external_id: responseData.external_id || responseData.externalId,
          },
          message: responseData.message || "PIX enviado com sucesso!"
        });

        toast.success("PIX enviado!", {
          description: `R$ ${data.amount} para ${data.pixKey} • OTC ${selectedAccount.otcId}${data.externalId ? ` • ID: ${data.externalId}` : ''}`,
          duration: 4000,
        });

        sendForm.reset();
      } else {
        const errorMessage = responseData.error?.message || responseData.message || "Erro ao enviar PIX";
        
        setPixResult({
          success: false,
          message: errorMessage,
          error: responseData.error,
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

  // Criar Chave PIX
  const onCreatePixKey = async (data: PixKeyData) => {
    try {
      setIsLoading(true);
      setPixKeyResult(null);

      // Converter tipo de chave para formato da API BrasilCash
      // API espera: evp, document, phone, email (em minúsculas)
      const keyTypeMap: Record<string, 'evp' | 'document' | 'phone' | 'email'> = {
        'CPF': 'document',
        'CNPJ': 'document',
        'EMAIL': 'email',
        'PHONE': 'phone',
        'EVP': 'evp',
      };

      // Preparar headers com x-otc-id
      const headers = getRequestHeaders();

      // Preparar body
      const requestBody: {
        key_type: string;
        key?: string;
      } = {
        key_type: keyTypeMap[data.keyType] || 'evp',
      };

      // Para EVP (chave aleatória), não enviar key (API gera automaticamente)
      // Para outros tipos, enviar a chave
      if (data.keyType !== 'EVP' && data.pixKey?.trim()) {
        requestBody.key = data.pixKey.trim();
      }

      const response = await fetch(`${API_BASE_URL}/api/brasilcash/pix/dict/create-dict`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();

      if (response.ok) {
        const createdKey = responseData.key || responseData.pix_key || data.pixKey || 'Chave gerada';
        
        setPixKeyResult({
          success: true,
          key: createdKey,
          keyType: data.keyType,
          message: responseData.message || "Chave PIX criada com sucesso!"
        });

        toast.success("Chave PIX criada!", {
          description: `${data.keyType}: ${createdKey}`,
          duration: 4000,
        });

        pixKeyForm.reset();
      } else {
        const errorMessage = responseData.error?.message || responseData.message || "Erro ao criar chave PIX";
        
        setPixKeyResult({
          success: false,
          message: errorMessage,
          error: responseData.error,
        });

        toast.error("Erro ao criar chave PIX", {
          description: errorMessage,
          duration: 8000,
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      
      setPixKeyResult({
        success: false,
        message: errorMessage
      });

      toast.error("Erro ao criar chave PIX", {
        description: errorMessage,
        duration: 8000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Listar Chaves PIX
  const listarChavesPix = async () => {
    try {
      setLoadingKeys(true);
      
      const headers = getRequestHeaders();
      const response = await fetch(`${API_BASE_URL}/api/brasilcash/pix/dict`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setPixKeys(Array.isArray(data) ? data : []);
      
      toast.success(`${data.length || 0} chave(s) PIX encontrada(s)`, {
        description: `Conta OTC ${selectedAccount.otcId}`,
        duration: 2000
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao listar chaves PIX", {
        description: errorMessage,
        duration: 5000,
      });
      setPixKeys([]);
    } finally {
      setLoadingKeys(false);
    }
  };

  // Pagar QR Code (conta definida por X-Account-Id quando disponível, e x-otc-id)
  const onPayQrCode = async (data: QrCodePaymentData) => {
    try {
      setIsLoading(true);
      setQrCodeResult(null);

      const headers = getRequestHeaders();
      const body: { qr_code: string; amount?: number; external_id?: string } = {
        qr_code: data.qr_code.trim(),
      };
      if (data.amount?.trim()) {
        const value = parseFloat(data.amount.replace(",", "."));
        if (!isNaN(value) && value > 0) {
          body.amount = Math.round(value * 100); // reais -> centavos
        }
      }
      if (data.external_id?.trim()) {
        body.external_id = data.external_id.trim();
      }

      const response = await fetch(
        `${API_BASE_URL}/api/brasilcash/pix/cashout/payments/qrcode/simple`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        }
      );

      const responseData = await response.json();

      if (response.ok) {
        setQrCodeResult({
          success: true,
          pix_id: responseData.pix_id || responseData.pixId,
          endToEndId: responseData.endToEndId || responseData.end_to_end_id,
          amount: responseData.amount,
          status: responseData.status,
          external_id: responseData.external_id || responseData.externalId,
          message: responseData.message || "Pagamento por QR Code realizado!",
        });
        toast.success("Pagamento por QR Code realizado!", {
          description: `OTC ${selectedAccount.otcId}${data.external_id?.trim() ? ` • ${data.external_id.trim()}` : ""}`,
          duration: 4000,
        });
        qrCodeForm.reset();
      } else {
        const errorMessage =
          responseData.error?.message ||
          responseData.message ||
          "Erro ao pagar QR Code";
        setQrCodeResult({
          success: false,
          message: errorMessage,
          error: responseData.error,
        });
        toast.error("Erro ao pagar QR Code", {
          description: errorMessage,
          duration: 8000,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido";
      setQrCodeResult({
        success: false,
        message: errorMessage,
      });
      toast.error("Erro ao pagar QR Code", {
        description: errorMessage,
        duration: 8000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar chaves ao montar o componente ou mudar de conta
  useEffect(() => {
    listarChavesPix();
  }, [selectedAccount.id]);

  // Utilitários
  const handleCopyKey = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Chave PIX copiada!");
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getKeyTypeLabel = (keyType: string) => {
    switch (keyType) {
      case 'EVP': return 'Chave Aleatória (EVP)';
      case 'EMAIL': return 'E-mail';
      case 'PHONE': return 'Telefone';
      case 'DOCUMENT': return 'CPF/CNPJ';
      default: return keyType;
    }
  };

  const getKeyTypeIcon = (keyType: string) => {
    switch (keyType) {
      case 'EVP': return <Hash className="h-4 w-4" />;
      case 'EMAIL': return <Mail className="h-4 w-4" />;
      case 'PHONE': return <Phone className="h-4 w-4" />;
      case 'DOCUMENT': return <User className="h-4 w-4" />;
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
          <h2 className="text-xl font-semibold">Ações PIX - BrasilCash OTC</h2>
          <p className="text-sm text-muted-foreground">
            Operações PIX para conta OTC {selectedAccount.otcId}
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto">
          OTC {selectedAccount.otcId}
        </Badge>
      </div>

      <Tabs defaultValue="send" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="send" className="flex items-center gap-2">
            <SendHorizontal className="h-4 w-4" />
            Enviar PIX
          </TabsTrigger>
          <TabsTrigger value="qrcode" className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            Pagar QR Code
          </TabsTrigger>
          <TabsTrigger value="create-key" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Criar Chave PIX
          </TabsTrigger>
          <TabsTrigger value="list-keys" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Listar Chaves
          </TabsTrigger>
        </TabsList>

        {/* Tab: Enviar PIX */}
        <TabsContent value="send">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SendHorizontal className="h-5 w-5" />
                Enviar PIX via BrasilCash OTC
              </CardTitle>
              <CardDescription>
                Envie PIX para qualquer chave PIX válida usando a conta OTC {selectedAccount.otcId}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...sendForm}>
                <form onSubmit={sendForm.handleSubmit(onSendPix)} className="space-y-4">
                  <FormField
                    control={sendForm.control}
                    name="keyType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Chave PIX</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo de chave" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="CPF">CPF</SelectItem>
                            <SelectItem value="CNPJ">CNPJ</SelectItem>
                            <SelectItem value="EMAIL">E-mail</SelectItem>
                            <SelectItem value="PHONE">Telefone</SelectItem>
                            <SelectItem value="EVP">Chave Aleatória (EVP)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={sendForm.control}
                    name="pixKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chave PIX</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={
                              sendForm.watch("keyType") === "EVP"
                                ? "Chave aleatória (EVP)"
                                : sendForm.watch("keyType") === "EMAIL"
                                ? "exemplo@email.com"
                                : sendForm.watch("keyType") === "PHONE"
                                ? "+5511999999999"
                                : sendForm.watch("keyType") === "CPF"
                                ? "000.000.000-00"
                                : "00.000.000/0000-00"
                            }
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={sendForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor (R$)</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="0,00"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={sendForm.control}
                    name="externalId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID Externo (Opcional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="ID para rastreamento"
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
                        Enviando...
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

              {/* Resultado */}
              {pixResult && (
                <div className={`mt-6 p-4 rounded-lg border ${
                  pixResult.success 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start gap-3">
                    {pixResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={`font-medium ${
                        pixResult.success ? 'text-green-900' : 'text-red-900'
                      }`}>
                        {pixResult.message}
                      </p>
                      {pixResult.success && pixResult.transaction && (
                        <div className="mt-2 space-y-1 text-sm">
                          {pixResult.transaction.end_to_end_id && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">EndToEndId:</span>
                              <code className="text-xs">{pixResult.transaction.end_to_end_id}</code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyKey(pixResult.transaction.end_to_end_id)}
                                className="h-6 w-6 p-0"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          {pixResult.transaction.external_id && (
                            <div>
                              <span className="text-muted-foreground">External ID:</span>
                              <code className="text-xs ml-2">{pixResult.transaction.external_id}</code>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Pagar QR Code */}
        <TabsContent value="qrcode">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Pagar QR Code PIX
              </CardTitle>
              <CardDescription>
                Pague um PIX a partir do payload do QR Code (EMV). Conta: OTC {selectedAccount.otcId}
                {selectedAccount.accountId ? " • UUID enviado (X-Account-Id)" : ""}.
                Valor e ID externo são opcionais (enviar apenas quando fizer sentido).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...qrCodeForm}>
                <form onSubmit={qrCodeForm.handleSubmit(onPayQrCode)} className="space-y-4">
                  <FormField
                    control={qrCodeForm.control}
                    name="qr_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payload do QR Code (EMV)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="00020126890014BR.GOV.BCB.PIX..."
                            className="font-mono text-sm min-h-[120px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={qrCodeForm.control}
                    name="external_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID Externo (Opcional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: ordem-12345 (rastreamento)"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={qrCodeForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor (R$) — Opcional</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="0,00 (ex.: QR dinâmico Binance)"
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
                        Processando...
                      </>
                    ) : (
                      <>
                        <QrCode className="mr-2 h-4 w-4" />
                        Pagar QR Code
                      </>
                    )}
                  </Button>
                </form>
              </Form>

              {qrCodeResult && (
                <div
                  className={`mt-6 p-4 rounded-lg border ${
                    qrCodeResult.success
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {qrCodeResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p
                        className={`font-medium ${
                          qrCodeResult.success ? "text-green-900" : "text-red-900"
                        }`}
                      >
                        {qrCodeResult.message}
                      </p>
                      {qrCodeResult.success && (
                        <div className="mt-2 space-y-1 text-sm">
                          {qrCodeResult.endToEndId && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">EndToEndId:</span>
                              <code className="text-xs">{qrCodeResult.endToEndId}</code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyKey(qrCodeResult.endToEndId)}
                                className="h-6 w-6 p-0"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          {qrCodeResult.amount != null && (
                            <div>
                              <span className="text-muted-foreground">Valor:</span>{" "}
                              R$ {(qrCodeResult.amount / 100).toFixed(2)}
                            </div>
                          )}
                          {qrCodeResult.external_id && (
                            <div>
                              <span className="text-muted-foreground">External ID:</span>{" "}
                              <code className="text-xs">{qrCodeResult.external_id}</code>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Criar Chave PIX */}
        <TabsContent value="create-key">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Criar Chave PIX
              </CardTitle>
              <CardDescription>
                Crie uma nova chave PIX para a conta OTC {selectedAccount.otcId}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...pixKeyForm}>
                <form onSubmit={pixKeyForm.handleSubmit(onCreatePixKey)} className="space-y-4">
                  <FormField
                    control={pixKeyForm.control}
                    name="keyType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Chave PIX</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo de chave" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="CPF">CPF</SelectItem>
                            <SelectItem value="CNPJ">CNPJ</SelectItem>
                            <SelectItem value="EMAIL">E-mail</SelectItem>
                            <SelectItem value="PHONE">Telefone</SelectItem>
                            <SelectItem value="EVP">Chave Aleatória (EVP)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {pixKeyForm.watch("keyType") !== "EVP" && (
                    <FormField
                      control={pixKeyForm.control}
                      name="pixKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Chave PIX</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={
                                pixKeyForm.watch("keyType") === "EMAIL"
                                  ? "exemplo@email.com"
                                  : pixKeyForm.watch("keyType") === "PHONE"
                                  ? "+5511999999999"
                                  : pixKeyForm.watch("keyType") === "CPF"
                                  ? "000.000.000-00"
                                  : "00.000.000/0000-00"
                              }
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {pixKeyForm.watch("keyType") === "EVP" && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-900">
                        A chave aleatória (EVP) será gerada automaticamente pela API.
                      </p>
                    </div>
                  )}

                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      <>
                        <Key className="mr-2 h-4 w-4" />
                        Criar Chave PIX
                      </>
                    )}
                  </Button>
                </form>
              </Form>

              {/* Resultado */}
              {pixKeyResult && (
                <div className={`mt-6 p-4 rounded-lg border ${
                  pixKeyResult.success 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start gap-3">
                    {pixKeyResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={`font-medium ${
                        pixKeyResult.success ? 'text-green-900' : 'text-red-900'
                      }`}>
                        {pixKeyResult.message}
                      </p>
                      {pixKeyResult.success && pixKeyResult.key && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Chave criada:</span>
                          <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                            {pixKeyResult.key}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyKey(pixKeyResult.key)}
                            className="h-6 w-6 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Listar Chaves PIX */}
        <TabsContent value="list-keys">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <List className="h-5 w-5" />
                    Chaves PIX Cadastradas
                  </CardTitle>
                  <CardDescription>
                    Lista de todas as chaves PIX cadastradas na conta OTC {selectedAccount.otcId}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={listarChavesPix}
                  disabled={loadingKeys}
                >
                  {loadingKeys ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    <>
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Atualizar
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingKeys ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Carregando chaves PIX...</span>
                </div>
              ) : pixKeys.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Key className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Nenhuma chave PIX cadastrada
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Crie uma chave PIX na aba "Criar Chave PIX"
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pixKeys.map((chave) => (
                    <div
                      key={chave.pixKeyId}
                      className="p-4 border rounded-lg bg-background hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            {getKeyTypeIcon(chave.keyType)}
                            <Badge variant="secondary" className="text-xs">
                              {getKeyTypeLabel(chave.keyType)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                              {chave.key}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyKey(chave.key)}
                              className="h-7 w-7 p-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <p>Cadastrada em: {formatDate(chave.registerDate)}</p>
                            <p className="mt-1">ID: {chave.pixKeyId}</p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 text-xs">
                          {chave.receiveDict && (
                            <Badge variant="outline" className="text-[10px]">
                              DICT
                            </Badge>
                          )}
                          {chave.receiveQRCodeDynamic && (
                            <Badge variant="outline" className="text-[10px]">
                              QR Dinâmico
                            </Badge>
                          )}
                          {chave.receiveQRCodeStatic && (
                            <Badge variant="outline" className="text-[10px]">
                              QR Estático
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
