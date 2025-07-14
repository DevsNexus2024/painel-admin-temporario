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
import { enviarPixPorChave, validarChavePix, formatarChavePix, consultarChavePix, PixKeyConsultResponse } from "@/services/pix";

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

export default function SendByKeyForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isConsultingKey, setIsConsultingKey] = useState(false);
  const [keyConsultData, setKeyConsultData] = useState<PixKeyConsultResponse | null>(null);
  const [apiResponse, setApiResponse] = useState<{
    sucesso: boolean;
    mensagem: string;
    codigoTransacao?: string;
  } | null>(null);
  
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

  // Função para consultar a chave PIX automaticamente
  const consultarChaveAutomaticamente = async (chave: string) => {
    try {
      setIsConsultingKey(true);
      setKeyConsultData(null);
      
      const resultado = await consultarChavePix(chave);
      
      if (resultado.sucesso) {
        setKeyConsultData(resultado);
        toast.success("Destinatário encontrado!", {
          description: `${resultado.nomeCorrentista}`,
          duration: 3000,
        });
      } else {
        setKeyConsultData(null);
        // Não mostrar toast de erro para não incomodar o usuário
      }
    } catch (error) {
      console.error('Erro ao consultar chave:', error);
      setKeyConsultData(null);
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

      const response = await enviarPixPorChave(requestData);
      
      setApiResponse({
        sucesso: response.sucesso,
        mensagem: response.mensagem,
        codigoTransacao: response.codigoTransacao
      });

      if (response.sucesso) {
        toast.success("PIX enviado com sucesso!", {
          description: "Verifique os detalhes abaixo",
          duration: 4000,
          icon: <CheckCircle className="h-4 w-4" />
        });
        form.reset();
        setKeyConsultData(null); // Limpar dados de consulta
      } else {
        toast.error("Falha ao enviar PIX", {
          description: response.mensagem || "Erro desconhecido",
          duration: 6000,
          icon: <AlertCircle className="h-4 w-4" />
        });
      }
    } catch (error) {
      console.error("Erro ao enviar PIX:", error);
      
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
    const keyType = form.getValues("keyType");
    if (keyType) {
      const tipoChaveParaFormatacao = {
        'CPF': 'cpf',
        'CNPJ': 'cnpj', 
        'EMAIL': 'email',
        'PHONE': 'telefone',
        'EVP': 'aleatoria'
      }[keyType];
      
      // Para telefone, garantir que tenha +55 mas sem duplicar
      if (keyType === "PHONE") {
        let cleanValue = value;
        
        // Remove tudo exceto números e o +
        cleanValue = cleanValue.replace(/[^\d+]/g, '');
        
        // Remove + duplicados se houver
        if (cleanValue.startsWith('+')) {
          cleanValue = '+' + cleanValue.substring(1).replace(/\+/g, '');
        }
        
        // Se não começar com +55, adicionar
        if (!cleanValue.startsWith('+55')) {
          // Remove qualquer + inicial e 55 inicial para evitar duplicação
          cleanValue = cleanValue.replace(/^\+?55?/, '');
          cleanValue = '+55' + cleanValue;
        }
        
        // Formatar usando a função do serviço PIX
        const formattedKey = formatarChavePix(cleanValue, tipoChaveParaFormatacao || keyType);
        form.setValue("pixKey", formattedKey);
      } else {
        const formattedKey = formatarChavePix(value, tipoChaveParaFormatacao || keyType);
        form.setValue("pixKey", formattedKey);
      }
    } else {
      form.setValue("pixKey", value);
    }
    
    // Limpar dados de consulta anterior quando a chave mudar
    if (keyConsultData) {
      setKeyConsultData(null);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Seletor de Tipo de Chave */}
          <FormField
            control={form.control}
            name="keyType"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">
                  Tipo de Chave PIX
                </FormLabel>
                <Select 
                  onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue("pixKey", "");
                    setKeyConsultData(null);
                  }} 
                  value={field.value}
                  disabled={isLoading}
                >
                  <FormControl>
                    <SelectTrigger className="h-11 rounded-lg border-border hover:border-border/80 focus:border-primary transition-colors">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="CPF" className="rounded-md">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        CPF
                      </div>
                    </SelectItem>
                    <SelectItem value="CNPJ" className="rounded-md">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        CNPJ
                      </div>
                    </SelectItem>
                    <SelectItem value="EMAIL" className="rounded-md">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        E-mail
                      </div>
                    </SelectItem>
                    <SelectItem value="PHONE" className="rounded-md">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        Telefone
                      </div>
                    </SelectItem>
                    <SelectItem value="EVP" className="rounded-md">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                        Chave Aleatória
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          {/* Campo da Chave PIX */}
          <FormField
            control={form.control}
            name="pixKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">
                  Chave PIX do Destinatário
                  {isConsultingKey && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (consultando...)
                    </span>
                  )}
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder={
                        form.watch("keyType") === "PHONE" 
                          ? "+55 (11) 99999-9999" 
                          : "Digite ou cole a chave PIX"
                      }
                      className="pl-10 h-11 rounded-lg border-border hover:border-border/80 focus:border-primary transition-colors"
                      disabled={isLoading}
                      onChange={(e) => handleKeyChange(e.target.value)}
                      value={field.value}
                    />
                    {isConsultingKey && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {keyConsultData && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          {/* Card com Dados do Destinatário */}
          {keyConsultData && (
            <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      Dados do Destinatário
                    </h4>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <div>
                      <span className="font-medium text-blue-700 dark:text-blue-300">Nome:</span>
                      <span className="ml-2 text-blue-800 dark:text-blue-200">
                        {keyConsultData.nomeCorrentista}
                      </span>
                    </div>
                    
                    <div>
                      <span className="font-medium text-blue-700 dark:text-blue-300">Documento:</span>
                      <span className="ml-2 text-blue-800 dark:text-blue-200">
                        {keyConsultData.documentoFederal}
                      </span>
                    </div>
                    
                    <div>
                      <span className="font-medium text-blue-700 dark:text-blue-300">Banco:</span>
                      <span className="ml-2 text-blue-800 dark:text-blue-200">
                        {keyConsultData.banco.descricao}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Campo do Valor */}
          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">
                  Valor
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0.01"
                      placeholder="0,00" 
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
                    placeholder="Ex: Pagamento, presente..." 
                    className="h-11 rounded-lg border-border hover:border-border/80 focus:border-primary transition-colors"
                    disabled={isLoading}
                    {...field} 
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          {/* Botão de Envio */}
          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando PIX...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <SendHorizontal className="h-4 w-4" />
                Enviar PIX
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
                  {apiResponse.sucesso ? 'PIX Enviado!' : 'Erro no PIX'}
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