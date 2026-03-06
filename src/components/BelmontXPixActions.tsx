/**
 * 🎯 COMPONENTE DE AÇÕES PIX DO BELMONTX
 * 
 * Interface específica para operações PIX do BelmontX
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
import { transferirPixBelmontX } from "@/services/belmontx";
import { useBelmontXOtc } from "@/contexts/BelmontXOtcContext";

// Constantes para BelmontX OTC
const BELMONTX_TENANT_ID = 3;
const BELMONTX_ACCOUNT_UUID = "130e63e7-c9b7-451d-827e-7b04ef5914f8";

// Schema de validação
const pixSendSchema = z.object({
  pixKey: z.string().min(1, "Chave PIX é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Valor deve ser maior que zero"
  ),
  descricao: z.string().optional(),
});

type PixSendData = z.infer<typeof pixSendSchema>;

export default function BelmontXPixActions() {
  const { selectedAccount } = useBelmontXOtc();
  const [isLoading, setIsLoading] = useState(false);
  const [pixResult, setPixResult] = useState<any>(null);

  // Form
  const sendForm = useForm<PixSendData>({
    resolver: zodResolver(pixSendSchema),
    defaultValues: {
      pixKey: "",
      amount: "",
      descricao: "",
    },
  });

  // Enviar PIX
  const onSendPix = async (data: PixSendData) => {
    try {
      setIsLoading(true);
      setPixResult(null);

      const amountNumber = parseFloat(data.amount.replace(/[^\d.,-]/g, "").replace(",", "."));

      // Chamada conforme documentação API BelmontX: POST /api/belmontx/transferir-pix
      const response = await transferirPixBelmontX({
        chavePixDestino: data.pixKey.trim(),
        valor: amountNumber,
        descricao: data.descricao || `Transferência via BelmontX OTC`,
        conta: selectedAccount,
      });

      if (response?.response?.success) {
        setPixResult({
          success: true,
          transaction: {
            id: response.response.idEnvio,
            end_to_end_id: response.response.dadosOriginais?.endToEnd || '',
            status: 'COMPLETE',
            amount: response.response.valorReais,
            createdAt: new Date().toISOString(),
          },
          message: response.mensagem || "PIX enviado com sucesso!"
        });

        toast.success("PIX enviado!", {
          description: `R$ ${data.amount} para ${data.pixKey} • Tenant: OTC`,
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
          <h2 className="text-xl font-semibold">Ações PIX - BelmontX</h2>
          <p className="text-sm text-muted-foreground">
            Operações PIX integradas ao sistema BelmontX
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto">
          Conta BelmontX Ativa
        </Badge>
      </div>

      <Tabs defaultValue="send" className="w-full">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="send" className="flex items-center gap-2">
            <SendHorizontal className="h-4 w-4" />
            Enviar PIX
          </TabsTrigger>
        </TabsList>

        {/* Tab: Enviar PIX */}
        <TabsContent value="send">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SendHorizontal className="h-5 w-5" />
                Enviar PIX via BelmontX
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                Transferência imediata usando chave PIX do destinatário
                <Badge variant="outline" className="ml-2">
                  Conta: {selectedAccount.toUpperCase()}
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

                  {/* Descrição (Opcional) */}
                  <FormField
                    control={sendForm.control}
                    name="descricao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição (Opcional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Descrição para o comprovante (máx 140 caracteres)"
                            disabled={isLoading}
                            maxLength={140}
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

      </Tabs>
    </div>
  );
}

