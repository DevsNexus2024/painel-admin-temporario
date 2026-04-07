import { useState, Fragment } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronRight } from 'lucide-react';
import type { LogEntry } from '@/types/system';

interface LogsTableProps {
  logs: LogEntry[];
  isLoading?: boolean;
}

const LEVEL_BADGE: Record<string, { label: string; className: string }> = {
  ERROR: { label: 'Error', className: 'bg-red-500/15 text-red-600 border-red-500/30' },
  FATAL: { label: 'Fatal', className: 'bg-red-700/15 text-red-800 border-red-700/30' },
  WARN: { label: 'Warn', className: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30' },
  LOG: { label: 'Info', className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  DEBUG: { label: 'Debug', className: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
  TRACE: { label: 'Trace', className: 'bg-zinc-500/15 text-zinc-500 border-zinc-500/30' },
};

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return ts;
  }
}

export default function LogsTable({ logs, isLoading }: LogsTableProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground text-center py-8">Carregando logs...</p>;
  }

  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhum log encontrado</p>;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead className="w-[140px]">Timestamp</TableHead>
            <TableHead className="w-[80px]">Level</TableHead>
            <TableHead className="w-[140px]">Context</TableHead>
            <TableHead>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log, i) => {
            const rowKey = `${log.timestamp}-${i}`;
            const isExpanded = expandedKey === rowKey;
            const badge = LEVEL_BADGE[log.level] || LEVEL_BADGE.LOG;
            return (
              <Fragment key={rowKey}>
                <TableRow
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setExpandedKey(isExpanded ? null : rowKey)}
                >
                  <TableCell className="p-2">
                    <ChevronRight
                      className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{formatTimestamp(log.timestamp)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={badge.className}>
                      {badge.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.context || '—'}</TableCell>
                  <TableCell className="text-sm truncate max-w-[400px]" title={log.message}>
                    {log.message.split('\n')[0]}
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={5} className="p-0">
                      <pre className="bg-zinc-950 text-zinc-300 text-xs font-mono p-4 overflow-x-auto max-h-64 whitespace-pre-wrap">
                        {log.raw}
                      </pre>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
