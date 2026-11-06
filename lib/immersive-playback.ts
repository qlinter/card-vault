export type Playback = { ids: string[]; remaining: string[]; history: string[]; index: number; random: boolean; round: number };
function roundOrder(ids: string[], random: boolean, last?: string, rng = Math.random) {
  const order = [...ids];
  if (random) for (let index = order.length - 1; index > 0; index--) { const target = Math.floor(rng() * (index + 1)); [order[index], order[target]] = [order[target], order[index]]; }
  if (order.length > 1 && order[0] === last) order.push(order.shift()!);
  return order;
}
export function startPlayback(ids: string[], random = false, rng = Math.random): Playback {
  const order = roundOrder([...new Set(ids)], random, undefined, rng);
  return { ids: [...new Set(ids)], remaining: order.slice(1), history: order.slice(0, 1), index: 0, random, round: 1 };
}
export function advancePlayback(state: Playback, delta: number, rng = Math.random): Playback {
  if (!state.ids.length) return state;
  if (delta < 0) return { ...state, index: Math.max(0, state.index - 1) };
  if (state.index < state.history.length - 1) return { ...state, index: state.index + 1 };
  const fresh = !state.remaining.length;
  const remaining = fresh ? roundOrder(state.ids, state.random, state.history[state.index], rng) : [...state.remaining];
  const next = remaining.shift()!;
  return { ...state, remaining, history: [...state.history, next], index: state.history.length, round: state.round + Number(fresh) };
}
export function changePlaybackOrder(state: Playback, random: boolean, rng = Math.random): Playback {
  const pending = new Set(state.remaining);
  return { ...state, random, remaining: roundOrder(state.ids.filter(id => pending.has(id)), random, undefined, rng) };
}
