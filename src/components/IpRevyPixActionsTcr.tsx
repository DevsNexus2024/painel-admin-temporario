/**
 * 🎯 COMPONENTE DE AÇÕES PIX DO IP REVY
 * 
 * Interface específica para operações PIX do IP Revy
 * Replicando o design do BitsoPixActions
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
  DollarSign,
  Key,
  Plus,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { sendRevyPixPayment, listRevyPixKeys, createRevyPixKey, RevyPixKey } from "@/services/revy";

// Constantes para IP Revy TCR
const IP_REVY_TENANT_ID = 2;
const IP_REVY_ACCOUNT_UUID = "130e63e7-c9b7-451d-827e-7b04ef5914f8"; // TODO: Confirmar accountUUID correto para TCR

// Schema de validação
const pixSendSchema = z.object({
  pixKey: z.string().min(1, "Chave PIX é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Valor deve ser maior que zero"
  ),
  pin: z.string().min(1, "PIN transacional é obrigatório"),
});

type PixSendData = z.infer<typeof pixSendSchema>;

export default function IpRevyPixActionsTcr() {
  const [isLoading, setIsLoading] = useState(false);
  const [pixResult, setPixResult] = useState<any>(null);

  // Form
  const sendForm = useForm<PixSendData>({
    resolver: zodResolver(pixSendSchema),
    defaultValues: {
      pixKey: "",
      amount: "",
      pin: "",
    },
  });

  // Enviar PIX
  const onSendPix = async (data: PixSendData) => {
    try {
      setIsLoading(true);
      setPixResult(null);

      const amountNumber = parseFloat(data.amount.replace(/[^\d.,-]/g, "").replace(",", "."));

      const response = await sendRevyPixPayment(IP_REVY_ACCOUNT_UUID, {
        key: data.pixKey.trim(),
        amount: amountNumber,
        pin: data.pin.trim(),
      });

      if (response?.transaction) {
        setPixResult({
          success: true,
          transaction: {
            id: response.transaction.id,
            end_to_end_id: response.transaction.endToEnd,
            status: response.transaction.status,
            amount: response.transaction.amount,
            createdAt: response.transaction.createdAt,
          },
          message: "PIX enviado com sucesso!"
        });

        toast.success("PIX enviado!", {
          description: `R$ ${data.amount} para ${data.pixKey} • Tenant: TCR`,
          duration: 4000,
        });

        sendForm.reset();
      } else {
        throw new Error("Resposta inválida da API");
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-orange-500/10">
          <SendHorizontal className="h-6 w-6 text-orange-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Ações PIX - IP Revy</h2>
          <p className="text-sm text-muted-foreground">
            Operações PIX integradas ao sistema IP Revy
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto">
          Conta IP Revy Ativa
        </Badge>
      </div>

      <Tabs defaultValue="send" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="send" className="flex items-center gap-2">
            <SendHorizontal className="h-4 w-4" />
            Enviar PIX
          </TabsTrigger>
          <TabsTrigger value="keys" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Chaves PIX
          </TabsTrigger>
        </TabsList>

        {/* Tab: Enviar PIX */}
        <TabsContent value="send">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SendHorizontal className="h-5 w-5" />
                Enviar PIX via IP Revy
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                Transferência imediata usando chave PIX do destinatário
                <Badge variant="outline" className="ml-2">
                  Tenant: TCR (ID: {IP_REVY_TENANT_ID})
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...sendForm}>
                <form onSubmit={sendForm.handleSubmit(onSendPix)} className="space-y-4">
                  {/* Chave PIX */}
                  <FormField
                    control={sendForm.control}
                    name="pixKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chave PIX do Destinatário</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              placeholder="Digite a chave PIX (CPF, CNPJ, Email, Telefone ou Chave Aleatória)"
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

                  {/* PIN Transacional */}
                  <FormField
                    control={sendForm.control}
                    name="pin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PIN Transacional</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              type="password"
                              placeholder="Digite o PIN transacional"
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
                          <div className="mt-2 text-sm text-muted-foreground space-y-1">
                            {pixResult.transaction.id && (
                              <p>Transaction ID: {pixResult.transaction.id}</p>
                            )}
                            {pixResult.transaction.end_to_end_id && (
                              <div className="flex items-center gap-2">
                                <p>End-to-End ID: {pixResult.transaction.end_to_end_id}</p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    navigator.clipboard.writeText(pixResult.transaction.end_to_end_id);
                                    toast.success('End-to-End ID copiado!');
                                  }}
                                  className="h-6 w-6 p-0"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                            {pixResult.transaction.status && (
                              <p>Status: {pixResult.transaction.status}</p>
                            )}
                            {pixResult.transaction.amount && (
                              <p>Valor: R$ {pixResult.transaction.amount.toFixed(2)}</p>
                            )}
                          </div>
                        )}
                        {!pixResult.success && (
                          <div className="mt-2 text-sm text-red-700">
                            <p>{pixResult.message}</p>
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

        {/* Tab: Chaves PIX */}
        <TabsContent value="keys">
          <PixKeysSection accountId={IP_REVY_ACCOUNT_UUID} tenantLabel="TCR" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Componente para gerenciar chaves PIX
function PixKeysSection({ accountId, tenantLabel }: { accountId: string; tenantLabel: string }) {
  const [keys, setKeys] = useState<RevyPixKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [keyType, setKeyType] = useState<"EVP" | "CPF" | "CNPJ" | "EMAIL" | "PHONE">("EVP");
  const [keyValue, setKeyValue] = useState("");

  // Carregar chaves ao montar
  const loadKeys = async () => {
    try {
      setIsLoading(true);
      const response = await listRevyPixKeys(accountId);
      setKeys(response.keys || []);
    } catch (error: any) {
      toast.error("Erro ao carregar chaves PIX", {
        description: error.message || "Tente novamente",
      });
      setKeys([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, [accountId]);

  // Criar nova chave
  const handleCreateKey = async () => {
    try {
      if (!keyType) {
        toast.error("Selecione o tipo da chave PIX");
        return;
      }

      // Validar chave para tipos que não sejam EVP
      if (keyType !== "EVP" && !keyValue.trim()) {
        toast.error(`Informe o valor da chave ${keyType}`);
        return;
      }

      setIsCreating(true);

      const payload: any = { keyType };
      if (keyType !== "EVP" && keyValue.trim()) {
        payload.key = keyValue.trim();
      }

      const response = await createRevyPixKey(accountId, payload);

      if (response?.key) {
        toast.success("Chave PIX criada com sucesso!", {
          description: `Chave ${response.key.type} registrada`,
        });
        setKeyValue("");
        setKeyType("EVP");
        loadKeys();
      }
    } catch (error: any) {
      toast.error("Erro ao criar chave PIX", {
        description: error.message || "Tente novamente",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Formatar tipo de chave
  const formatKeyType = (type: string) => {
    const types: Record<string, string> = {
      EVP: "Chave Aleatória (EVP)",
      CPF: "CPF",
      CNPJ: "CNPJ",
      EMAIL: "E-mail",
      PHONE: "Telefone",
    };
    return types[type] || type;
  };

  // Formatar chave para exibição
  const formatKey = (key: string, type: string) => {
    if (type === "CPF") {
      return key.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    if (type === "CNPJ") {
      return key.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    if (type === "PHONE") {
      return key.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    return key;
  };

  return (
    <div className="space-y-6">
      {/* Criar Chave */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Criar Nova Chave PIX
          </CardTitle>
          <CardDescription>
            Registre uma nova chave PIX para recebimentos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Chave</Label>
              <Select value={keyType} onValueChange={(value: any) => setKeyType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EVP">Chave Aleatória (EVP)</SelectItem>
                  <SelectItem value="CPF">CPF</SelectItem>
                  <SelectItem value="CNPJ">CNPJ</SelectItem>
                  <SelectItem value="EMAIL">E-mail</SelectItem>
                  <SelectItem value="PHONE">Telefone</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {keyType !== "EVP" && (
              <div className="space-y-2">
                <Label>
                  {keyType === "CPF" ? "CPF" : keyType === "CNPJ" ? "CNPJ" : keyType === "EMAIL" ? "E-mail" : "Telefone"}
                </Label>
                <Input
                  placeholder={
                    keyType === "CPF"
                      ? "000.000.000-00"
                      : keyType === "CNPJ"
                      ? "00.000.000/0000-00"
                      : keyType === "EMAIL"
                      ? "exemplo@email.com"
                      : "(00) 00000-0000"
                  }
                  value={keyValue}
                  onChange={(e) => setKeyValue(e.target.value)}
                  disabled={isCreating}
                />
              </div>
            )}
          </div>

          <Button
            onClick={handleCreateKey}
            disabled={isCreating || (keyType !== "EVP" && !keyValue.trim())}
            className="w-full"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando chave...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Criar Chave PIX
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Listar Chaves */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Minhas Chaves PIX
                <Badge variant="secondary" className="ml-2">
                  {tenantLabel}
                </Badge>
              </CardTitle>
              <CardDescription>
                Chaves registradas na conta IP Revy
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadKeys} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma chave PIX cadastrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={key.status === "ACTIVE" ? "default" : "secondary"}
                        className={
                          key.status === "ACTIVE"
                            ? "bg-green-100 text-green-800 border-green-200"
                            : ""
                        }
                      >
                        {key.status === "ACTIVE" ? "Ativa" : "Inativa"}
                      </Badge>
                      <Badge variant="outline">{formatKeyType(key.type)}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                        {formatKey(key.key, key.type)}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(key.key);
                          toast.success("Chave copiada!");
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

