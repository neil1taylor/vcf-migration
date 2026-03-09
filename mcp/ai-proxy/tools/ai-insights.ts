// ai_get_insights — watsonx insights via proxy

import { proxyPost } from '../lib/proxy-client';
import { buildInsightsPayload } from '../lib/payload-builders';

export async function aiGetInsights(migrationTarget?: string): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const payload = buildInsightsPayload(migrationTarget);

  const res = await proxyPost('/api/insights', {
    input: payload,
    migrationTarget: migrationTarget || 'roks',
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        ok: res.ok,
        status: res.status,
        data: res.data,
        error: res.error,
      }, null, 2),
    }],
  };
}
