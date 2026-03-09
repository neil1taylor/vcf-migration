// ai_health_check / ai_readiness_check — Proxy health endpoints

import { proxyGet } from '../lib/proxy-client';
import { getState } from '../lib/state';

export async function aiHealthCheck(): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const res = await proxyGet('/health');
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        proxyUrl: getState().proxyBaseUrl,
        healthy: res.ok,
        status: res.status,
        data: res.data,
        error: res.error,
      }, null, 2),
    }],
  };
}

export async function aiReadinessCheck(): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const res = await proxyGet('/ready');
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        proxyUrl: getState().proxyBaseUrl,
        ready: res.ok,
        status: res.status,
        data: res.data,
        error: res.error,
      }, null, 2),
    }],
  };
}
