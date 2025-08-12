import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { SendHorizontal, Loader2, CheckCircle, AlertCircle, Copy, User, DollarSign, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { validarChavePix, formatarChavePix } from "@/services/pix";
import { Bmp531Service, type Bmp531PixConsultarChaveResponse, type Bmp531PixEnviarResponse } from "@/services/bmp531";

const keyTransferSchema = z.object({
  keyType: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"], {
    required_error: "Selecione o tipo de chave",
  }),
  pixKey: z.string().min(1, "Chave Pix é obrigatória"),
  value: z.string().min(1, "Valor é obrigatório").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Valor deve ser maior que zero"
  ),
  description: z.string().optional(),
});

type KeyTransferFormData = z.infer<typeof keyTransferSchema>;

export default function SendByKeyFormBmp531() {
  const [isLoading, setIsLoading] = useState(false);
  const [isConsultingKey, setIsConsultingKey] = useState(false);
  const [keyConsultData, setKeyConsultData] = useState<Bmp531PixConsultarChaveResponse['dadosChave'] | null>(null);
  const [apiResponse, setApiResponse] = useState<Bmp531PixEnviarResponse | null>(null);
  
  const form = useForm<KeyTransferFormData>({
    resolver: zodResolver(keyTransferSchema),
    defaultValues: {
      keyType: undefined,
      pixKey: "",
      value: "",
      description: "",
    },
  });

  // Debounce para consulta automática da chave
  useEffect(() => {
    const chave = form.watch("pixKey");
    const tipoChave = form.watch("keyType");
    
    if (!chave || !tipoChave || chave.length < 5) {
      setKeyConsultData(null);
      return;
    }

    const timer = setTimeout(() => {
      consultarChaveAutomaticamente(chave);
    }, 1000); // 1 segundo de debounce

    return () => clearTimeout(timer);
  }, [form.watch("pixKey"), form.watch("keyType")]);

  // Função para consultar chave PIX específica da BMP 531
  const consultarChaveAutomaticamente = async (chave: string) => {
    if (!chave || isConsultingKey) return;
    
    setIsConsultingKey(true);
    
    try {
      console.log("🔍 [SendByKeyFormBmp531] Consultando chave PIX BMP 531:", chave);
      
      // ✅ Usar serviço centralizado BMP 531
      const data = await Bmp531Service.consultarChave({ chave });
      
      if (data.sucesso && data.dadosChave) {
        console.log("✅ [SendByKeyFormBmp531] Chave PIX consultada com sucesso:", data.dadosChave);
        setKeyConsultData(data.dadosChave);
        
        toast.success("Chave PIX encontrada!", {
          description: `${data.dadosChave.nomeCorrentista} - ${data.dadosChave.banco?.descricao || "Banco"}`,
          duration: 3000
        });
      } else {
        console.log("⚠️ [SendByKeyFormBmp531] Chave PIX não encontrada ou inválida");
        setKeyConsultData(null);
        
        toast.warning("Chave PIX não encontrada", {
          description: "Verifique se a chave está correta",
          duration: 3000
        });
      }
      
    } catch (error: any) {
      console.error("❌ [SendByKeyFormBmp531] Erro ao consultar chave PIX:", error);
      setKeyConsultData(null);
      
      toast.error("Erro ao consultar chave PIX", {
        description: error.message || "Erro inesperado",
        duration: 3000
      });
    } finally {
      setIsConsultingKey(false);
    }
  };

  const onSubmit = async (data: KeyTransferFormData) => {
    try {
      setIsLoading(true);
      setApiResponse(null);

      const tipoChaveParaValidacao = {
        'CPF': 'cpf',
        'CNPJ': 'cnpj', 
        'EMAIL': 'email',
        'PHONE': 'telefone',
        'EVP': 'aleatoria'
      }[data.keyType];

      if (!validarChavePix(data.pixKey, tipoChaveParaValidacao || data.keyType)) {
        toast.error(`Formato de ${data.keyType} inválido!`, {
          description: "Verifique se a chave está no formato correto"
        });
        return;
      }

      const requestData = {
        chave: data.pixKey,
        valor: parseFloat(data.value),
        descricao: data.description || "Transferência PIX"
      };

      console.log("💸 [SendByKeyFormBmp531] Enviando PIX BMP 531:", requestData);

      // ✅ Usar serviço centralizado BMP 531
      const result = await Bmp531Service.enviarPix(requestData);
      
      setApiResponse(result);

      if (result.sucesso) {
        console.log("✅ [SendByKeyFormBmp531] PIX enviado com sucesso:", result);
        
        toast.success("PIX enviado com sucesso!", {
          description: "Verifique os detalhes abaixo",
          duration: 4000,
          icon: <CheckCircle className="h-4 w-4" />
        });
        form.reset();
        setKeyConsultData(null);
      } else {
        console.error("❌ [SendByKeyFormBmp531] Falha ao enviar PIX:", result);
        
        toast.error("Falha ao enviar PIX", {
          description: result.mensagem || "Erro desconhecido",
          duration: 6000,
          icon: <AlertCircle className="h-4 w-4" />
        });
      }
    } catch (error) {
      console.error("❌ [SendByKeyFormBmp531] Erro ao enviar PIX:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Erro inesperado";
      
      setApiResponse({
        sucesso: false,
        mensagem: errorMessage,
      });
      
      toast.error("Erro ao enviar PIX", {
        description: "Verifique os detalhes do erro abaixo",
        duration: 4000,
        icon: <AlertCircle className="h-4 w-4" />
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyChange = (value: string) => {
    const formatted = formatarChavePix(value, form.watch("keyType"));
    form.setValue("pixKey", formatted);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado para a área de transferência!");
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Tipo de Chave */}
          <FormField
            control={form.control}
            name="keyType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Chave PIX</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="CPF">CPF</SelectItem>
                    <SelectItem value="CNPJ">CNPJ</SelectItem>
                    <SelectItem value="EMAIL">E-mail</SelectItem>
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
            control={form.control}
            name="pixKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  Chave PIX
                  {isConsultingKey && (
                    <div className="flex items-center gap-1 text-blue-600">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs">Consultando...</span>
                    </div>
                  )}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Digite a chave PIX"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      handleKeyChange(e.target.value);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Mostrar dados da chave consultada */}
          {keyConsultData && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <User className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <h4 className="font-semibold text-green-800">
                      Chave PIX Encontrada
                    </h4>
                    <div className="space-y-1 text-sm">
                      <p><strong>Nome:</strong> {keyConsultData.nomeCorrentista}</p>
                      <p><strong>Documento:</strong> {keyConsultData.documentoFederal}</p>
                      <p><strong>Banco:</strong> {keyConsultData.banco?.descricao || "N/A"}</p>
                      {keyConsultData.conta && (
                        <p><strong>Conta:</strong> Ag: {keyConsultData.conta.agencia} | Conta: {keyConsultData.conta.conta}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Verificada
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Valor */}
          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor (R$)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="0,00"
                      className="pl-10"
                      {...field}
                      type="number"
                      step="0.01"
                      min="0.01"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Descrição */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição (opcional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Motivo da transferência"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Botão de Envio */}
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || isConsultingKey}
          >
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
                  {apiResponse.sucesso ? 'PIX Enviado com Sucesso!' : 'Falha no Envio do PIX'}
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
          Transações via BMP 531
        </Badge>
      </div>
    </div>
  );
}
