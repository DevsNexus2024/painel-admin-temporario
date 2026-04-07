import type { ParsedMetrics } from '@/types/system';

/**
 * Parser de métricas Prometheus (text/plain) para objetos tipados.
 *
 * Extrai:
 * - http_requests_total (counter) — soma de todas as labels
 * - http_request_errors_total (counter) — soma de todas as labels
 * - http_request_duration_seconds (histogram) — percentis P50, P95, P99 via interpolação de buckets
 * - process_resident_memory_bytes (gauge) — direto
 * - process_cpu_seconds_total (counter) — direto
 */

interface BucketEntry {
  le: number;
  count: number;
}

export function parsePrometheusMetrics(raw: string): ParsedMetrics {
  const lines = raw.split('\n');

  let httpRequestsTotal = 0;
  let httpErrorsTotal = 0;
  let memoryRssBytes = 0;
  let cpuSecondsTotal = 0;

  // Agrupar buckets do histogram por route+method para somar
  const durationBuckets: BucketEntry[] = [];
  let durationCount = 0;

  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') continue;

    // http_requests_total{...} value
    if (line.startsWith('http_requests_total')) {
      httpRequestsTotal += extractValue(line);
      continue;
    }

    // http_request_errors_total{...} value
    if (line.startsWith('http_request_errors_total')) {
      httpErrorsTotal += extractValue(line);
      continue;
    }

    // http_request_duration_seconds_bucket{le="...", ...} value
    if (line.startsWith('http_request_duration_seconds_bucket')) {
      const le = extractLabel(line, 'le');
      const val = extractValue(line);
      if (le !== null) {
        durationBuckets.push({ le, count: val });
      }
      continue;
    }

    // http_request_duration_seconds_count{...} value
    if (line.startsWith('http_request_duration_seconds_count')) {
      durationCount += extractValue(line);
      continue;
    }

    // process_resident_memory_bytes value
    if (line.startsWith('process_resident_memory_bytes')) {
      memoryRssBytes = extractValue(line);
      continue;
    }

    // process_cpu_seconds_total value
    if (line.startsWith('process_cpu_seconds_total')) {
      cpuSecondsTotal = extractValue(line);
      continue;
    }
  }

  // Agregar buckets (somar contagens de todas as routes para cada le)
  const aggregatedBuckets = aggregateBuckets(durationBuckets);

  const errorRate = httpRequestsTotal > 0
    ? (httpErrorsTotal / httpRequestsTotal) * 100
    : 0;

  return {
    httpRequestsTotal,
    httpErrorsTotal,
    errorRate: Math.round(errorRate * 100) / 100,
    latencyP50Ms: Math.round(interpolatePercentile(aggregatedBuckets, durationCount, 0.5) * 1000 * 100) / 100,
    latencyP95Ms: Math.round(interpolatePercentile(aggregatedBuckets, durationCount, 0.95) * 1000 * 100) / 100,
    latencyP99Ms: Math.round(interpolatePercentile(aggregatedBuckets, durationCount, 0.99) * 1000 * 100) / 100,
    memoryRssMb: Math.round((memoryRssBytes / (1024 * 1024)) * 100) / 100,
    cpuSecondsTotal: Math.round(cpuSecondsTotal * 100) / 100,
  };
}

function extractValue(line: string): number {
  const parts = line.split(/\s+/);
  const val = parseFloat(parts[parts.length - 1]);
  return isNaN(val) ? 0 : val;
}

function extractLabel(line: string, label: string): number | null {
  const regex = new RegExp(`${label}="([^"]+)"`);
  const match = line.match(regex);
  if (!match) return null;
  if (match[1] === '+Inf') return Infinity;
  const val = parseFloat(match[1]);
  return isNaN(val) ? null : val;
}

/**
 * Agrega buckets de múltiplas series (route/method) num único set.
 * Para cada valor de `le`, soma as contagens.
 */
function aggregateBuckets(buckets: BucketEntry[]): BucketEntry[] {
  const byLe = new Map<number, number>();
  for (const b of buckets) {
    byLe.set(b.le, (byLe.get(b.le) || 0) + b.count);
  }
  return Array.from(byLe.entries())
    .map(([le, count]) => ({ le, count }))
    .sort((a, b) => a.le - b.le);
}

/**
 * Interpola percentil a partir de buckets de histogram Prometheus.
 * Usa interpolação linear entre os limites dos buckets.
 * Retorna valor em segundos.
 */
function interpolatePercentile(
  buckets: BucketEntry[],
  totalCount: number,
  percentile: number,
): number {
  if (buckets.length === 0 || totalCount === 0) return 0;

  const target = percentile * totalCount;

  for (let i = 0; i < buckets.length; i++) {
    if (buckets[i].count >= target) {
      const prevCount = i > 0 ? buckets[i - 1].count : 0;
      const prevLe = i > 0 ? buckets[i - 1].le : 0;
      const currLe = buckets[i].le;
      const currCount = buckets[i].count;

      if (currLe === Infinity) {
        return prevLe;
      }

      const fraction = currCount - prevCount > 0
        ? (target - prevCount) / (currCount - prevCount)
        : 0;

      return prevLe + fraction * (currLe - prevLe);
    }
  }

  // Se passou todos os buckets, retornar o último bucket finito
  const lastFinite = buckets.filter(b => b.le !== Infinity);
  return lastFinite.length > 0 ? lastFinite[lastFinite.length - 1].le : 0;
}
