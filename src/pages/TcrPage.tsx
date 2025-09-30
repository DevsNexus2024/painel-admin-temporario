import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileText, SendHorizontal, Key, QrCode, Plus, Search, RefreshCw, Copy, Trash2 } from "lucide-react";

// Componentes
import TopBarTCR from "@/components/TopBarTCR";
import ExtractTabTCR from "@/components/ExtractTabTCR";

// Componentes UI
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";


// Componente temporário para Ações PIX (replicando layout BMP 531)
function PixActionsTabTCR() {
  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Enviar por Chave */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-blue-600/5"></div>
          <CardHeader className="relative pb-4">
            <CardTitle className="text-lg flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <SendHorizontal className="h-5 w-5 text-blue-600" />
              </div>
              Enviar PIX
              <Badge className="bg-green-100 text-green-800 border-green-200 text-xs font-medium">
                TCR
              </Badge>
            </CardTitle>
            <CardDescription>
              Transferência por chave PIX
            </CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <div className="space-y-4">
              <div className="p-4 border rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  Funcionalidade em desenvolvimento
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Aguardando integração com API TCR
                </p>
              </div>
              <Button className="w-full" disabled>
                Configurar PIX
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pagar QR Code */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-green-600/5"></div>
          <CardHeader className="relative pb-4">
            <CardTitle className="text-lg flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <QrCode className="h-5 w-5 text-green-600" />
              </div>
              Pagar QR Code
              <Badge className="bg-green-100 text-green-800 border-green-200 text-xs font-medium">
                TCR
              </Badge>
            </CardTitle>
            <CardDescription>
              Pagamento via código QR
            </CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <div className="space-y-4">
              <div className="p-4 border rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  Funcionalidade em desenvolvimento
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Aguardando integração com API TCR
                </p>
              </div>
              <Button className="w-full" disabled>
                Escanear QR Code
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Componente para criar chaves PIX
function CriarChavePixTCR({ onChaveCriada }: { onChaveCriada: () => void }) {
  const [tipoChave, setTipoChave] = React.useState<string>("");
  const [valorChave, setValorChave] = React.useState<string>("");
  const [isCreating, setIsCreating] = React.useState(false);

  // ✅ Resetar formulário
  const resetarFormulario = () => {
    setTipoChave("");
    setValorChave("");
  };

  // ✅ Validar entrada baseada no tipo
  const validarChave = (tipo: string, valor: string): string | null => {
    if (tipo === "5") return null; // Chave aleatória não precisa validação

    if (!valor.trim()) {
      return "Valor da chave é obrigatório";
    }

    switch (tipo) {
      case "1": // CPF
        if (!/^\d{11}$/.test(valor.replace(/\D/g, ''))) {
          return "CPF deve ter 11 dígitos";
        }
        break;
      case "2": // CNPJ
        if (!/^\d{14}$/.test(valor.replace(/\D/g, ''))) {
          return "CNPJ deve ter 14 dígitos";
        }
        break;
      case "3": // Celular
        // ✅ REMOVIDO: Validação restritiva de formato
        // Aceita qualquer formato de celular
        break;
      case "4": // Email
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
          return "Email inválido";
        }
        break;
    }
    return null;
  };

  // ✅ Criar chave PIX
  const criarChave = async () => {
    try {
      if (!tipoChave) {
        toast.error("Selecione o tipo da chave PIX");
        return;
      }

      // Validar entrada
      const erroValidacao = validarChave(tipoChave, valorChave);
      if (erroValidacao) {
        toast.error(erroValidacao);
        return;
      }

      setIsCreating(true);

      const cnpj = "53781325000115"; // CNPJ da TCR
      
      //console.log('[TCR-PIX-CREATE-UI] Criando chave:', { tipo: tipoChave, valor: valorChave });

      const { criarChavePixTCR } = await import('@/services/tcr');
      
      // ✅ Montar dados da requisição
      const dadosRequisicao: any = {
        tax_document: cnpj,
        tipo: parseInt(tipoChave)
      };

      // Adicionar key apenas se necessário
      if (tipoChave !== "5" && valorChave.trim()) {
        dadosRequisicao.key = valorChave.trim();
      }

      //console.log('[TCR-PIX-CREATE-UI] Dados da requisição:', dadosRequisicao);

      const resultado = await criarChavePixTCR(dadosRequisicao);

      //console.log('[TCR-PIX-CREATE-UI] Resultado:', resultado);

      if (resultado && !resultado.erro) {
        toast.success("Chave PIX criada com sucesso!", {
          description: resultado.message || "Nova chave registrada na conta",
          duration: 3000
        });
        
        resetarFormulario();
        onChaveCriada(); // Recarregar lista de chaves
      } else {
        toast.error("Erro ao criar chave PIX", {
          description: resultado?.message || "Tente novamente",
          duration: 4000
        });
      }

    } catch (err: any) {
      console.error('[TCR-PIX-CREATE-UI] ❌ Erro:', err);
      toast.error("Erro ao criar chave PIX", {
        description: err.message || "Verifique os dados e tente novamente",
        duration: 4000
      });
    } finally {
      setIsCreating(false);
    }
  };

  // ✅ Obter label do tipo de chave
  const getLabelTipoChave = (tipo: string) => {
    const tipos = {
      "1": "CPF",
      "2": "CNPJ", 
      "3": "Celular",
      "4": "E-mail",
      "5": "Aleatória"
    };
    return tipos[tipo as keyof typeof tipos];
  };

  // ✅ Obter placeholder baseado no tipo
  const getPlaceholder = (tipo: string) => {
    const placeholders = {
      "1": "000.000.000-00",
      "2": "00.000.000/0000-00",
      "3": "+554399991234",
      "4": "seuemail@exemplo.com",
      "5": "Será gerada automaticamente"
    };
    return placeholders[tipo as keyof typeof placeholders];
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-green-600/5"></div>
      <CardHeader className="relative pb-4">
        <CardTitle className="text-lg flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <Plus className="h-5 w-5 text-green-600" />
          </div>
          Criar Chave PIX
          <Badge className="bg-green-100 text-green-800 border-green-200 text-xs font-medium">
            TCR
          </Badge>
        </CardTitle>
        <CardDescription>
          Registrar nova chave PIX na conta
        </CardDescription>
      </CardHeader>
      <CardContent className="relative space-y-4">
        {/* Seletor de tipo */}
        <div className="space-y-2">
          <Label htmlFor="tipo-chave">Tipo da Chave PIX</Label>
          <Select value={tipoChave} onValueChange={setTipoChave}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">
                <div className="flex items-center gap-2">
                  <span>🆔</span>
                  <span>CPF</span>
                </div>
              </SelectItem>
              <SelectItem value="2">
                <div className="flex items-center gap-2">
                  <span>🏢</span>
                  <span>CNPJ</span>
                </div>
              </SelectItem>
              <SelectItem value="3">
                <div className="flex items-center gap-2">
                  <span>📱</span>
                  <span>Celular</span>
                </div>
              </SelectItem>
              <SelectItem value="4">
                <div className="flex items-center gap-2">
                  <span>📧</span>
                  <span>E-mail</span>
                </div>
              </SelectItem>
              <SelectItem value="5">
                <div className="flex items-center gap-2">
                  <span>🎲</span>
                  <span>Aleatória</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Campo de valor (se necessário) */}
        {tipoChave && tipoChave !== "5" && (
          <div className="space-y-2">
            <Label htmlFor="valor-chave">
              Valor da Chave {getLabelTipoChave(tipoChave)}
            </Label>
            <Input
              id="valor-chave"
              type="text"
              value={valorChave}
              onChange={(e) => setValorChave(e.target.value)}
              placeholder={getPlaceholder(tipoChave)}
              disabled={isCreating}
            />
          </div>
        )}

        {/* Informações */}
        {tipoChave === "5" && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              <span className="font-medium">Chave Aleatória:</span> Será gerada automaticamente uma chave única (UUID) para sua conta.
            </p>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-2 pt-2">
          <Button 
            onClick={criarChave}
            disabled={!tipoChave || isCreating}
            className="flex-1"
          >
            {isCreating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Criando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Criar Chave
              </>
            )}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={resetarFormulario}
            disabled={isCreating}
          >
            Limpar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Componente funcional para Chaves PIX TCR
function PixKeysTabTCR() {
  const [chaves, setChaves] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");

  // ✅ Mapear tipo numérico da API para tipo string da interface
  const mapearTipoChave = (tipoNumerico: string | number) => {
    const tipoStr = String(tipoNumerico);
    const tipos: { [key: string]: string } = {
      '1': 'CNPJ',
      '2': 'PHONE', 
      '3': 'EMAIL',
      '4': 'RANDOM',
      '5': 'RANDOM' // Tipo 5 também parece ser aleatória
    };
    return tipos[tipoStr] || 'RANDOM';
  };

  // ✅ Carregar chaves PIX ao montar o componente
  const carregarChaves = async () => {
    try {
      setIsLoading(true);
      setError("");
      
      const cnpj = "53781325000115"; // CNPJ da TCR
      
      //console.log('[TCR-PIX-CHAVES-UI] Carregando chaves PIX para CNPJ:', cnpj);
      
      const { listarChavesPixTCR } = await import('@/services/tcr');
      const resultado = await listarChavesPixTCR(cnpj);
      
      //console.log('[TCR-PIX-CHAVES-UI] Resultado:', resultado);
      
      // ✅ CORREÇÃO: Agora o serviço retorna dados processados corretamente
      if (resultado && !resultado.erro && resultado.chaves) {
        //console.log('[TCR-PIX-CHAVES-UI] 📊 Chaves recebidas do serviço:', resultado.chaves);
        
        // ✅ Aplicar mapeamento final para a interface (tipo string)
        const chavesMapeadas = resultado.chaves.map((chave: any, index: number) => {
          console.log(`[TCR-PIX-CHAVES-UI] 🔄 Processando chave ${index}:`, chave);
          
          return {
            ...chave,
            type: mapearTipoChave(chave.type), // Converter número para string
            _original: chave
          };
        });
        
        setChaves(chavesMapeadas);
        console.log(`[TCR-PIX-CHAVES-UI] ✅ ${chavesMapeadas.length} chaves processadas:`, chavesMapeadas);
      } else {
        setChaves([]);
        //console.log('[TCR-PIX-CHAVES-UI] ⚠️ Nenhuma chave encontrada');
        //console.log('[TCR-PIX-CHAVES-UI] 📋 Estrutura recebida:', resultado);
      }
      
    } catch (err: any) {
      console.error('[TCR-PIX-CHAVES-UI] ❌ Erro:', err);
      setError(err.message || 'Erro ao carregar chaves PIX');
      setChaves([]);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Carregar ao montar o componente
  React.useEffect(() => {
    carregarChaves();
  }, []);

  // ✅ Formatar tipo de chave para exibição
  const formatarTipoChave = (type: string) => {
    const tipos = {
      'CNPJ': 'CNPJ',
      'PHONE': 'Celular',
      'EMAIL': 'E-mail',
      'RANDOM': 'Aleatória'
    };
    return tipos[type as keyof typeof tipos] || type;
  };

  // ✅ Formatar chave para exibição (mascarar dados sensíveis)
  const formatarChave = (key: string, type: string) => {
    //console.log('[TCR-PIX-FORMAT] 🔍 Formatando chave:', { key, type, keyType: typeof key });
    
    if (!key || key === undefined || key === null || key === '') {
      //console.log('[TCR-PIX-FORMAT] ❌ Chave inválida detectada:', key);
      return "Chave inválida";
    }
    
    const keyStr = String(key); // Garantir que é string
    
    if (type === 'PHONE') {
      // Exemplo: +5511999999999 -> +55 (11) 99999-****
      return keyStr.replace(/(\+55)(\d{2})(\d{4,5})(\d{4})/, '$1 ($2) $3-****');
    } else if (type === 'EMAIL') {
      // Exemplo: user@domain.com -> u***@domain.com
      const [local, domain] = keyStr.split('@');
      return `${local[0]}***@${domain}`;
    } else if (type === 'CNPJ') {
      // Exemplo: 12345678000195 -> 12.345.678/0001-**
      return keyStr.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-**');
    } else if (type === 'RANDOM') {
      // Chave aleatória (UUID): mostrar formatada
      if (keyStr.length === 36 && keyStr.includes('-')) {
        // UUID format: 36df47d2-cbbf-42cd-a6ef-a2c09eb0cea4
        //console.log('[TCR-PIX-FORMAT] ✅ UUID detectado:', keyStr);
        return keyStr;
      }
      //console.log('[TCR-PIX-FORMAT] ✅ Chave aleatória:', keyStr);
      return keyStr;
    }
    //console.log('[TCR-PIX-FORMAT] ✅ Chave padrão:', keyStr);
    return keyStr; // Fallback: mostrar completa
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Criar Chave */}
        <CriarChavePixTCR onChaveCriada={carregarChaves} />

        {/* Listar Chaves */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-green-600/5"></div>
          <CardHeader className="relative pb-4">
            <CardTitle className="text-lg flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Key className="h-5 w-5 text-green-600" />
              </div>
              Minhas Chaves PIX
              <Badge className="bg-green-100 text-green-800 border-green-200 text-xs font-medium">
                TCR
              </Badge>
            </CardTitle>
            <CardDescription>
              Chaves registradas na conta
            </CardDescription>
          </CardHeader>
          <CardContent className="relative">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
                <span className="ml-3 text-sm text-muted-foreground">Carregando chaves...</span>
              </div>
            ) : error ? (
              <div className="p-4 border border-red-200 bg-red-50 rounded-lg text-center">
                <p className="text-sm text-red-600">❌ {error}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={carregarChaves}
                  className="mt-3"
                >
                  Tentar novamente
                </Button>
              </div>
            ) : chaves.length === 0 ? (
              <div className="space-y-4">
                <div className="p-4 border rounded-lg text-center">
                  <Key className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma chave PIX registrada
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Crie sua primeira chave PIX usando o painel ao lado
                  </p>
                </div>
                <Badge variant="secondary" className="w-full justify-center">
                  0 chaves registradas
                </Badge>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    {chaves.length} chave{chaves.length !== 1 ? 's' : ''} registrada{chaves.length !== 1 ? 's' : ''}
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={carregarChaves}
                    disabled={isLoading}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Atualizar
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {chaves.map((chave) => (
                    <div 
                      key={chave.id} 
                      className="p-4 border rounded-lg hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge 
                              variant="outline"
                              className="text-xs"
                            >
                              {formatarTipoChave(chave.type)}
                            </Badge>
                            <Badge 
                              variant={chave.status === 'ACTIVE' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {chave.status === 'ACTIVE' ? 'Ativa' : 'Inativa'}
                            </Badge>
                          </div>
                          <p className="font-mono text-sm font-medium">
                            {formatarChave(chave.key, chave.type)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Criada em: {new Date(chave.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const chaveParaCopiar = chave.key || chave.keypix || '';
                              
                              if (chaveParaCopiar) {
                                navigator.clipboard.writeText(chaveParaCopiar);
                                toast.success("Chave PIX copiada!", {
                                  description: `Chave: ${chaveParaCopiar.substring(0, 20)}...`,
                                  duration: 3000
                                });
                              } else {
                                toast.error("Erro ao copiar chave!", {
                                  description: "Chave não encontrada ou inválida",
                                  duration: 3000
                                });
                              }
                            }}
                            className="h-8 w-8 p-0"
                            title="Copiar chave PIX"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            disabled
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function TcrPage() {
  // TCR sempre tem suporte completo a PIX
  const bankFeatures = {
    provider: 'tcr',
    displayName: 'TCR',
    hasPixKeys: true,
    hasQrCodePayment: true,
    hasExtract: true
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBarTCR />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Layout Principal - Tabs no Topo */}
        <Tabs defaultValue="extract" className="w-full">
          <div className="flex items-center justify-between mb-6">
            <TabsList className="grid grid-cols-3 w-fit bg-muted/30 p-1 h-auto">
              <TabsTrigger 
                value="extract" 
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg py-3 px-6 font-medium transition-all duration-200 flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                <span className="text-sm">Extrato</span>
              </TabsTrigger>
              <TabsTrigger 
                value="actions" 
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg py-3 px-6 font-medium transition-all duration-200 flex items-center gap-2"
              >
                <SendHorizontal className="h-4 w-4" />
                <span className="text-sm">Ações PIX</span>
              </TabsTrigger>
              <TabsTrigger 
                value="keys" 
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg py-3 px-6 font-medium transition-all duration-200 flex items-center gap-2"
              >
                <Key className="h-4 w-4" />
                <span className="text-sm">Chaves PIX</span>
                <Badge variant="secondary" className="ml-2 text-xs px-2 py-0">0</Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Extrato - Largura Total */}
          <TabsContent value="extract" className="mt-0">
            <ExtractTabTCR />
          </TabsContent>

          {/* Ações PIX - Layout Mais Largo */}
          <TabsContent value="actions" className="mt-0">
            <PixActionsTabTCR />
          </TabsContent>

          {/* Chaves PIX - Layout Vertical */}
          <TabsContent value="keys" className="mt-0">
            <PixKeysTabTCR />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
