import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileText, SendHorizontal, QrCode, Loader2, Copy, CheckCircle, AlertCircle, User, Building2, Mail, Phone, Hash, Key } from "lucide-react";

// Componentes Bitso
import TopBarBitso from "@/components/TopBarBitso";
import ExtractTabBitso from "@/components/ExtractTabBitso";

// Componentes UI
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

// Serviços do sistema unificado (IGUAL ao BitsoPixActions)
import { 
  sendPix,
  criarQRCodeDinamicoBitso,
  criarQRCodeEstaticoBitso,
  switchAccount,
  getAvailableAccounts
} from "@/services/banking";

export default function BitsoPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [pixResult, setPixResult] = useState<any>(null);
  const [qrResult, setQrResult] = useState<any>(null);
  const [isBitsoActive, setIsBitsoActive] = useState(false);

  // Estados para formulários
  const [pixData, setPixData] = useState({
    keyType: "" as "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP" | "",
    pixKey: "",
    amount: "",
    description: ""
  });

  const [qrDynamicData, setQrDynamicData] = useState({
    keyType: "" as "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP" | "",
    pixKey: "",
    amount: "",
    description: ""
  });

  const [qrStaticData, setQrStaticData] = useState({
    keyType: "" as "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP" | "",
    pixKey: "",
    description: ""
  });

  // Verificar e ativar conta Bitso automaticamente
  useEffect(() => {
    const accounts = getAvailableAccounts();
    const bitsoAccount = accounts.find(acc => acc.provider === 'bitso');
    
    if (bitsoAccount) {
      if (!bitsoAccount.isActive) {
        // Ativar conta Bitso automaticamente
        switchAccount('bitso-crypto');
      }
      setIsBitsoActive(true);
    } else {
      setIsBitsoActive(false);
      toast.error("Conta Bitso não disponível", {
        description: "Configure a conta Bitso no sistema"
      });
    }
  }, []);

  // Verificar se conta Bitso está ativa
  const checkBitsoActive = () => {
    const accounts = getAvailableAccounts();
    const bitsoAccount = accounts.find(acc => acc.provider === 'bitso');
    
    if (!bitsoAccount?.isActive) {
      const success = switchAccount('bitso-crypto');
      if (!success) {
        toast.error("Conta Bitso não disponível", {
          description: "Selecione a conta Bitso no gerenciador de contas"
        });
        return false;
      }
    }
    return true;
  };

  // Enviar PIX
  const handleSendPix = async () => {
    if (!pixData.keyType || !pixData.pixKey || !pixData.amount) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (!checkBitsoActive()) return;

    setIsLoading(true);
    setPixResult(null);

    try {
      const result = await sendPix({
        key: pixData.pixKey,
        amount: parseFloat(pixData.amount),
        description: pixData.description || "PIX via Bitso",
        keyType: pixData.keyType
      });

      setPixResult({
        success: true,
        transaction: result,
        message: "PIX enviado com sucesso!"
      });

      toast.success("PIX enviado!", {
        description: `R$ ${pixData.amount} para ${pixData.pixKey}`,
        duration: 4000,
      });

      // Limpar formulário
      setPixData({
        keyType: "",
        pixKey: "",
        amount: "",
        description: ""
      });

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      
      setPixResult({
        success: false,
        message: errorMessage
      });

      toast.error("Erro ao enviar PIX", {
        description: errorMessage,
        duration: 6000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Gerar QR Code Dinâmico
  const handleGenerateDynamicQR = async () => {
    if (!qrDynamicData.keyType || !qrDynamicData.pixKey || !qrDynamicData.amount) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (!checkBitsoActive()) return;

    setIsLoading(true);
    setQrResult(null);

    try {
      const result = await criarQRCodeDinamicoBitso({
        valor: parseFloat(qrDynamicData.amount),
        chavePix: qrDynamicData.pixKey,
        tipoChave: qrDynamicData.keyType,
        descricao: qrDynamicData.description || "Cobrança PIX via Bitso"
      });

      setQrResult({
        success: true,
        type: 'dynamic',
        qrCode: result.qrCode,
        txId: result.txId,
        amount: qrDynamicData.amount
      });

      toast.success("QR Code dinâmico criado!", {
        description: `Valor: R$ ${qrDynamicData.amount}`,
        duration: 4000,
      });

      // Limpar formulário
      setQrDynamicData({
        keyType: "",
        pixKey: "",
        amount: "",
        description: ""
      });

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      
      setQrResult({
        success: false,
        message: errorMessage
      });

      toast.error("Erro ao criar QR Code", {
        description: errorMessage,
        duration: 6000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Gerar QR Code Estático
  const handleGenerateStaticQR = async () => {
    if (!qrStaticData.keyType || !qrStaticData.pixKey) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (!checkBitsoActive()) return;

    setIsLoading(true);
    setQrResult(null);

    try {
      const result = await criarQRCodeEstaticoBitso({
        chavePix: qrStaticData.pixKey,
        tipoChave: qrStaticData.keyType,
        descricao: qrStaticData.description || "Chave PIX via Bitso"
      });

      setQrResult({
        success: true,
        type: 'static',
        qrCode: result.qrCode,
        txId: result.txId
      });

      toast.success("QR Code estático criado!", {
        description: "QR Code reutilizável gerado",
        duration: 4000,
      });

      // Limpar formulário
      setQrStaticData({
        keyType: "",
        pixKey: "",
        description: ""
      });

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      
      setQrResult({
        success: false,
        message: errorMessage
      });

      toast.error("Erro ao criar QR Code", {
        description: errorMessage,
        duration: 6000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Utilitários
  const handleCopyQR = () => {
    if (qrResult?.qrCode) {
      navigator.clipboard.writeText(qrResult.qrCode);
      toast.success("QR Code copiado!");
    }
  };

  const getKeyTypeIcon = (type: string) => {
    switch (type) {
      case 'CPF': return <User className="h-4 w-4" />;
      case 'CNPJ': return <Building2 className="h-4 w-4" />;
      case 'EMAIL': return <Mail className="h-4 w-4" />;
      case 'PHONE': return <Phone className="h-4 w-4" />;
      case 'EVP': return <Hash className="h-4 w-4" />;
      default: return <Key className="h-4 w-4" />;
    }
  };

  return (
    <div className="w-full min-h-screen bg-background">
      {/* Top Bar com Saldos */}
      <TopBarBitso />

      {/* Alerta se Bitso não estiver ativo */}
      {!isBitsoActive && (
        <div className="container mx-auto px-4 py-4">
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>Conta Bitso não configurada</strong>
              <br />
              Configure a conta Bitso no gerenciador de contas para usar esta funcionalidade.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Conteúdo Principal */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="extract" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="extract" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Extrato
            </TabsTrigger>
            <TabsTrigger value="pix" className="flex items-center gap-2">
              <SendHorizontal className="h-4 w-4" />
              Enviar PIX
            </TabsTrigger>
            <TabsTrigger value="qr-dynamic" className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              QR Dinâmico
            </TabsTrigger>
            <TabsTrigger value="qr-static" className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              QR Estático
            </TabsTrigger>
          </TabsList>

          {/* ABA: Extrato */}
          <TabsContent value="extract">
            <ExtractTabBitso />
          </TabsContent>

          {/* ABA: Enviar PIX */}
          <TabsContent value="pix">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SendHorizontal className="h-5 w-5 text-blue-500" />
                  Enviar PIX via Bitso
                </CardTitle>
                <CardDescription>
                  Transferência imediata usando chave PIX do destinatário
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Tipo de Chave */}
                <div className="space-y-2">
                  <Label>Tipo de Chave PIX</Label>
                  <Select
                    value={pixData.keyType}
                    onValueChange={(value: any) =>
                      setPixData({ ...pixData, keyType: value })
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CPF">CPF</SelectItem>
                      <SelectItem value="CNPJ">CNPJ</SelectItem>
                      <SelectItem value="EMAIL">Email</SelectItem>
                      <SelectItem value="PHONE">Telefone</SelectItem>
                      <SelectItem value="EVP">Chave Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Chave PIX */}
                <div className="space-y-2">
                  <Label>Chave PIX do Destinatário</Label>
                  <div className="relative">
                    {pixData.keyType && (
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                        {getKeyTypeIcon(pixData.keyType)}
                      </div>
                    )}
                    <Input
                      placeholder="Digite a chave PIX"
                      className={pixData.keyType ? "pl-10" : ""}
                      value={pixData.pixKey}
                      onChange={(e) =>
                        setPixData({ ...pixData, pixKey: e.target.value })
                      }
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Valor */}
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={pixData.amount}
                    onChange={(e) =>
                      setPixData({ ...pixData, amount: e.target.value })
                    }
                    disabled={isLoading}
                  />
                </div>

                {/* Descrição */}
                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Input
                    placeholder="Motivo da transferência"
                    value={pixData.description}
                    onChange={(e) =>
                      setPixData({ ...pixData, description: e.target.value })
                    }
                    disabled={isLoading}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleSendPix}
                  disabled={isLoading || !isBitsoActive}
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

                {/* Resultado PIX */}
                {pixResult && (
                  <Card className={`${pixResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
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
                          {pixResult.transaction && (
                            <div className="mt-2 text-sm text-muted-foreground">
                              <p>ID: {pixResult.transaction.id}</p>
                              <p>Status: {pixResult.transaction.status}</p>
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

          {/* ABA: QR Code Dinâmico */}
          <TabsContent value="qr-dynamic">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-purple-500" />
                  QR Code Dinâmico
                </CardTitle>
                <CardDescription>
                  Gerar QR Code com valor fixo para recebimento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Tipo de Chave */}
                <div className="space-y-2">
                  <Label>Tipo da Sua Chave PIX</Label>
                  <Select
                    value={qrDynamicData.keyType}
                    onValueChange={(value: any) =>
                      setQrDynamicData({ ...qrDynamicData, keyType: value })
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CPF">CPF</SelectItem>
                      <SelectItem value="CNPJ">CNPJ</SelectItem>
                      <SelectItem value="EMAIL">Email</SelectItem>
                      <SelectItem value="PHONE">Telefone</SelectItem>
                      <SelectItem value="EVP">Chave Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Chave PIX */}
                <div className="space-y-2">
                  <Label>Sua Chave PIX</Label>
                  <Input
                    placeholder="Digite sua chave PIX"
                    value={qrDynamicData.pixKey}
                    onChange={(e) =>
                      setQrDynamicData({ ...qrDynamicData, pixKey: e.target.value })
                    }
                    disabled={isLoading}
                  />
                </div>

                {/* Valor */}
                <div className="space-y-2">
                  <Label>Valor a Receber (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={qrDynamicData.amount}
                    onChange={(e) =>
                      setQrDynamicData({ ...qrDynamicData, amount: e.target.value })
                    }
                    disabled={isLoading}
                  />
                </div>

                {/* Descrição */}
                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Input
                    placeholder="Motivo da cobrança"
                    value={qrDynamicData.description}
                    onChange={(e) =>
                      setQrDynamicData({ ...qrDynamicData, description: e.target.value })
                    }
                    disabled={isLoading}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleGenerateDynamicQR}
                  disabled={isLoading || !isBitsoActive}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando QR...
                    </>
                  ) : (
                    <>
                      <QrCode className="mr-2 h-4 w-4" />
                      Gerar QR Dinâmico
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA: QR Code Estático */}
          <TabsContent value="qr-static">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-indigo-500" />
                  QR Code Estático
                </CardTitle>
                <CardDescription>
                  Gerar QR Code reutilizável (sem valor fixo)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Tipo de Chave */}
                <div className="space-y-2">
                  <Label>Tipo da Sua Chave PIX</Label>
                  <Select
                    value={qrStaticData.keyType}
                    onValueChange={(value: any) =>
                      setQrStaticData({ ...qrStaticData, keyType: value })
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CPF">CPF</SelectItem>
                      <SelectItem value="CNPJ">CNPJ</SelectItem>
                      <SelectItem value="EMAIL">Email</SelectItem>
                      <SelectItem value="PHONE">Telefone</SelectItem>
                      <SelectItem value="EVP">Chave Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Chave PIX */}
                <div className="space-y-2">
                  <Label>Sua Chave PIX</Label>
                  <Input
                    placeholder="Digite sua chave PIX"
                    value={qrStaticData.pixKey}
                    onChange={(e) =>
                      setQrStaticData({ ...qrStaticData, pixKey: e.target.value })
                    }
                    disabled={isLoading}
                  />
                </div>

                {/* Descrição */}
                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Input
                    placeholder="Identificação da chave"
                    value={qrStaticData.description}
                    onChange={(e) =>
                      setQrStaticData({ ...qrStaticData, description: e.target.value })
                    }
                    disabled={isLoading}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleGenerateStaticQR}
                  disabled={isLoading || !isBitsoActive}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando QR...
                    </>
                  ) : (
                    <>
                      <QrCode className="mr-2 h-4 w-4" />
                      Gerar QR Estático
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Resultado QR Code (compartilhado entre dinâmico e estático) */}
          {qrResult && (
            <Card className={`mt-6 ${qrResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <CardContent className="pt-4">
                {qrResult.success ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">
                        QR Code {qrResult.type === 'dynamic' ? 'Dinâmico' : 'Estático'} Criado!
                      </span>
                    </div>
                    
                    {qrResult.amount && (
                      <Badge variant="secondary">
                        Valor: R$ {qrResult.amount}
                      </Badge>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-green-800">
                        Código QR PIX:
                      </label>
                      <div className="flex gap-2">
                        <code className="flex-1 p-3 bg-white border rounded text-xs font-mono break-all">
                          {qrResult.qrCode}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCopyQR}
                          className="shrink-0"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-xs text-green-700">
                      ID da transação: {qrResult.txId}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">Erro ao gerar QR Code</p>
                      <p className="text-sm text-red-700 mt-1">{qrResult.message}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </Tabs>
      </div>
    </div>
  );
}

