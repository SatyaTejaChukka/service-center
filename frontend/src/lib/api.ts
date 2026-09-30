let cachedApiBase: string | null = null;

export function getApiBaseUrl(): string {
  if (cachedApiBase) return cachedApiBase;
  if (typeof window !== 'undefined') {
    if (window.electronAPI?.getBackendPort) {
      try {
        const port = window.electronAPI.getBackendPort();
        if (port) {
          cachedApiBase = `http://127.0.0.1:${port}/api/v1`;
          return cachedApiBase;
        }
      } catch {}
    }
    if (window.__WORKSHOP_API_PORT__) {
      cachedApiBase = `http://127.0.0.1:${window.__WORKSHOP_API_PORT__}/api/v1`;
      return cachedApiBase;
    }
  }
  return (import.meta as any).env?.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';
}

export const API_BASE_URL = getApiBaseUrl();

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('pr_auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = 'An error occurred';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail));
  }

  // If response is PDF binary or empty
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/pdf')) {
    return (await response.blob()) as unknown as T;
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

/**
 * Returns an authenticated direct URL for streaming/viewing/printing PDFs
 */
export function getPdfUrl(endpoint: string): string {
  const token = localStorage.getItem('pr_auth_token');
  const sep = endpoint.includes('?') ? '&' : '?';
  return `${getApiBaseUrl()}${endpoint}${token ? `${sep}token=${encodeURIComponent(token)}` : ''}`;
}

/**
 * Opens an authenticated PDF in a new tab for native printing or saving
 */
export function openPdfDocument(endpoint: string): void {
  const url = getPdfUrl(endpoint);
  window.open(url, '_blank');
}

/**
 * Downloads an authenticated binary/CSV report file directly
 */
export async function downloadReportFile(endpoint: string, defaultFilename: string): Promise<void> {
  const token = localStorage.getItem('pr_auth_token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, { headers });
  if (!response.ok) {
    throw new Error('Failed to download export file');
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition');
  let filename = defaultFilename;
  if (disposition && disposition.includes('filename=')) {
    const matches = disposition.match(/filename="?([^";]+)"?/);
    if (matches && matches[1]) {
      filename = matches[1];
    }
  }

  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  window.URL.revokeObjectURL(downloadUrl);
  document.body.removeChild(link);
}
