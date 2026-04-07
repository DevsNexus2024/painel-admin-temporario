import React, { useState } from 'react';
import { FileText, Building2, DollarSign } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OtcReportsTab from './components/OtcReportsTab';
import BankingReportsTab from './components/BankingReportsTab';
import TarifasReportsTab from './components/TarifasReportsTab';
import DepositsStatsCard from './components/DepositsStatsCard';

const RelatoriosPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('otc');

  return (
    <div className="p-6 space-y-6">
      {/* Header — mesmo padrão do OTCClients */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground">
          Exporte extratos, transações e tarifas em CSV
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="otc" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            OTC
          </TabsTrigger>
          <TabsTrigger value="bancario" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Bancário
          </TabsTrigger>
          <TabsTrigger value="tarifas" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Tarifas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="otc" className="space-y-4 mt-6">
          <DepositsStatsCard />
          <OtcReportsTab />
        </TabsContent>

        <TabsContent value="bancario" className="space-y-4 mt-6">
          <BankingReportsTab />
        </TabsContent>

        <TabsContent value="tarifas" className="space-y-4 mt-6">
          <TarifasReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RelatoriosPage;
