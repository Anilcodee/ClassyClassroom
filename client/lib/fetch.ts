export async function xhrFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    try {
      const method = (options && (options as any).method) || 'GET';
      const headers = (options && (options as any).headers) || {};
      const body = (options && (options as any).body) || null;
      const resolvedUrl = typeof location !== 'undefined' && typeof url === 'string' && url.startsWith('/') ? `${location.origin}${url}` : url;
      const xhr = new XMLHttpRequest();
      xhr.open(method, resolvedUrl as string, true);
      try {
        Object.keys(headers || {}).forEach((hk) => {
          try { xhr.setRequestHeader(hk, (headers as any)[hk]); } catch {}
        });
      } catch {}
      xhr.onreadystatechange = () => {
        if (xhr.readyState !== 4) return;
        const hdrs: Record<string,string> = {};
        try {
          const raw = xhr.getAllResponseHeaders() || '';
          raw.trim().split(/\r?\n/).forEach((line) => {
            const idx = line.indexOf(':');
            if (idx > 0) { const k = line.slice(0,idx).trim(); const v = line.slice(idx+1).trim(); hdrs[k]=v; }
          });
        } catch {}
        const responseInit: ResponseInit = { status: xhr.status || 0, headers: hdrs };
        resolve(new Response(xhr.responseText, responseInit));
      };
      xhr.onerror = () => reject(new Error('XHR error'));
      if (body) xhr.send(body as any); else xhr.send();
    } catch (err) { reject(err); }
  });
}

export async function fetchWithRetry(url: string, init: RequestInit & { timeoutMs?: number } = {}, attempt = 1): Promise<Response> {
  const { timeoutMs, signal, ...rest } = init as any;
  // Prefer native fetch
  let resolvedUrl: any = url;
  try {
    const nativeFetch = (globalThis as any).fetch?.bind(globalThis) ?? fetch;
    resolvedUrl = typeof location !== 'undefined' && typeof url === 'string' && url.startsWith('/') ? `${location.origin}${url}` : url;

    // If a timeout is provided, create AbortController
    let ac: AbortController | null = null;
    let t: any = null;
    if (typeof timeoutMs === 'number') {
      ac = new AbortController();
      t = setTimeout(() => ac!.abort(), timeoutMs);
    }

    // Wire external signal to inner controller
    const innerSignal = ac ? ac.signal : undefined;
    const onAbort = signal && ac ? () => ac!.abort() : undefined;
    if (signal && onAbort) signal.addEventListener('abort', onAbort, { once: true });

    try {
      return await nativeFetch(resolvedUrl, { ...rest, signal: innerSignal ?? signal });
    } catch (e: any) {
      const aborted = (signal && (signal as any).aborted) || e?.name === 'AbortError' || (ac && (ac.signal as any).aborted);
      if (aborted) {
        throw e;
      }
      // Try XHR fallback
      try {
        return await xhrFetch(resolvedUrl, rest);
      } catch {}
      // Retry below
    } finally {
      if (t) clearTimeout(t);
      if (signal && onAbort) signal.removeEventListener('abort', onAbort as any);
    }
  } catch (e) {
    // fallthrough to retry logic
  }

  if (attempt < 3 && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
    await new Promise((r) => setTimeout(r, 300 * attempt));
    return fetchWithRetry(url, init, attempt + 1);
  }

  return new Response(JSON.stringify({ message: 'Network error' }), { status: 0, headers: { 'Content-Type': 'application/json' } });
}
