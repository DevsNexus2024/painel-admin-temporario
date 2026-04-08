import { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, FileText, AlertTriangle, GitCompare } from 'lucide-react';
import SyncOverview from './SyncOverview';
import SyncLogsTab from './SyncLogsTab';
import SyncAlertsTab from './SyncAlertsTab';
import ReconciliationTab from './ReconciliationTab';

export default function SyncDashboardTab() {
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const [logsInitialFilters, setLogsInitialFilters] = useState<{ provider?: string }>({});

  const handleNavigate = useCallback((subtab: string, filters?: Record<string, string>) => {
    if (subtab === 'logs' && filters?.provider) {
      setLogsInitialFilters({ provider: filters.provider });
    }
    setActiveSubTab(subtab);
  }, []);

  return (
    <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
      <TabsList className="grid w-full max-w-lg grid-cols-4">
        <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs">
          <BarChart3 className="w-3.5 h-3.5" />
          Visao Geral
        </TabsTrigger>
        <TabsTrigger value="logs" className="flex items-center gap-1.5 text-xs">
          <FileText className="w-3.5 h-3.5" />
          Sync Logs
        </TabsTrigger>
        <TabsTrigger value="alerts" className="flex items-center gap-1.5 text-xs">
          <AlertTriangle className="w-3.5 h-3.5" />
          Alertas
        </TabsTrigger>
        <TabsTrigger value="reconciliation" className="flex items-center gap-1.5 text-xs">
          <GitCompare className="w-3.5 h-3.5" />
          Reconciliacao
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-4">
        <SyncOverview onNavigate={handleNavigate} />
      </TabsContent>
      <TabsContent value="logs" className="mt-4">
        <SyncLogsTab key={logsInitialFilters.provider ?? ''} initialFilters={logsInitialFilters} />
      </TabsContent>
      <TabsContent value="alerts" className="mt-4">
        <SyncAlertsTab />
      </TabsContent>
      <TabsContent value="reconciliation" className="mt-4">
        <ReconciliationTab />
      </TabsContent>
    </Tabs>
  );
}
