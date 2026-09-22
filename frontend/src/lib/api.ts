const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

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

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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
  return `${API_BASE_URL}${endpoint}${token ? `${sep}token=${encodeURIComponent(token)}` : ''}`;
}

/**
 * Opens an authenticated PDF in a new tab for native printing or saving
 */
export function openPdfDocument(endpoint: string): void {
  const url = getPdfUrl(endpoint);
  window.open(url, '_blank');
}
