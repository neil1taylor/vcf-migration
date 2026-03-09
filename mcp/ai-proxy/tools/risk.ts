// assess_risks — Auto-detected + curated risk table

import { requireData } from '../lib/state';
import { buildRiskTable } from '@/services/riskAssessment';

export function assessRisks(): { content: Array<{ type: 'text'; text: string }> } {
  const data = requireData();
  const riskTable = buildRiskTable(data);

  const statusCounts = { red: 0, amber: 0, green: 0 };
  for (const row of riskTable.rows) {
    statusCounts[row.status]++;
  }

  const byCategory = new Map<string, number>();
  for (const row of riskTable.rows) {
    byCategory.set(row.category, (byCategory.get(row.category) || 0) + 1);
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        totalRisks: riskTable.rows.length,
        statusCounts,
        byCategory: Object.fromEntries(byCategory),
        risks: riskTable.rows.map(r => ({
          id: r.id,
          source: r.source,
          category: r.category,
          status: r.status,
          description: r.description,
          impactArea: r.impactArea,
          mitigationPlan: r.mitigationPlan,
          evidenceDetail: r.evidenceDetail,
        })),
      }, null, 2),
    }],
  };
}
