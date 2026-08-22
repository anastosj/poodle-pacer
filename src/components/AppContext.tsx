"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Program, programs } from "@/lib/programs";
import {
  Plan,
  RunnerId,
  RunnerState,
  activePlan,
  loadState,
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

  useEffect(() => {
    const r = loadRunner();
    setRunnerState(r);
    setState(loadState(r));
  }, []);

  const setRunner = useCallback((r: RunnerId) => {
    setRunnerState(r);
    setState(loadState(r));
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RUNNER_KEY, r);
    }
  }, []);

  const update = useCallback(
    (updater: (prev: RunnerState) => RunnerState) => {
      setState((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        saveState(runner, next);
        return next;
      });
    },
    [runner]
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
