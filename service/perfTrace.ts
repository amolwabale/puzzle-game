import { getApp } from '@react-native-firebase/app';
import { getPerformance, trace } from '@react-native-firebase/perf';

type AttrValue = string | number | boolean | null | undefined;

function toAttrString(v: AttrValue): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : undefined;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return undefined;
}

export async function traceAsync<T>(
  name: string,
  fn: () => Promise<T>,
  attrs?: Record<string, AttrValue>,
): Promise<T> {
  let perfTrace: any = null;
  try {
    perfTrace = trace(getPerformance(getApp()), name);
    await perfTrace.start();
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        const s = toAttrString(v);
        if (s != null) {
          try {
            perfTrace.putAttribute?.(k, s);
          } catch {}
        }
      }
    }
  } catch {
    perfTrace = null;
  }

  try {
    return await fn();
  } finally {
    try {
      await perfTrace?.stop?.();
    } catch {}
  }
}

