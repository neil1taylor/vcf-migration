// ai_call_endpoint — Generic proxy POST for any endpoint

import { proxyPost } from '../lib/proxy-client';

export async function aiCallEndpoint(
  path: string,
  body: Record<string, unknown>,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  const res = await proxyPost(path, body);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        endpoint: path,
        ok: res.ok,
        status: res.status,
        data: res.data,
        error: res.error,
      }, null, 2),
    }],
  };
}
