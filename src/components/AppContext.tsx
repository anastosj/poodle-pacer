"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Program, programs } from "@/lib/programs";
import {
  Plan,
  RunnerState,
  activePlan,
  defaultState,
  loadState,
  normalizeState,
  saveState,
  updateActivePlan,
} from "@/lib/store";

export interface SessionUser {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

interface AppContextValue {
  user: SessionUser;
  /** False until the server copy has been fetched (or failed). */
  loaded: boolean;
  state: RunnerState;
  update: (updater: (prev: RunnerState) => RunnerState) => void;
  plan: Plan;
  updatePlan: (updater: (prev: Plan) => Plan) => void;
  program: Program;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  // Must match what the server renders. localStorage is read after mount,
  // otherwise the first client render diverges and hydration fails.
  const [state, setState] = useState<RunnerState>(defaultState);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushRemote = useCallback((s: RunnerState) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: s }),
      }).catch(() => {});
    }, 600);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const local = loadState(user.id);
    setState(local);

    (async () => {
      try {
        const res = await fetch("/api/state");
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { state?: unknown };
        if (cancelled) return;
        if (json.state) {
          const remote = normalizeState(json.state);
          setState(remote);
          saveState(user.id, remote);
        } else {
          // First sign-in on this account, so seed the server from local.
          pushRemote(local);
        }
      } catch {
        // Offline, so the cached copy stays in charge.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user.id, pushRemote]);

  const update = useCallback(
    (updater: (prev: RunnerState) => RunnerState) => {
      setState((prev) => {
        const next = updater(prev);
        saveState(user.id, next);
        pushRemote(next);
        return next;
      });
    },
    [user.id, pushRemote]
  );

  const updatePlan = useCallback(
    (updater: (prev: Plan) => Plan) => {
      update((prev) => updateActivePlan(prev, updater));
    },
    [update]
  );

  const plan = useMemo(() => activePlan(state), [state]);
  const program = useMemo(
    () => programs.find((p) => p.id === plan.programId) ?? programs[0],
    [plan.programId]
  );

  const value = useMemo(
    () => ({ user, loaded, state, update, plan, updatePlan, program }),
    [user, loaded, state, update, plan, updatePlan, program]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
