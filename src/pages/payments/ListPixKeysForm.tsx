import { useState } from "react";
import { Shield, RefreshCw, Loader2, AlertCircle, Key, Copy, CheckCircle, User, Building2, Mail, Phone, Hash } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { usePixKeys, useRefreshPixKeys } from "@/hooks/usePixKeys";

export default function ListPixKeysForm() {
  // Usar hook de cache para chaves PIX
  const { 
    data: responseData, 
    isLoading, 
    error,
  } = usePixKeys({
    staleTime: 10 * 60 * 1000 // 10 minutos
  });

  const refreshPixKeys = useRefreshPixKeys();

  const pixKeys = responseData?.chaves || [];

  const handleCopyKey = (chave: string, tipo: string) => {
    navigator.clipboard.writeText(chave);
    toast.success(`Chave ${tipo} copiada!`, {
      description: "A chave foi copiada para sua área de transferência",
      duration: 3000
    });
  };

  const handleRefresh = () => {
    refreshPixKeys();
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
      case 0: // CPF
        return "bg-blue-500";
      case 1: // CNPJ
        return "bg-tcr-green";
      case 2: // Telefone
        return "bg-emerald-500";
      case 3: // Email
        return "bg-purple-500";
      case 4: // Chave Aleatória
        return "bg-amber-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com estatísticas e botão de atualizar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-card-foreground">Suas Chaves PIX</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie suas chaves PIX cadastradas e utilize-as para receber transferências
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isLoading}
          className="rounded-xl"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Estatísticas */}
      {responseData && responseData.sucesso && (
        <div className="flex gap-2 flex-wrap">
          <Badge variant="default" className="text-sm">
            {responseData.total} chave(s) total
          </Badge>
          {responseData.estatisticas && Object.entries(responseData.estatisticas.porTipo).map(([tipo, count]) => (
            <Badge key={tipo} variant="outline" className="text-sm">
              {tipo}: {count}
            </Badge>
          ))}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
            <span className="text-muted-foreground">Carregando suas chaves PIX...</span>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Card className="border-2 border-destructive bg-destructive/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-destructive/20">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-destructive">
                  Erro ao Carregar Chaves
                </h3>
                <p className="mt-2 text-sm text-destructive/80">
                  {error}
                </p>
                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  className="mt-4 text-destructive border-destructive hover:bg-destructive/10"
                >
                  Tentar Novamente
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && pixKeys.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <div className="p-4 rounded-2xl bg-muted/20 w-fit mx-auto mb-4">
              <Key className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-xl text-card-foreground mb-2">
              Nenhuma chave PIX encontrada
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Você ainda não possui chaves PIX cadastradas. Use o formulário "Criar Chave PIX" para cadastrar sua primeira chave e começar a receber transferências.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Lista de Chaves PIX */}
      {!isLoading && !error && pixKeys.length > 0 && (
        <div className="grid gap-4">
          {pixKeys.map((pixKey, index) => (
            <Card key={`${pixKey.chave}-${index}`} className="border border-border hover:shadow-lg transition-all duration-200 hover:border-primary/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {/* Ícone do tipo de chave */}
                  <div className={`p-4 rounded-2xl ${getKeyTypeColor(pixKey.tipoChave.codigo)} shadow-lg`}>
                    {getKeyTypeIcon(pixKey.tipoChave.codigo)}
                  </div>

                  {/* Informações da chave */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="font-bold text-lg text-card-foreground">
                        {pixKey.tipoChave.nome}
                      </h3>
                      <Badge
                        variant={pixKey.configurada ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {pixKey.configurada ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>

                    {/* Valor da chave */}
                    <div className="mb-4">
                      <p className="font-mono text-lg text-card-foreground break-all">
                        {pixKey.formatacao || pixKey.chave}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {pixKey.tipoChave.descricao}
                      </p>
                    </div>

                    {/* Informações do titular */}
                    <div className="text-sm text-muted-foreground">
                      <p className="font-semibold text-card-foreground">{pixKey.titular.nome}</p>
                      <p className="mt-1">{pixKey.titular.documento} • {pixKey.titular.tipoPessoa.nome}</p>
                    </div>
                  </div>

                  {/* Botão de copiar */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyKey(pixKey.chave, pixKey.tipoChave.nome)}
                    className="shrink-0 hover:bg-primary hover:text-primary-foreground transition-colors duration-200"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Informações da conta */}
      {responseData && responseData.sucesso && responseData.contaConsultada && (
        <Card className="bg-muted/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">
              <Shield className="h-3 w-3 inline mr-1" />
              Conta consultada: {responseData.contaConsultada.agencia} / {responseData.contaConsultada.conta}-{responseData.contaConsultada.contaDigito}
              <span className="ml-3">
                <Key className="h-3 w-3 inline mr-1" />
                Chaves protegidas por criptografia de ponta a ponta
              </span>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 