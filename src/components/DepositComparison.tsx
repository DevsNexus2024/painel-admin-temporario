
import React, { useState } from 'react';
import { ArrowDownToLine, Check, AlertTriangle } from 'lucide-react';
import { ComparisonResult } from '../types/deposit';
import { formatCurrency } from '../utils/format';
import { processManualDeposit } from '../services/api';
import { toast } from 'sonner';
import { Button } from './ui/button';

interface DepositComparisonProps {
  results: ComparisonResult[];
  userEmail: string;
  userId: number; // Added userId parameter
  onDepositRegistered?: () => void;
}

const DepositComparison: React.FC<DepositComparisonProps> = ({ 
  results, 
  userEmail,
  userId, // Use userId from props
  onDepositRegistered 
}) => {
  const [processingDeposits, setProcessingDeposits] = useState<number[]>([]);

  if (!results.length) {
    return null;
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'matched':
        return <Check className="text-tcr-green h-5 w-5" />;
      case 'not_found':
        return <AlertTriangle className="text-tcr-orange h-5 w-5" />;
      case 'mismatch':
        return <AlertTriangle className="text-tcr-red h-5 w-5" />;
      default:
        return null;
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleRegisterDeposit = async (deposit: ComparisonResult) => {
    try {
      setProcessingDeposits(prev => [...prev, deposit.externalDeposit.id]);
      
      // Use the correct userId from the API response
      const customId = `U${userId}`;
      
      await processManualDeposit(deposit.externalDeposit, customId);
      
      toast.success('Depósito registrado com sucesso!');
      
      if (onDepositRegistered) {
        onDepositRegistered();
      }
    } catch (error) {
      console.error('Error registering deposit:', error);
      toast.error('Erro ao registrar o depósito. Tente novamente.');
    } finally {
      setProcessingDeposits(prev => prev.filter(id => id !== deposit.externalDeposit.id));
    }
  };

  return (
    <div className="bg-tcr-darkgray rounded-lg p-4">
      <div className="flex items-center mb-4 text-white">
        <ArrowDownToLine className="text-tcr-orange mr-2" size={20} />
        <h2 className="text-lg font-semibold">Comparação de Depósitos</h2>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-white">
          <thead className="text-xs uppercase bg-tcr-gray">
            <tr>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">ID Externo</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Moeda</th>
              <th className="px-4 py-3">Remetente</th>
              <th className="px-4 py-3">Ação</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, index) => (
              <tr key={index} className={`border-t border-tcr-gray ${result.status === 'not_found' ? 'bg-opacity-20 bg-orange-900' : ''}`}>
                <td className="px-4 py-3 flex items-center">
                  {statusIcon(result.status)}
                  <span className="ml-2">
                    {result.status === 'matched' ? 'Sincronizado' : 
                     result.status === 'not_found' ? 'Não encontrado' : 'Incompatível'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {formatDate(result.externalDeposit.timestamp)}
                </td>
                <td className="px-4 py-3">
                  {result.externalDeposit.id}
                </td>
                <td className="px-4 py-3 font-medium">
                  {formatCurrency(parseFloat(result.externalDeposit.value), result.externalDeposit.coin)}
                </td>
                <td className="px-4 py-3">
                  {result.externalDeposit.coin}
                </td>
                <td className="px-4 py-3 truncate max-w-xs">
                  {result.externalDeposit.fromName}
                </td>
                <td className="px-4 py-3">
                  {result.status === 'not_found' ? (
                    <Button
                      className="bg-tcr-orange hover:bg-orange-600 text-white rounded-md px-3 py-1 text-sm"
                      onClick={() => handleRegisterDeposit(result)}
                      disabled={processingDeposits.includes(result.externalDeposit.id)}
                    >
                      {processingDeposits.includes(result.externalDeposit.id) ? 'Processando...' : 'Registrar'}
                    </Button>
                  ) : (
                    <span className="text-gray-500 text-sm">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DepositComparison;
