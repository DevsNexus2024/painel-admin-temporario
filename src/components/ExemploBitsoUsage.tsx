/**
 * 🚀 COMPONENTE DE EXEMPLO - USO DO CLIENTE BITSO
 * 
 * Demonstra como usar o novo cliente Bitso refatorado
 * Conforme guia oficial - com 3 headers obrigatórios
 */

import React, { useState, useEffect } from 'react';
import { bitsoApi } from '@/services/banking';
import type { BitsoBalance, BitsoPixData } from '@/services/banking/BitsoApiClient';
import { logger } from '@/utils/logger';

export const ExemploBitsoUsage: React.FC = () => {
  const [saldos, setSaldos] = useState<BitsoBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    valor: '',
    chaveDestino: '',
    tipoChave: 'EMAIL' as const,
    descricao: ''
  });

  // ===============================
  // CARREGAR SALDOS
  // ===============================
  useEffect(() => {
    carregarSaldos();
  }, []);

  const carregarSaldos = async () => {
    try {
      setLoading(true);
      
      // ✅ Usar novo cliente Bitso
      const resultado = await bitsoApi.consultarSaldosDisponiveis();
      
      if (resultado.sucesso && resultado.data?.balances) {
        setSaldos(resultado.data.balances);
        logger.info('[BITSO] Saldos carregados com sucesso', {
          count: resultado.data.balances.length
        });
      } else {
        console.error('Erro ao carregar saldos:', resultado.mensagem);
      }
    } catch (error) {
      console.error('Erro ao carregar saldos Bitso:', error);
    } finally {
      setLoading(false);
    }
  };

  // ===============================
  // ENVIAR PIX
  // ===============================
  const handleEnviarPix = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.valor || !formData.chaveDestino) {
      alert('Preencha valor e chave PIX');
      return;
    }

    try {
      setLoading(true);

      // ✅ Detectar tipo de chave automaticamente se necessário
      const tipoChaveDetectado = bitsoApi.detectPixKeyType(formData.chaveDestino);
      
      // ✅ Preparar dados conforme guia
      const dadosPix: BitsoPixData = {
        amount: formData.valor,
        pix_key: formData.chaveDestino.trim(),
        pix_key_type: formData.tipoChave || tipoChaveDetectado as any,
        remittanceInformation: formData.descricao || `PIX de R$ ${formData.valor}`
      };

      // ✅ Validar dados antes do envio
      const erros = bitsoApi.validarDadosPix(dadosPix);
      if (erros.length > 0) {
        alert(`Erros de validação:\n${erros.join('\n')}`);
        return;
      }

      // ✅ Enviar PIX usando novo cliente
      const resultado = await bitsoApi.enviarPix(dadosPix);
      
      if (resultado.sucesso) {
        alert(`PIX enviado com sucesso!\nID: ${resultado.data?.wid || 'N/A'}`);
        
        // Limpar formulário
        setFormData({
          valor: '',
          chaveDestino: '',
          tipoChave: 'EMAIL',
          descricao: ''
        });
        
        // Recarregar saldos
        carregarSaldos();
      } else {
        alert(`Erro ao enviar PIX: ${resultado.mensagem || 'Erro desconhecido'}`);
      }
      
    } catch (error: any) {
      console.error('Erro ao enviar PIX:', error);
      alert(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ===============================
  // CONSULTAR EXTRATO
  // ===============================
  const handleConsultarExtrato = async () => {
    try {
      setLoading(true);
      
      // ✅ Consultar extrato dos últimos 30 dias
      const dataInicial = new Date();
      dataInicial.setDate(dataInicial.getDate() - 30);
      
      const resultado = await bitsoApi.consultarExtrato({
        start_date: dataInicial.toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        limit: 50
      });
      
      if (resultado.sucesso) {
        console.log('Extrato Bitso:', resultado.data);
        alert(`Extrato consultado! Verifique o console para detalhes.`);
      } else {
        alert(`Erro ao consultar extrato: ${resultado.mensagem}`);
      }
      
    } catch (error: any) {
      console.error('Erro ao consultar extrato:', error);
      alert(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ===============================
  // RENDER
  // ===============================
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">🚀 Exemplo - Cliente Bitso Refatorado</h2>
      
      {/* Status de Autenticação */}
      <div className="mb-6 p-4 rounded-lg bg-blue-50">
        <p className="text-sm">
          <strong>Status:</strong>{' '}
          {bitsoApi.hasValidToken() ? (
            <span className="text-green-600">✅ Autenticado</span>
          ) : (
            <span className="text-red-600">❌ Não autenticado</span>
          )}
        </p>
      </div>

      {/* Saldos */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">💰 Saldos Disponíveis</h3>
          <button 
            onClick={carregarSaldos}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {saldos.map(saldo => (
            <div key={saldo.currency} className="p-4 border rounded-lg">
              <h4 className="font-semibold">{saldo.currency.toUpperCase()}</h4>
              <p className="text-sm text-gray-600">Disponível: {saldo.available}</p>
              <p className="text-sm text-gray-600">Bloqueado: {saldo.locked}</p>
              <p className="text-sm font-medium">Total: {saldo.total}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Formulário PIX */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">📤 Enviar PIX</h3>
        
        <form onSubmit={handleEnviarPix} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Valor (R$)</label>
              <input 
                type="number" 
                step="0.01"
                placeholder="100.50"
                value={formData.valor}
                onChange={(e) => setFormData({...formData, valor: e.target.value})}
                className="w-full p-2 border rounded"
                required 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Tipo de Chave</label>
              <select 
                value={formData.tipoChave}
                onChange={(e) => setFormData({...formData, tipoChave: e.target.value as any})}
                className="w-full p-2 border rounded"
              >
                <option value="EMAIL">Email</option>
                <option value="CPF">CPF</option>
                <option value="CNPJ">CNPJ</option>
                <option value="PHONE">Telefone</option>
                <option value="EVP">Chave Aleatória</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Chave PIX</label>
            <input 
              type="text"
              placeholder="user@email.com, 12345678901, etc."
              value={formData.chaveDestino}
              onChange={(e) => setFormData({...formData, chaveDestino: e.target.value})}
              className="w-full p-2 border rounded"
              required 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Descrição (opcional)</label>
            <input 
              type="text"
              placeholder="Pagamento de produto #123"
              value={formData.descricao}
              onChange={(e) => setFormData({...formData, descricao: e.target.value})}
              className="w-full p-2 border rounded"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Enviar PIX'}
          </button>
        </form>
      </div>

      {/* Ações do Extrato */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">📊 Extrato</h3>
        <button 
          onClick={handleConsultarExtrato}
          disabled={loading}
          className="px-6 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          {loading ? 'Consultando...' : 'Consultar Extrato (30 dias)'}
        </button>
      </div>

      {/* Info Técnica */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <h4 className="font-semibold mb-2">ℹ️ Informações Técnicas</h4>
        <ul className="text-sm space-y-1">
          <li>✅ Headers obrigatórios: X-API-Key, X-API-Secret, Authorization</li>
          <li>✅ Endpoints atualizados conforme guia oficial</li>
          <li>✅ Validação automática de chaves PIX</li>
          <li>✅ Tratamento de erros robusto</li>
          <li>✅ Rate limiting e timeouts configurados</li>
        </ul>
      </div>
    </div>
  );
};

export default ExemploBitsoUsage;
