import { useEffect, useReducer } from 'react';
import { reduce } from './state';
import { loadState, saveState } from './storage';

/** The halaqa's state, saved after every change. */
export function useHalaqa() {
  const [state, dispatch] = useReducer(reduce, undefined, loadState);
  useEffect(() => saveState(state), [state]);
  return [state, dispatch] as const;
}
