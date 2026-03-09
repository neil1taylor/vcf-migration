// configure_proxy — Switch AI proxy URL

import { setProxyUrl, getState } from '../lib/state';

export function configureProxy(preset?: 'local' | 'code-engine', url?: string): { content: Array<{ type: 'text'; text: string }> } {
  if (url) {
    setProxyUrl(url);
  } else if (preset === 'code-engine') {
    const envUrl = process.env.VITE_AI_PROXY_URL;
    if (!envUrl) {
      throw new Error('VITE_AI_PROXY_URL environment variable not set');
    }
    setProxyUrl(envUrl);
  } else {
    // Default to local
    setProxyUrl('http://localhost:8080');
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ proxyBaseUrl: getState().proxyBaseUrl }),
    }],
  };
}
