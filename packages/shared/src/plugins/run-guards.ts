import type { GuardContext, GuardDecision, GuardPlugin } from './types.js';

export async function runGuards(
  guards: GuardPlugin[],
  ctx: GuardContext
): Promise<{ decision: GuardDecision; acquired: GuardPlugin[] }> {
  const acquired: GuardPlugin[] = [];
  for (const guard of guards) {
    const decision = await guard.check(ctx);
    if (!decision.allow) {
      // Release any guards that already acquired resources (e.g. concurrent)
      for (const g of acquired.reverse()) {
        await g.release?.(ctx);
      }
      return { decision, acquired: [] };
    }
    if (guard.release) acquired.push(guard);
  }
  return { decision: { allow: true }, acquired };
}

export async function releaseGuards(
  acquired: GuardPlugin[],
  ctx: GuardContext
): Promise<void> {
  for (const g of [...acquired].reverse()) {
    try {
      await g.release?.(ctx);
    } catch {
      // best-effort
    }
  }
}
