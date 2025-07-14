import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Loader2, CheckCircle, AlertCircle, Key, Copy, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { criarChavePix, validarChavePix, formatarChavePix } from "@/services/pix";

const createKeySchema = z.object({
  tipoChave: z.enum(["cpf", "cnpj", "email", "telefone", "aleatoria"], {
    required_error: "Selecione o tipo de chave",
  }),
  chave: z.string().optional(),
  codigoMfa: z.string().optional(),
});

type CreateKeyFormData = z.infer<typeof createKeySchema>;

interface ApiResponse {
  sucesso: boolean;
  etapa: string;
  mensagem: string;
  codigoAutenticacao?: string;
  chave?: string;
  tipoChave?: string;
  mfaEnviado?: boolean;
  proximoPasso?: string;
}

export default function CreatePixKeyForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
  const [codigoAutenticacao, setCodigoAutenticacao] = useState<string | null>(null);
  const [etapaAtual, setEtapaAtual] = useState<'INICIAL' | 'AGUARDANDO_MFA' | 'CONCLUIDO'>('INICIAL');
  
  const form = useForm<CreateKeyFormData>({
    resolver: zodResolver(createKeySchema),
    defaultValues: {
      tipoChave: undefined,
      chave: "",
      codigoMfa: "",
    },
  });

  const tipoChaveValue = form.watch("tipoChave");
  const chaveValue = form.watch("chave");

  const requerMfa = (tipo: string) => {
    return tipo === 'email' || tipo === 'telefone';
  };

  const validarChaveForTipo = (chave: string, tipo: string) => {
    if (tipo === 'aleatoria') return true;

    if (!chave || chave.trim() === '') {
      return false;
    }

    return validarChavePix(chave, tipo);
  };

  const onSubmit = async (data: CreateKeyFormData) => {
    try {
      setIsLoading(true);
      setApiResponse(null);

      if (data.tipoChave !== 'aleatoria') {
        if (!data.chave || data.chave.trim() === '') {
          toast.error(`Valor da chave é obrigatório para ${data.tipoChave.toUpperCase()}!`);
          return;
        }

        if (!validarChaveForTipo(data.chave, data.tipoChave)) {
          toast.error(`Formato de ${data.tipoChave.toUpperCase()} inválido!`, {
            description: "Verifique se a chave está no formato correto"
          });
          return;
        }
      }

      if (etapaAtual === 'AGUARDANDO_MFA' && (!data.codigoMfa || data.codigoMfa.trim() === '')) {
        toast.error("Digite o código de verificação!", {
          description: "Código enviado para seu " + (data.tipoChave === 'email' ? 'email' : 'telefone')
        });
        return;
      }

      const requestData: any = {
        tipoChave: data.tipoChave,
      };

      if (data.tipoChave !== 'aleatoria' && data.chave) {
        requestData.chave = data.chave;
      }

      if (etapaAtual === 'AGUARDANDO_MFA') {
        requestData.codigoMfa = data.codigoMfa;
        requestData.codigoAutenticacao = codigoAutenticacao;
      }

      const response = await criarChavePix(requestData);
      
      setApiResponse(response);

      if (response.sucesso) {
        if (response.etapa === 'MFA_SOLICITADO') {
          setEtapaAtual('AGUARDANDO_MFA');
          setCodigoAutenticacao(response.codigoAutenticacao || null);
          
          toast.success("Código de verificação enviado!", {
            description: response.mensagem,
            duration: 4000,
            icon: <CheckCircle className="h-4 w-4" />
          });
        } else if (response.etapa === 'CHAVE_CRIADA') {
          setEtapaAtual('CONCLUIDO');
          
          toast.success("Chave PIX criada com sucesso!", {
            description: response.mensagem,
            duration: 4000,
            icon: <CheckCircle className="h-4 w-4" />
          });

          setTimeout(() => {
            form.reset();
            setEtapaAtual('INICIAL');
            setCodigoAutenticacao(null);
            setApiResponse(null);
          }, 5000);
        }
      } else {
        toast.error("Falha ao criar chave PIX", {
          description: response.mensagem || "Erro desconhecido",
          duration: 6000,
          icon: <AlertCircle className="h-4 w-4" />
        });
      }
    } catch (error) {
      console.error("Erro ao criar chave PIX:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Erro inesperado";
      
      setApiResponse({
        sucesso: false,
        etapa: 'ERRO',
        mensagem: errorMessage,
      });
      
      toast.error("Erro ao criar chave PIX", {
        description: "Verifique os detalhes do erro abaixo",
        duration: 4000,
        icon: <AlertCircle className="h-4 w-4" />
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyChange = (value: string) => {
    const keyType = form.getValues("tipoChave");
    if (keyType && keyType !== 'aleatoria') {
      // Para telefone, garantir que tenha +55 mas sem duplicar
      if (keyType === 'telefone') {
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
        const formattedKey = formatarChavePix(cleanValue, keyType);
        form.setValue("chave", formattedKey);
      } else {
        const formattedKey = formatarChavePix(value, keyType);
        form.setValue("chave", formattedKey);
      }
    } else {
      form.setValue("chave", value);
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("Chave copiada!");
  };

  const handleNovaChave = () => {
    form.reset();
    setEtapaAtual('INICIAL');
    setCodigoAutenticacao(null);
    setApiResponse(null);
  };

  const getBotaoTexto = () => {
    if (etapaAtual === 'AGUARDANDO_MFA') return 'Verificar Código';
    return 'Criar Chave PIX';
  };

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Seletor de Tipo de Chave */}
          <FormField
            control={form.control}
            name="tipoChave"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">
                  Tipo de Chave PIX
                </FormLabel>
                <Select 
                  onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue("chave", "");
                    form.setValue("codigoMfa", "");
                    if (etapaAtual !== 'INICIAL') {
                      setEtapaAtual('INICIAL');
                      setApiResponse(null);
                    }
                  }} 
                  value={field.value}
                  disabled={isLoading || etapaAtual === 'AGUARDANDO_MFA'}
                >
                  <FormControl>
                    <SelectTrigger className="h-11 rounded-lg border-border hover:border-border/80 focus:border-primary transition-colors">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="cpf" className="rounded-md">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        CPF
                      </div>
                    </SelectItem>
                    <SelectItem value="cnpj" className="rounded-md">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        CNPJ
                      </div>
                    </SelectItem>
                    <SelectItem value="email" className="rounded-md">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        E-mail
                        <Badge variant="secondary" className="text-xs ml-auto">MFA</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="telefone" className="rounded-md">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        Telefone
                        <Badge variant="secondary" className="text-xs ml-auto">MFA</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="aleatoria" className="rounded-md">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                        Chave Aleatória
                        <Badge variant="outline" className="text-xs ml-auto">Recomendado</Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          {/* Campo da Chave (se não for aleatória) */}
          {tipoChaveValue && tipoChaveValue !== 'aleatoria' && (
            <FormField
              control={form.control}
              name="chave"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">
                    Valor da Chave {tipoChaveValue.toUpperCase()}
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      {tipoChaveValue === 'email' ? (
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      ) : tipoChaveValue === 'telefone' ? (
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      )}
                      <Input 
                        placeholder={
                          tipoChaveValue === 'email' ? 'seuemail@exemplo.com' :
                          tipoChaveValue === 'telefone' ? '+55 (11) 99999-9999' :
                          tipoChaveValue === 'cpf' ? '000.000.000-00' :
                          '00.000.000/0001-00'
                        }
                        className="pl-10 h-11 rounded-lg border-border hover:border-border/80 focus:border-primary transition-colors"
                        disabled={isLoading || etapaAtual === 'AGUARDANDO_MFA'}
                        onChange={(e) => handleKeyChange(e.target.value)}
                        value={field.value}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-xs" />
                  {chaveValue && validarChaveForTipo(chaveValue, tipoChaveValue) && (
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                        Formato válido
                      </Badge>
                    </div>
                  )}
                </FormItem>
              )}
            />
          )}

          {/* Aviso sobre chave aleatória */}
          {tipoChaveValue === 'aleatoria' && (
            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200/50 dark:border-blue-800/50">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                💡 Uma chave aleatória será gerada automaticamente pelo sistema. 
                É a opção mais segura e prática!
              </p>
            </div>
          )}

          {/* Campo MFA (quando necessário) */}
          {etapaAtual === 'AGUARDANDO_MFA' && (
            <FormField
              control={form.control}
              name="codigoMfa"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">
                    Código de Verificação
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Digite o código recebido"
                      className="h-11 rounded-lg border-border hover:border-border/80 focus:border-primary transition-colors font-mono text-center"
                      disabled={isLoading}
                      maxLength={6}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                  <p className="text-xs text-muted-foreground">
                    Código enviado para seu {tipoChaveValue === 'email' ? 'e-mail' : 'telefone'}
                  </p>
                </FormItem>
              )}
            />
          )}

          {/* Botão de Ação */}
          <div className="flex gap-2">
            <Button 
              type="submit" 
              disabled={isLoading}
              className="flex-1 h-12 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {etapaAtual === 'AGUARDANDO_MFA' ? 'Verificando...' : 'Criando...'}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  {getBotaoTexto()}
                </span>
              )}
            </Button>

            {etapaAtual === 'AGUARDANDO_MFA' && (
              <Button 
                type="button"
                variant="outline"
                onClick={handleNovaChave}
                disabled={isLoading}
                className="h-12 px-4 rounded-lg"
              >
                Cancelar
              </Button>
            )}
          </div>
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
                  {apiResponse.etapa === 'MFA_SOLICITADO' ? 'Verificação Necessária' :
                   apiResponse.etapa === 'CHAVE_CRIADA' ? 'Chave PIX Criada!' :
                   'Erro na Criação'}
                </h4>
                <p className={`text-xs mt-1 ${
                  apiResponse.sucesso 
                    ? 'text-green-700 dark:text-green-300' 
                    : 'text-red-700 dark:text-red-300'
                }`}>
                  {apiResponse.mensagem}
                </p>
                {apiResponse.chave && (
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs font-mono">
                      {apiResponse.chave}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyKey(apiResponse.chave!)}
                      className="h-6 px-2 text-xs"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {etapaAtual === 'CONCLUIDO' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleNovaChave}
                    className="mt-3 h-8 text-xs"
                  >
                    Criar Nova Chave
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 