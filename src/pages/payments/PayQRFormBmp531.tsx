import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { QrCode, Loader2, CheckCircle, AlertCircle, Copy, Upload, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Bmp531Service, type Bmp531PixEnviarResponse } from "@/services/bmp531";

const qrCodeSchema = z.object({
  emv: z.string().min(1, "Código QR é obrigatório").min(10, "Código QR deve ter pelo menos 10 caracteres"),
  valor: z.string().optional().refine(
    (val) => !val || (!isNaN(parseFloat(val)) && parseFloat(val) > 0),
    "Valor deve ser maior que zero"
  ),
  descricao: z.string().optional(),
});

type QRCodeFormData = z.infer<typeof qrCodeSchema>;

export default function PayQRFormBmp531() {
  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<Bmp531PixEnviarResponse | null>(null);
  
  const form = useForm<QRCodeFormData>({
    resolver: zodResolver(qrCodeSchema),
    defaultValues: {
      emv: "",
      valor: "",
      descricao: "",
    },
  });

  const onSubmit = async (data: QRCodeFormData) => {
    try {
      setIsLoading(true);
      setApiResponse(null);

      const requestData = {
        emv: data.emv.trim(),
        valor: data.valor ? parseFloat(data.valor) : undefined,
        descricao: data.descricao || "Pagamento via QR Code"
      };

      console.log("📱 [PayQRFormBmp531] Pagando QR Code BMP 531:", requestData);

      // ✅ Usar serviço centralizado BMP 531
      const result = await Bmp531Service.pagarQrCode(requestData);
      
      setApiResponse(result);

      if (result.sucesso) {
        console.log("✅ [PayQRFormBmp531] QR Code pago com sucesso:", result);
        
        toast.success("QR Code pago com sucesso!", {
          description: "Verifique os detalhes abaixo",
          duration: 4000,
          icon: <CheckCircle className="h-4 w-4" />
        });
        form.reset();
      } else {
        console.error("❌ [PayQRFormBmp531] Falha ao pagar QR Code:", result);
        
        toast.error("Falha ao pagar QR Code", {
          description: result.mensagem || "Erro desconhecido",
          duration: 6000,
          icon: <AlertCircle className="h-4 w-4" />
        });
      }
    } catch (error) {
      console.error("❌ [PayQRFormBmp531] Erro ao pagar QR Code:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Erro inesperado";
      
      setApiResponse({
        sucesso: false,
        mensagem: errorMessage,
      });
      
      toast.error("Erro ao pagar QR Code", {
        description: "Verifique os detalhes do erro abaixo",
        duration: 4000,
        icon: <AlertCircle className="h-4 w-4" />
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado para a área de transferência!");
  };

  const handlePasteQRCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.length > 10) {
        form.setValue("emv", text);
        toast.success("Código QR colado!", {
          description: "Código obtido da área de transferência"
        });
      } else {
        toast.warning("Nenhum código QR válido encontrado na área de transferência");
      }
    } catch (error) {
      toast.error("Erro ao acessar área de transferência", {
        description: "Verifique as permissões do navegador"
      });
    }
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Código QR */}
          <FormField
            control={form.control}
            name="emv"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  Código QR (Copia e Cola)
                </FormLabel>
                <div className="space-y-2">
                  <FormControl>
                    <Textarea
                      placeholder="Cole aqui o código PIX copiado do QR Code..."
                      className="min-h-[100px] font-mono text-xs"
                      {...field}
                    />
                  </FormControl>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePasteQRCode}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-3 w-3" />
                      Colar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => form.setValue("emv", "")}
                      disabled={!field.value}
                    >
                      Limpar
                    </Button>
                  </div>
                </div>
                <FormMessage />
                {field.value && field.value.length > 10 && (
                  <div className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Código QR detectado ({field.value.length} caracteres)
                  </div>
                )}
              </FormItem>
            )}
          />

          {/* Valor (Opcional) */}
          <FormField
            control={form.control}
            name="valor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor (R$) - Opcional</FormLabel>
                <FormControl>
                  <Input
                    placeholder="0,00 - deixe vazio para usar valor do QR"
                    {...field}
                    type="number"
                    step="0.01"
                    min="0.01"
                  />
                </FormControl>
                <div className="text-xs text-muted-foreground">
                  Se não informado, será usado o valor original do QR Code
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Descrição */}
          <FormField
            control={form.control}
            name="descricao"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição (opcional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Motivo do pagamento"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Botão de Pagamento */}
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || !form.watch("emv")}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando Pagamento...
              </>
            ) : (
              <>
                <ScanLine className="mr-2 h-4 w-4" />
                Pagar QR Code
              </>
            )}
          </Button>
        </form>
      </Form>

      {/* Resultado da API */}
      {apiResponse && (
        <Card className={`border-2 ${apiResponse.sucesso ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${apiResponse.sucesso ? 'bg-green-100' : 'bg-red-100'}`}>
                {apiResponse.sucesso ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
              </div>
              <div className="flex-1">
                <h4 className={`font-semibold ${apiResponse.sucesso ? 'text-green-800' : 'text-red-800'}`}>
                  {apiResponse.sucesso ? 'QR Code Pago com Sucesso!' : 'Falha no Pagamento do QR Code'}
                </h4>
                <p className={`text-sm mt-1 ${apiResponse.sucesso ? 'text-green-700' : 'text-red-700'}`}>
                  {apiResponse.mensagem}
                </p>
                
                {apiResponse.codigoTransacao && (
                  <div className="mt-3 p-3 bg-white rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">CÓDIGO DA TRANSAÇÃO</p>
                        <p className="font-mono text-sm font-semibold">{apiResponse.codigoTransacao}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyCode(apiResponse.codigoTransacao!)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {apiResponse.status && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs font-medium text-muted-foreground">STATUS</p>
                        <Badge variant="default" className="mt-1">
                          {apiResponse.status}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Badge de identificação */}
      <div className="text-center">
        <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-medium">
          Pagamentos QR Code via BMP 531
        </Badge>
      </div>
    </div>
  );
}
