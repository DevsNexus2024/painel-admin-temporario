import { useState, useRef, useCallback } from 'react';
import { ReportProgress } from '@/types/reports';

interface FetchPageResult<T> {
  data: T[];
  total: number;
}

interface UseReportGeneratorOptions<T> {
  fetchPage: (page: number, signal: AbortSignal) => Promise<FetchPageResult<T>>;
  pageSize: number;
  maxWarning?: number; // mostra warning acima disso (default 10000)
}

interface UseReportGeneratorReturn<T> {
  generate: () => Promise<T[] | null>;
  cancel: () => void;
  progress: ReportProgress;
  isGenerating: boolean;
  needsConfirmation: boolean;
  confirmAndGenerate: () => Promise<T[] | null>;
  dismissWarning: () => void;
  error: Error | null;
}

export function useReportGenerator<T = any>(
  options: UseReportGeneratorOptions<T>
): UseReportGeneratorReturn<T> {
  const { fetchPage, pageSize, maxWarning = 10000 } = options;

  const [isGenerating, setIsGenerating] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<ReportProgress>({
    current: 0,
    total: 0,
    percentage: 0,
    page: 0,
    totalPages: 0,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  // Guarda o resultado do probe da primeira página para evitar re-fetch
  const probeResultRef = useRef<FetchPageResult<T> | null>(null);

  const resetProgress = useCallback(() => {
    setProgress({ current: 0, total: 0, percentage: 0, page: 0, totalPages: 0 });
    setError(null);
    probeResultRef.current = null;
  }, []);

  const doGenerate = useCallback(async (): Promise<T[] | null> => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsGenerating(true);
    setError(null);

    const allData: T[] = [];
    const startTime = Date.now();

    try {
      // Usa probe se disponível, senão busca página 1
      const firstResult = probeResultRef.current ?? await fetchPage(1, controller.signal);
      probeResultRef.current = null; // Limpa após uso

      const total = firstResult.total;
      const totalPages = Math.ceil(total / pageSize);

      allData.push(...firstResult.data);

      setProgress({
        current: firstResult.data.length,
        total,
        percentage: total > 0 ? Math.round((firstResult.data.length / total) * 100) : 100,
        page: 1,
        totalPages,
      });

      // Fetch restante sequencialmente
      // Nota: se os filtros mudarem durante a geração, o loop continua com
      // os filtros originais (capturados no closure de fetchPage). Isso é intencional.
      for (let page = 2; page <= totalPages; page++) {
        if (controller.signal.aborted) break;

        const result = await fetchPage(page, controller.signal);
        allData.push(...result.data);

        const elapsed = Date.now() - startTime;
        const avgPerPage = elapsed / page;
        const remainingPages = totalPages - page;
        const estimatedTimeLeft = avgPerPage * remainingPages;

        setProgress({
          current: allData.length,
          total,
          percentage: Math.round((allData.length / total) * 100),
          page,
          totalPages,
          estimatedTimeLeft,
        });
      }

      if (controller.signal.aborted) {
        return null;
      }

      setProgress(prev => ({ ...prev, percentage: 100 }));
      return allData;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return null;
      }
      setError(err);
      return null;
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [fetchPage, pageSize]);

  const generate = useCallback(async (): Promise<T[] | null> => {
    if (isGenerating) return null; // Previne double-click
    resetProgress();
    setIsGenerating(true); // Bloqueia botão imediatamente durante probe

    // Probe: busca primeira página para checar total
    const controller = new AbortController();
    try {
      const probe = await fetchPage(1, controller.signal);
      const total = probe.total;

      if (total > maxWarning) {
        // Guarda probe para reutilizar em confirmAndGenerate
        probeResultRef.current = probe;
        setNeedsConfirmation(true);
        setIsGenerating(false); // Desbloqueia enquanto espera confirmação
        setProgress({
          current: 0,
          total,
          percentage: 0,
          page: 0,
          totalPages: Math.ceil(total / pageSize),
        });
        return null;
      }

      // Total OK — guarda probe e gera direto (evita re-fetch da page 1)
      probeResultRef.current = probe;
    } catch (err: any) {
      setError(err);
      setIsGenerating(false);
      return null;
    }

    // doGenerate() vai setar isGenerating=true de novo (redundante mas seguro)
    return doGenerate();
  }, [isGenerating, resetProgress, fetchPage, maxWarning, pageSize, doGenerate]);

  const confirmAndGenerate = useCallback(async (): Promise<T[] | null> => {
    setNeedsConfirmation(false);
    // probeResultRef já tem o resultado da page 1 do probe
    return doGenerate();
  }, [doGenerate]);

  const dismissWarning = useCallback(() => {
    setNeedsConfirmation(false);
    resetProgress();
  }, [resetProgress]);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    generate,
    cancel,
    progress,
    isGenerating,
    needsConfirmation,
    confirmAndGenerate,
    dismissWarning,
    error,
  };
}
