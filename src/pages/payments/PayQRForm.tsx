import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { QrCode, Loader2, CheckCircle, AlertCircle, Copy, Camera, Clipboard, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { pagarComQRCode, validarCodigoEMV, lerQRCodePix, QRCodeReadResponse } from "@/services/pix";

const qrCodeSchema = z.object({
  emvCode: z.string().min(1, "Código EMV é obrigatório"),
  value: z.string().optional(),
  description: z.string().optional(),
});

type QRCodeFormData = z.infer<typeof qrCodeSchema>;

export default function PayQRForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isReadingQR, setIsReadingQR] = useState(false);
  const [apiResponse, setApiResponse] = useState<{
    sucesso: boolean;
    mensagem: string;
    codigoTransacao?: string;
  } | null>(null);
  
  const form = useForm<QRCodeFormData>({
    resolver: zodResolver(qrCodeSchema),
    defaultValues: {
      emvCode: "",
      value: "",
      description: "",
    },
  });

  const watchedEmvCode = form.watch("emvCode");
  const isCodeValid = validarCodigoEMV(watchedEmvCode);

  // Debounce para leitura automática do QR code
  useEffect(() => {
    const emvCode = form.watch("emvCode");
    
    if (!emvCode || !validarCodigoEMV(emvCode)) {
      return;
    }

    const timer = setTimeout(() => {
      lerQRCodeAutomaticamente(emvCode);
    }, 800); // 800ms de debounce

    return () => clearTimeout(timer);
  }, [form.watch("emvCode")]);

  // Função para ler QR code automaticamente
  const lerQRCodeAutomaticamente = async (emvCode: string) => {
    try {
      setIsReadingQR(true);
      
      const resultado = await lerQRCodePix(emvCode);
      
      if (resultado.sucesso) {
        // Se o QR tem valor embutido, preencher automaticamente
        if (resultado.valor && resultado.valor > 0) {
          form.setValue("value", resultado.valor.toString());
          toast.success("QR Code lido!", {
            description: `Valor R$ ${resultado.valor.toFixed(2)} preenchido automaticamente`,
            duration: 3000,
          });
        } else {
          toast.success("QR Code válido!", {
            description: "Informe o valor desejado",
            duration: 2000,
          });
        }
      } else {
        // Não mostrar toast de erro para não incomodar o usuário
        console.log("QR code inválido ou erro na leitura");
      }
    } catch (error) {
      console.error('Erro ao ler QR code:', error);
    } finally {
      setIsReadingQR(false);
    }
  };

  const onSubmit = async (data: QRCodeFormData) => {
    try {
      setIsLoading(true);
      setApiResponse(null);

      if (!validarCodigoEMV(data.emvCode)) {
        toast.error("Código EMV inválido!", {
          description: "Verifique se o código QR está completo e correto"
        });
        return;
      }

      const requestData = {
        emv: data.emvCode,
        valor: data.value ? parseFloat(data.value) : undefined,
        descricao: data.description || "Pagamento PIX QR Code"
      };

      const response = await pagarComQRCode(requestData);
      
      setApiResponse({
        sucesso: response.sucesso,
        mensagem: response.mensagem,
        codigoTransacao: response.codigoTransacao
      });

      if (response.sucesso) {
        toast.success("Pagamento processado com sucesso!", {
          description: "Verifique os detalhes abaixo",
          duration: 4000,
          icon: <CheckCircle className="h-4 w-4" />
        });
        form.reset();
      } else {
        toast.error("Falha ao processar pagamento", {
          description: response.mensagem || "Erro desconhecido",
          duration: 6000,
          icon: <AlertCircle className="h-4 w-4" />
        });
      }
    } catch (error) {
      console.error("Erro ao processar pagamento QR Code:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Erro inesperado";
      
      setApiResponse({
        sucesso: false,
        mensagem: errorMessage,
      });
      
      toast.error("Erro ao processar pagamento", {
        description: errorMessage,
        duration: 6000,
        icon: <AlertCircle className="h-4 w-4" />
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        form.setValue('emvCode', text);
        
        if (validarCodigoEMV(text)) {
          toast.success("Código QR válido colado!");
        } else {
          toast.warning("Código colado, mas parece inválido", {
            description: "Verifique se o código está completo"
          });
        }
      }
    } catch (error) {
      toast.error("Erro ao colar código. Tente novamente.");
    }
  };

  const simulateScanQR = () => {
    const mockCode = import.meta.env.VITE_PIX_MOCK_QR_CODE;
    form.setValue('emvCode', mockCode);
    toast.success("QR Code simulado escaneado!");
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };

  // Função para tratar mudanças no campo EMV
  const handleEmvChange = (value: string) => {
    form.setValue('emvCode', value);
  };

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Campo do Código EMV */}
          <FormField
            control={form.control}
            name="emvCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">
                  Código QR ou EMV
                  {isReadingQR && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (lendo...)
                    </span>
                  )}
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Textarea 
                      placeholder="Cole aqui o código QR ou EMV do PIX..."
                      className="min-h-[80px] rounded-lg border-border hover:border-border/80 focus:border-primary transition-colors text-sm font-mono resize-none"
                      disabled={isLoading}
                      onChange={(e) => handleEmvChange(e.target.value)}
                      value={field.value}
                    />
                    {isReadingQR && (
                      <div className="absolute top-2 right-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {isCodeValid && !isReadingQR && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormMessage className="text-xs" />
                {isCodeValid && (
                  <div className="flex items-center gap-1 mt-1">
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                      Código válido
                    </Badge>
                  </div>
                )}
              </FormItem>
            )}
          />

          {/* Campo do Valor (Opcional) */}
          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">
                  Valor
                  <span className="text-muted-foreground text-xs ml-1">(será preenchido automaticamente se o QR tiver valor)</span>
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      type="number" 
                      step="0.01" 
                      placeholder="Valor será preenchido automaticamente" 
                      className="pl-10 h-11 rounded-lg border-border hover:border-border/80 focus:border-primary transition-colors font-mono"
                      disabled={isLoading}
                      {...field} 
                    />
                  </div>
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          {/* Campo de Descrição */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">
                  Descrição
                  <span className="text-muted-foreground text-xs ml-1">(opcional)</span>
                </FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Ex: Pagamento de produto..." 
                    className="h-11 rounded-lg border-border hover:border-border/80 focus:border-primary transition-colors"
                    disabled={isLoading}
                    {...field} 
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          {/* Botão de Pagamento */}
          <Button 
            type="submit" 
            disabled={isLoading || !isCodeValid}
            className="w-full h-12 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                Pagar com QR
              </span>
            )}
          </Button>
        </form>
      </Form>

      {/* Resposta da API */}
      {apiResponse && (
        <Card className={`border-l-4 ${
          apiResponse.sucesso 
            ? 'border-l-green-500 bg-green-50/50 dark:bg-green-950/20' 
            : 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full ${
                apiResponse.sucesso 
                  ? 'bg-green-100 dark:bg-green-900/50' 
                  : 'bg-red-100 dark:bg-red-900/50'
              }`}>
                {apiResponse.sucesso ? (
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`text-sm font-medium ${
                  apiResponse.sucesso 
                    ? 'text-green-900 dark:text-green-100' 
                    : 'text-red-900 dark:text-red-100'
                }`}>
                  {apiResponse.sucesso ? 'Pagamento Realizado!' : 'Erro no Pagamento'}
                </h4>
                <p className={`text-xs mt-1 ${
                  apiResponse.sucesso 
                    ? 'text-green-700 dark:text-green-300' 
                    : 'text-red-700 dark:text-red-300'
                }`}>
                  {apiResponse.mensagem}
                </p>
                {apiResponse.codigoTransacao && (
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs font-mono">
                      {apiResponse.codigoTransacao}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyCode(apiResponse.codigoTransacao!)}
                      className="h-6 px-2 text-xs"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}