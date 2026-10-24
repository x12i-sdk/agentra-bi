import assert from 'node:assert/strict';
import { createAgentraCountex, userBehaviorMap } from '@x12i/agentra-countex';
const scope = { tenantId: 'fixture-tenant', accountId: 'fixture-account', environment: 'dev' };
const events = [1, 2].map(index => ({ scope, event: { id: 'event-' + index, type: 'report.generated', createdAt: new Date().toISOString() },
  actor: { id: 'fixture-user', type: 'user' }, product: { app: 'example', feature: 'reports' }, classification: { status: 'success' },
}));
const counters = createAgentraCountex([userBehaviorMap]);
await counters.init();
await counters.ingestBatch(events);
await counters.flush();
import { AgentraQueryEngine } from '@x12i/agentra-query';
const query = new AgentraQueryEngine({ countex: counters });
// This map emits both user and account subjects; select one subject to count its events.
const spec = { scope: scope.tenantId, counterId: userBehaviorMap.counterId, timeframe: { type: 'day', relative: '7d' }, subject: { type: 'user', ids: ['fixture-user'] }, metrics: ['report.generated'], format: 'table' };
import { AgentraMetricRegistry, AgentraBiEngine } from '@x12i/agentra-bi';
try {
  const registry = new AgentraMetricRegistry([{ id: 'generated-reports', name: 'Generated reports', counterId: userBehaviorMap.counterId, metric: 'report.generated', defaultAggregation: 'count', defaultTimeframe: 'day' }]);
  const bi = new AgentraBiEngine(registry, query);
  const compiled = bi.compileMetricQuery('generated-reports', scope.tenantId);
  assert.deepEqual(compiled.metrics, ['report.generated']);
  const result = await bi.runMetric('generated-reports', scope.tenantId, { subject: spec.subject });
  assert(result.rows.some(row => row.count === 2));
  console.log({ compiled, result });
} finally { await counters.shutdown(); }
