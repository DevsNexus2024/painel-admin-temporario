import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { otcService } from '@/services/otc';
import { OTCClient } from '@/types/otc';

const CLIENT_FETCH_LIMIT = 500;

interface ClientSelectorProps {
  value: number | null;
  onChange: (clientId: number | null, client?: OTCClient) => void;
}

const ClientSelector: React.FC<ClientSelectorProps> = ({ value, onChange }) => {
  const [search, setSearch] = useState('');

  const { data: clientsResponse, isLoading } = useQuery({
    queryKey: ['otc-clients-for-reports'],
    queryFn: async () => {
      const result = await otcService.getClients({ limit: CLIENT_FETCH_LIMIT });
      return {
        clients: result.data?.clientes || [],
        total: result.data?.estatisticas?.total_clientes || 0,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const clients = clientsResponse?.clients || [];
  const totalClients = clientsResponse?.total || 0;
  const isTruncated = totalClients > clients.length;

  const filtered = useMemo(() => {
    if (!search) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      c => c.name.toLowerCase().includes(q) || c.document.includes(q)
    );
  }, [clients, search]);

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
        Cliente OTC
      </label>
      <Select
        value={value ? String(value) : ''}
        onValueChange={val => {
          const id = parseInt(val, 10);
          const client = clients.find(c => c.id === id);
          onChange(id, client);
        }}
      >
        <SelectTrigger className="h-11 bg-white/5 border-white/10 text-white cursor-pointer">
          <SelectValue placeholder={isLoading ? 'Carregando clientes...' : 'Selecione um cliente'} />
        </SelectTrigger>
        <SelectContent className="bg-[#1A1A1A] border-white/10">
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
              <Input
                placeholder="Buscar por nome ou documento..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
                className="h-9 pl-8 text-sm bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
          </div>

          {isTruncated && (
            <div className="mx-2 mb-1 px-2 py-1.5 flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 rounded">
              <AlertTriangle className="h-3 w-3 flex-shrink-0" />
              Mostrando {clients.length} de {totalClients}. Use a busca para filtrar.
            </div>
          )}

          {filtered.length === 0 && (
            <div className="px-2 py-6 text-center text-sm text-gray-500">
              Nenhum cliente encontrado
            </div>
          )}

          {filtered.map(client => (
            <SelectItem key={client.id} value={String(client.id)} className="cursor-pointer">
              <div className="flex items-center gap-2">
                <span className="font-medium">{client.name}</span>
                <span className="text-xs text-gray-500 font-mono">{client.document}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ClientSelector;
