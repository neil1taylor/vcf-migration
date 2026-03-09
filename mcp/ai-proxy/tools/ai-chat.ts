// ai_chat — watsonx chat via proxy

import { proxyPost } from '../lib/proxy-client';
import { buildChatPayload } from '../lib/payload-builders';

export async function aiChat(message: string): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const context = buildChatPayload();

  const res = await proxyPost('/api/chat', {
    message,
    context,
    history: [],
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
