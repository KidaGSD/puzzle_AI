/**
 * useHistory Hook
 * 通用的 Undo/Redo 历史管理
 * 
 * 使用方法：
 * const { state, setState, undo, redo, canUndo, canRedo } = useHistory(initialState);
 */

import { useState, useCallback, useRef } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UseHistoryReturn<T> {
  state: T;
  setState: (newState: T | ((prev: T) => T)) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clear: () => void;
}

export function useHistory<T>(initialState: T, maxHistory: number = 50): UseHistoryReturn<T> {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  // 防抖引用，避免频繁记录历史
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setState = useCallback((newState: T | ((prev: T) => T)) => {
    setHistory((currentHistory) => {
      const actualNewState = typeof newState === 'function'
        ? (newState as (prev: T) => T)(currentHistory.present)
        : newState;

      // 如果状态没有变化，不记录历史
      if (JSON.stringify(actualNewState) === JSON.stringify(currentHistory.present)) {
        return currentHistory;
      }

      // 限制历史记录数量
      const newPast = [...currentHistory.past, currentHistory.present];
      if (newPast.length > maxHistory) {
        newPast.shift(); // 移除最旧的记录
      }

      return {
        past: newPast,
        present: actualNewState,
        future: [], // 新操作会清空 future
      };
    });
  }, [maxHistory]);

  const undo = useCallback(() => {
    setHistory((currentHistory) => {
      if (currentHistory.past.length === 0) {
        return currentHistory;
      }

      const previous = currentHistory.past[currentHistory.past.length - 1];
      const newPast = currentHistory.past.slice(0, currentHistory.past.length - 1);

      return {
        past: newPast,
        present: previous,
        future: [currentHistory.present, ...currentHistory.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((currentHistory) => {
      if (currentHistory.future.length === 0) {
        return currentHistory;
      }

      const next = currentHistory.future[0];
      const newFuture = currentHistory.future.slice(1);

      return {
        past: [...currentHistory.past, currentHistory.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const clear = useCallback(() => {
    setHistory((currentHistory) => ({
      past: [],
      present: currentHistory.present,
      future: [],
    }));
  }, []);

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    clear,
  };
}