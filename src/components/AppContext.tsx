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
  RunnerId,
  RunnerState,
  activePlan,
  loadState,
  normalizeState,
  saveState,
  updateActivePlan,
} from "@/lib/store";

interface AppContextValue {
  runner: RunnerId;
  setRunner: (runner: RunnerId) => void;
  state: RunnerState;
  update: (updater: (prev: RunnerState) => RunnerState) => void;
  plan: Plan;
  updatePlan: (updater: (prev: Plan) => Plan) => void;
  program: Program;
}

const AppContext = createContext<AppContextValue | null>(null);

const RUNNER_KEY = "hm-trainer:runner";

function loadRunner(): RunnerId {
  if (typeof window === "undefined") return "jonathan";
  return window.localStorage.getItem(RUNNER_KEY) === "sam" ? "sam" : "jonathan";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [runner, setRunnerState] = useState<RunnerId>("jonathan");
  const [state, setState] = useState<RunnerState | null>(null);
  const runnerRef = useRef<RunnerId>("jonathan");
  const saveTimers = useRef<Partial<Record<RunnerId, ReturnType<typeof setTimeout>>>>(
    {}
  );

  const pushRemote = useCallback((r: RunnerId, s: RunnerState) => {
    const timers = saveTimers.current;
    const existing = timers[r];
    if (existing) clearTimeout(existing);
    timers[r] = setTimeout(() => {
      fetch(`/api/state?runner=${r}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: s }),
      }).catch(() => {});
    }, 600);
  }, []);

  const loadFor = useCallback(
    async (r: RunnerId) => {
      runnerRef.current = r;
      const local = loadState(r);
      setState(local);
      try {
        const res = await fetch(`/api/state?runner=${r}`);
        if (!res.ok) return;
        const json = (await res.json()) as { state?: unknown };
        if (runnerRef.current !== r) return;
        if (json.state) {
          const remote = normalizeState(json.state);
          setState(remote);
          saveState(r, remote);
        } else {
          pushRemote(r, local);
        }
      } catch {
        // offline — localStorage copy stays in charge
      }
    },
    [pushRemote]
  );

  useEffect(() => {
    const r = loadRunner();
    setRunnerState(r);
    void loadFor(r);
  }, [loadFor]);

  const setRunner = useCallback(
    (r: RunnerId) => {
      setRunnerState(r);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(RUNNER_KEY, r);
      }
      void loadFor(r);
    },
    [loadFor]
  );

  const update = useCallback(
    (updater: (prev: RunnerState) => RunnerState) => {
      setState((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        saveState(runner, next);
        pushRemote(runner, next);
        return next;
      });
    },
    [runner, pushRemote]
  );

  const updatePlan = useCallback(
    (updater: (prev: Plan) => Plan) => {
      update((prev) => updateActivePlan(prev, updater));
    },
    [update]
  );

  const plan = useMemo(() => (state ? activePlan(state) : null), [state]);
  const program = useMemo(
    () => programs.find((p) => p.id === plan?.programId) ?? programs[0],
    [plan?.programId]
  );

  const value = useMemo(
    () =>
      state && plan
        ? { runner, setRunner, state, update, plan, updatePlan, program }
        : null,
    [runner, setRunner, state, update, plan, updatePlan, program]
  );

  if (!value) return null;

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
