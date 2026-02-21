import perf from '@react-native-firebase/perf';

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
  let trace: any = null;
  try {
    trace = await perf().startTrace(name);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        const s = toAttrString(v);
        if (s != null) {
          try {
            trace.putAttribute?.(k, s);
          } catch {}
        }
      }
    }
  } catch {
    trace = null;
  }

  try {
    return await fn();
  } finally {
    try {
      trace?.stop?.();
    } catch {}
  }
}

