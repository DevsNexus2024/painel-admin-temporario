import { useState, useEffect } from "react";
import { Shield, RefreshCw, Loader2, AlertCircle, Key, Copy, CheckCircle, User, Building2, Mail, Phone, Hash } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Bmp531Service } from "@/services/bmp531"; // ✅ Usar serviço BMP-531 específico

interface PixKey {
  chave: string;
  tipo: string;
  codigo: number;
  situacao: string;
  dataHoraCriacao: string;
  dataHoraReivindicacao?: string;
}

interface PixKeysResponse {
  sucesso: boolean;
  mensagem: string;
  chaves: PixKey[];
  total: number;
  estatisticas: {
    totalChaves: number;
    ativas: number;
    inativas: number;
  };
}

export default function ListPixKeysFormBmp531() {
  const [responseData, setResponseData] = useState<PixKeysResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pixKeys = responseData?.chaves || [];

  const loadPixKeys = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log("🔑 [ListPixKeysFormBmp531] Carregando chaves PIX BMP-531...");
      
      // ✅ Usar serviço BMP-531 específico com dados bancários corretos
      const result = await Bmp531Service.listarChaves();
      
      console.log("🔍 [ListPixKeysFormBmp531] Resposta da API:", result);
      console.log("🔍 [ListPixKeysFormBmp531] Estrutura estatisticas:", result?.estatisticas);
      
      // ✅ Verificar se a resposta tem a estrutura esperada
      if (result && typeof result === 'object') {
        // Garantir que estatisticas existe
        if (!result.estatisticas) {
          result.estatisticas = {
            totalChaves: result.chaves?.length || 0,
            ativas: result.chaves?.filter((c: any) => c.situacao?.toLowerCase() === 'ativa').length || 0,
            inativas: result.chaves?.filter((c: any) => c.situacao?.toLowerCase() !== 'ativa').length || 0
          };
        }
        
        setResponseData(result);
        
        if (!result.sucesso) {
          setError(result.mensagem || "Erro ao carregar chaves");
        }
      } else {
        setError("Resposta da API em formato inesperado");
      }
    } catch (error) {
      console.error("❌ [ListPixKeysFormBmp531] Erro ao carregar chaves:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      setError(errorMessage);
      
      toast.error("Erro ao carregar chaves PIX", {
        description: errorMessage,
        duration: 6000
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPixKeys();
  }, []);

  const handleCopyKey = (chave: string, tipo: string) => {
    navigator.clipboard.writeText(chave);
    toast.success(`Chave ${tipo} copiada!`, {
      description: "A chave foi copiada para sua área de transferência",
      duration: 3000
    });
  };

  const handleRefresh = () => {
    loadPixKeys();
    toast.info("Atualizando lista de chaves...");
  };

  // Obter ícone do tipo de chave
  const getKeyTypeIcon = (codigo: number) => {
    switch (codigo) {
      case 0: // CPF
        return <User className="h-4 w-4 text-white" />;
      case 1: // CNPJ
        return <Building2 className="h-4 w-4 text-white" />;
      case 2: // Telefone
        return <Phone className="h-4 w-4 text-white" />;
      case 3: // Email
        return <Mail className="h-4 w-4 text-white" />;
      case 4: // Chave Aleatória
        return <Hash className="h-4 w-4 text-white" />;
      default:
        return <Key className="h-4 w-4 text-white" />;
    }
  };

  // Obter cor do tipo de chave
  const getKeyTypeColor = (codigo: number) => {
    switch (codigo) {
      case 0: return 'bg-blue-500'; // CPF
      case 1: return 'bg-green-500'; // CNPJ
      case 2: return 'bg-purple-500'; // Telefone
      case 3: return 'bg-orange-500'; // Email
      case 4: return 'bg-gray-500'; // Chave Aleatória
      default: return 'bg-gray-400';
    }
  };

  // Obter label do tipo de chave
  const getKeyTypeLabel = (codigo: number) => {
    switch (codigo) {
      case 0: return 'CPF';
      case 1: return 'CNPJ';
      case 2: return 'Telefone';
      case 3: return 'E-mail';
      case 4: return 'Aleatória';
      default: return 'Desconhecido';
    }
  };

  // Obter cor do status
  const getStatusColor = (situacao: string) => {
    switch (situacao?.toLowerCase()) {
      case 'ativa':
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'inativa':
      case 'inactive':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pendente':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-900">Erro ao carregar chaves PIX</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            className="mt-4 border-red-200 hover:border-red-300"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com estatísticas */}
      {responseData && (
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">
              Minhas Chaves PIX
            </h3>
            <p className="text-sm text-muted-foreground">
              {responseData.estatisticas.totalChaves} chave(s) cadastrada(s)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-medium">
              🏦 BMP 531 TCR
            </Badge>
            <Button
              onClick={handleRefresh}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="rounded-lg border-border hover:border-blue-500 transition-colors"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Atualizar
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin mr-3" />
              <span className="text-muted-foreground">Carregando chaves PIX...</span>
            </div>
          </CardContent>
        </Card>
      ) : pixKeys.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-6">
            <div className="text-center space-y-3">
              <div className="p-3 rounded-full bg-muted/50 w-12 h-12 mx-auto flex items-center justify-center">
                <Key className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">Nenhuma chave PIX encontrada</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Crie sua primeira chave PIX para começar a receber transferências
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pixKeys.map((key, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Ícone do tipo */}
                    <div className={`p-2 rounded-lg ${getKeyTypeColor(key.codigo)}`}>
                      {getKeyTypeIcon(key.codigo)}
                    </div>
                    
                    {/* Informações da chave */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-foreground">
                          {getKeyTypeLabel(key.codigo)}
                        </span>
                        <Badge className={`text-xs font-medium ${getStatusColor(key.situacao)}`}>
                          {key.situacao}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                            {key.chave}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopyKey(key.chave, key.tipo)}
                            className="h-7 w-7 p-0 rounded-md hover:bg-muted"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <p className="text-xs text-muted-foreground">
                          Criada em: {new Date(key.dataHoraCriacao).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Status visual */}
                  <div className="flex items-center">
                    {key.situacao?.toLowerCase() === 'ativa' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <Shield className="h-5 w-5 text-yellow-500" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Estatísticas detalhadas */}
      {responseData && responseData.estatisticas && (
        <Card className="bg-muted/30">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Estatísticas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">
                  {responseData.estatisticas.totalChaves}
                </p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {responseData.estatisticas.ativas}
                </p>
                <p className="text-sm text-muted-foreground">Ativas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  {responseData.estatisticas.inativas || 0}
                </p>
                <p className="text-sm text-muted-foreground">Inativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
