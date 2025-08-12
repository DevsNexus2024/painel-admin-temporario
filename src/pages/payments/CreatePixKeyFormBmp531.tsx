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
import { validarChavePix, formatarChavePix } from "@/services/pix";
import { Bmp531Service } from "@/services/bmp531"; // ✅ Usar serviço BMP-531 específico

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

export default function CreatePixKeyFormBmp531() {
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

  const watchedTipoChave = form.watch("tipoChave");
  const watchedChave = form.watch("chave");

  // Formatação automática baseada no tipo
  const handleChaveChange = (value: string, tipoChave: string) => {
    const chaveFormatada = formatarChavePix(value, tipoChave);
    form.setValue("chave", chaveFormatada);
  };

  const onSubmit = async (data: CreateKeyFormData) => {
    try {
      setIsLoading(true);
      setApiResponse(null);

      // Determinar o tipo de chave para a API BMP-531
      const tipoChaveAPI = {
        'cpf': 'CPF',
        'cnpj': 'CNPJ', 
        'email': 'EMAIL',
        'telefone': 'PHONE',
        'aleatoria': 'EVP'
      }[data.tipoChave!];

      let requestData: any = {
        tipo: tipoChaveAPI
      };

      // Para chaves não aleatórias, incluir o valor da chave
      if (data.tipoChave !== 'aleatoria') {
        if (!data.chave || data.chave.trim() === '') {
          toast.error("Chave obrigatória", {
            description: "Informe o valor da chave PIX",
            duration: 4000
          });
          return;
        }

        // Validar formato da chave
        if (!validarChavePix(data.chave, data.tipoChave)) {
          toast.error(`Formato de ${data.tipoChave.toUpperCase()} inválido!`, {
            description: "Verifique se a chave está no formato correto",
            duration: 4000
          });
          return;
        }

        requestData.chave = data.chave;
      }

      console.log("🔑 [CreatePixKeyFormBmp531] Criando chave PIX BMP-531:", requestData);

      // ✅ Usar serviço BMP-531 específico com dados bancários corretos
      const result = await Bmp531Service.criarChave(requestData);
      
      setApiResponse(result);

      if (result.sucesso) {
        console.log("✅ [CreatePixKeyFormBmp531] Chave PIX criada com sucesso:", result);
        
        if (result.etapa === 'AGUARDANDO_MFA') {
          setEtapaAtual('AGUARDANDO_MFA');
          setCodigoAutenticacao(result.codigoAutenticacao || null);
          
          toast.info("Código MFA necessário", {
            description: "Verifique seu celular/email para o código de confirmação",
            duration: 6000,
            icon: <AlertCircle className="h-4 w-4" />
          });
        } else if (result.etapa === 'CONCLUIDO') {
          setEtapaAtual('CONCLUIDO');
          
          toast.success("Chave PIX criada com sucesso!", {
            description: `Chave: ${result.chave}`,
            duration: 6000,
            icon: <CheckCircle className="h-4 w-4" />
          });
          
          form.reset();
        }
      } else {
        console.error("❌ [CreatePixKeyFormBmp531] Falha ao criar chave:", result);
        
        toast.error("Falha ao criar chave PIX", {
          description: result.mensagem || "Erro desconhecido",
          duration: 6000,
          icon: <AlertCircle className="h-4 w-4" />
        });
      }
    } catch (error) {
      console.error("❌ [CreatePixKeyFormBmp531] Erro ao criar chave PIX:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      
      toast.error("Erro ao criar chave PIX", {
        description: errorMessage,
        duration: 6000,
        icon: <AlertCircle className="h-4 w-4" />
      });
      
      setApiResponse({
        sucesso: false,
        etapa: 'ERRO',
        mensagem: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  const confirmarComMFA = async () => {
    try {
      setIsLoading(true);

      if (!form.getValues("codigoMfa")) {
        toast.error("Código MFA obrigatório", {
          description: "Informe o código recebido",
          duration: 4000
        });
        return;
      }

      if (!codigoAutenticacao) {
        toast.error("Código de autenticação não encontrado", {
          description: "Tente criar a chave novamente",
          duration: 4000
        });
        return;
      }

      const requestData = {
        codigoAutenticacao,
        codigoMfa: form.getValues("codigoMfa")
      };

      console.log("🔐 [CreatePixKeyFormBmp531] Confirmando MFA:", requestData);

      // ✅ Usar serviço BMP-531 específico (função MFA não implementada ainda)
      // const result = await Bmp531Service.confirmarMfaChavePix(requestData);
      
      // Por enquanto, simular confirmação para teste
      const result = {
        sucesso: false,
        mensagem: "Função de confirmação MFA não implementada ainda no BMP-531"
      };
      
      setApiResponse(result);

      if (result.sucesso) {
        setEtapaAtual('CONCLUIDO');
        
        toast.success("Chave PIX criada com sucesso!", {
          description: `Chave: ${result.chave}`,
          duration: 6000,
          icon: <CheckCircle className="h-4 w-4" />
        });
        
        form.reset();
        setCodigoAutenticacao(null);
      } else {
        toast.error("Falha na confirmação MFA", {
          description: result.mensagem || "Código inválido",
          duration: 6000
        });
      }
    } catch (error) {
      console.error("❌ [CreatePixKeyFormBmp531] Erro ao confirmar MFA:", error);
      
      toast.error("Erro ao confirmar código", {
        description: error instanceof Error ? error.message : "Erro desconhecido",
        duration: 6000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const reiniciarFluxo = () => {
    setEtapaAtual('INICIAL');
    setCodigoAutenticacao(null);
    setApiResponse(null);
    form.reset();
  };

  const handleCopyCode = (codigo: string) => {
    navigator.clipboard.writeText(codigo);
    toast.success("Código copiado!", {
      description: "O código foi copiado para sua área de transferência",
      duration: 2000
    });
  };

  const getPlaceholder = (tipoChave: string | undefined) => {
    switch (tipoChave) {
      case 'cpf':
        return 'XXX.XXX.XXX-XX';
      case 'cnpj':
        return 'XX.XXX.XXX/XXXX-XX';
      case 'email':
        return 'exemplo@email.com';
      case 'telefone':
        return '+55 (XX) XXXXX-XXXX';
      default:
        return 'Selecione o tipo primeiro';
    }
  };

  return (
    <div className="space-y-6">
      {etapaAtual === 'INICIAL' && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="tipoChave"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground font-semibold">Tipo de Chave PIX</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12 rounded-xl border-border hover:border-blue-500 transition-colors bg-input">
                        <SelectValue placeholder="Selecione o tipo de chave" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="telefone">Telefone</SelectItem>
                      <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchedTipoChave && watchedTipoChave !== 'aleatoria' && (
              <FormField
                control={form.control}
                name="chave"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground font-semibold">
                      Valor da Chave
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={getPlaceholder(watchedTipoChave)}
                        onChange={(e) => {
                          field.onChange(e);
                          handleChaveChange(e.target.value, watchedTipoChave);
                        }}
                        className="h-12 rounded-xl border-border hover:border-blue-500 transition-colors bg-input"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {watchedTipoChave === 'aleatoria' && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <Key className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Chave Aleatória</p>
                    <p className="text-xs text-blue-700 mt-1">
                      O sistema gerará uma chave única automaticamente
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading || !watchedTipoChave}
              className="w-full h-12 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {isLoading ? "Criando..." : "Criar Chave PIX"}
            </Button>
          </form>
        </Form>
      )}

      {etapaAtual === 'AGUARDANDO_MFA' && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-amber-900">Confirmação Necessária</h3>
                  <p className="text-sm text-amber-700">Digite o código recebido para confirmar</p>
                </div>
              </div>

              <Form {...form}>
                <FormField
                  control={form.control}
                  name="codigoMfa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-semibold">
                        Código de Confirmação
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Digite o código recebido"
                          className="h-12 rounded-xl border-border hover:border-blue-500 transition-colors bg-input"
                          maxLength={6}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Form>

              <div className="flex gap-3">
                <Button
                  onClick={confirmarComMFA}
                  disabled={isLoading}
                  className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Confirmar
                </Button>
                <Button
                  onClick={reiniciarFluxo}
                  variant="outline"
                  className="h-12 rounded-xl border-border hover:border-blue-500 transition-colors"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resposta da API */}
      {apiResponse && (
        <Card className={`border ${apiResponse.sucesso ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  apiResponse.sucesso ? 'bg-green-500/10' : 'bg-red-500/10'
                }`}>
                  {apiResponse.sucesso ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <div>
                  <h3 className={`font-semibold ${
                    apiResponse.sucesso ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {apiResponse.sucesso ? 'Sucesso' : 'Erro'}
                  </h3>
                  <p className={`text-sm ${
                    apiResponse.sucesso ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {apiResponse.mensagem}
                  </p>
                </div>
              </div>

              {apiResponse.chave && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Chave PIX Criada:
                  </label>
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <code className="flex-1 text-sm font-mono">{apiResponse.chave}</code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => apiResponse.chave && handleCopyCode(apiResponse.chave)}
                      className="rounded-lg"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              {(etapaAtual === 'CONCLUIDO' || !apiResponse.sucesso) && (
                <Button
                  onClick={reiniciarFluxo}
                  variant="outline"
                  className="w-full h-10 rounded-xl border-border hover:border-blue-500 transition-colors"
                >
                  Nova Chave
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Badge indicando BMP 531 */}
      <div className="flex justify-center">
        <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-medium">
          🏦 Usando dados bancários BMP 531 TCR
        </Badge>
      </div>
    </div>
  );
}
