/** Normalized construction lines for one empty display bay. The photograph supplies its appearance. */
export type StudioStagePlan = {
  aspect: number; back: number; front: number;
  steps: {left:number; right:number; back:number; front:number; base:number; depth:number}[];
};

export function validStagePlan(value: unknown): value is StudioStagePlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as StudioStagePlan;
  const unit = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1;
  return Number.isFinite(plan.aspect) && plan.aspect >= .15 && plan.aspect <= 12
    && unit(plan.back) && unit(plan.front) && plan.back < plan.front && Array.isArray(plan.steps) && plan.steps.length <= 7
    && plan.steps.every(s => s && [s.left,s.right,s.back,s.front,s.base,s.depth].every(unit)
      && s.left < s.right && s.back < s.front && s.front < s.base && s.right + s.depth <= 1.000001);
}
