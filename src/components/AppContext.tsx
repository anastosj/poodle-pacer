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
  Feel,
  Plan,
  RunnerState,
  activePlan,
  defaultState,
  loadState,
  normalizeState,
  readSyncMark,
  saveState,
  updateActivePlan,
  writeSyncMark,
} from "@/lib/store";
import { FetchedRun, applySyncedRuns } from "@/lib/sync";

export interface SessionUser {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface SyncResult {
  ok: boolean;
  error?: "not_connected" | "missing_scope" | "rate_limited" | "failed";
  /** Runs newly added to the run log. */
  added: number;
  /** Runs matched to a slot of the active plan. */
  matched: number;
  /** Of those, ones that filled a slot on a different day from the one done. */
  reordered: number;
  /** True when a sync was skipped as too recent to be worth spending a call. */
  skipped?: boolean;
}

/**
 * How long an automatic sync will trust the last one.
 *
 * Strava's rate limit is shared by every athlete signed into this app, so an
 * automatic call on every page load is the one piece of traffic guaranteed to
 * be mostly waste — the same list, re-fetched because somebody hit reload.
 * Activities take a little while to reach Strava anyway, so nothing is lost by
 * waiting. Pressing Sync in settings ignores this entirely.
 */
const AUTO_SYNC_COOLDOWN_MS = 5 * 60 * 1000;

const lastSyncKey = (userId: string) => `poodle-pacer:last-sync:${userId}`;

function syncedRecently(userId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(lastSyncKey(userId));
    if (!raw) return false;
    const at = Number(raw);
    // A clock that has gone backwards should retry, not lock syncing out.
    return Number.isFinite(at) && Date.now() - at < AUTO_SYNC_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markSynced(userId: string) {
  try {
    window.localStorage.setItem(lastSyncKey(userId), String(Date.now()));
  } catch {
    /* private browsing: the cooldown just never applies */
  }
}

interface AppContextValue {
  user: SessionUser;
  raceCount: number;
  /** False until the server copy has been fetched (or failed). */
  loaded: boolean;
  state: RunnerState;
  update: (updater: (prev: RunnerState) => RunnerState) => void;
  plan: Plan;
  updatePlan: (updater: (prev: Plan) => Plan) => void;
  program: Program;
  /**
   * Pull runs from Strava into the run log and the active plan. Pass
   * `{ auto: true }` to skip when the last sync is recent enough.
   */
  syncStrava: (options?: { auto?: boolean }) => Promise<SyncResult>;
  /** Rate a synced activity; passing the current feel clears it. */
  setRunFeel: (activityId: number, feel: Feel) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  user,
  raceCount,
  children,
}: {
  user: SessionUser;
  raceCount: number;
  children: ReactNode;
}) {
  // Must match what the server renders. localStorage is read after mount,
  // otherwise the first client render diverges and hydration fails.
  const [state, setState] = useState<RunnerState>(defaultState);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  /*
   * Bumped on every push. Only the newest one may declare the cache clean: an
   * earlier request completing late would otherwise mark edits it never
   * carried as saved, and the next load would discard them.
   */
  const revision = useRef(0);

  const pushRemote = useCallback(
    (s: RunnerState) => {
      const rev = (revision.current += 1);
      // Flag before the request, not after. A tab closed inside the debounce
      // window has to come back knowing the cache was never confirmed.
      writeSyncMark(user.id, {
        syncedAt: readSyncMark(user.id).syncedAt,
        pending: true,
      });
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          const res = await fetch("/api/state", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ state: s }),
          });
          if (!res.ok) return;
          const json = (await res.json()) as { updatedAt?: string };
          if (rev !== revision.current) return;
          writeSyncMark(user.id, {
            syncedAt: json.updatedAt ?? null,
            pending: false,
          });
        } catch {
          // Offline. The mark stays pending, which is what protects the edit.
        }
      }, 600);
    },
    [user.id]
  );

  useEffect(() => {
    let cancelled = false;
    const local = loadState(user.id);
    const mark = readSyncMark(user.id);
    setState(local);

    (async () => {
      try {
        const res = await fetch("/api/state");
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as {
          state?: unknown;
          updatedAt?: string | null;
        };
        if (cancelled) return;
        if (!json.state) {
          // First sign-in on this account, so seed the server from local.
          pushRemote(local);
          return;
        }
        if (mark.pending) {
          /*
           * The cache holds edits the server never acknowledged — runs logged
           * with no signal, most likely. Taking the server copy here would
           * delete them, so local stays in charge and is pushed instead.
           */
          if (json.updatedAt && json.updatedAt !== mark.syncedAt) {
            /*
             * Both sides moved since this device last synced, and state is
             * stored as one document with no per-field merge, so pushing local
             * will drop whatever the other device wrote. Losing runs recorded
             * offline is the worse of the two, but this is the case a real
             * merge would need to handle.
             */
            console.warn(
              "[poodle-pacer] local edits and a newer server copy both exist; keeping local"
            );
          }
          pushRemote(local);
          return;
        }
        const remote = normalizeState(json.state);
        setState(remote);
        saveState(user.id, remote);
        writeSyncMark(user.id, {
          syncedAt: json.updatedAt ?? null,
          pending: false,
        });
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

  /** Rate a synced activity, whether or not it belongs to the plan. */
  const setRunFeel = useCallback(
    (activityId: number, feel: Feel) => {
      update((prev) => ({
        ...prev,
        runs: (prev.runs ?? []).map((run) =>
          run.stravaActivityId === activityId
            ? { ...run, feel: run.feel === feel ? undefined : feel }
            : run
        ),
      }));
    },
    [update]
  );

  const syncStrava = useCallback(
    async (options?: { auto?: boolean }): Promise<SyncResult> => {
    const none = { added: 0, matched: 0, reordered: 0 };
    // An automatic sync that would only re-fetch what it fetched minutes ago
    // spends a request out of a budget the whole pack shares. Skip it.
    if (options?.auto && syncedRecently(user.id)) {
      return { ok: true, skipped: true, ...none };
    }
    let runs: FetchedRun[];
    try {
      const res = await fetch("/api/strava/activities");
      if (res.status === 401) return { ok: false, error: "not_connected", ...none };
      if (res.status === 403) return { ok: false, error: "missing_scope", ...none };
      if (res.status === 429) return { ok: false, error: "rate_limited", ...none };
      if (!res.ok) return { ok: false, error: "failed", ...none };
      runs = ((await res.json()) as { runs: FetchedRun[] }).runs;
    } catch {
      return { ok: false, error: "failed", ...none };
    }
    // Only a call that actually reached Strava resets the clock, so a failure
    // is never mistaken for a fresh sync and left uncorrected for five minutes.
    markSynced(user.id);
    const current = stateRef.current;
    const program =
      programs.find((p) => p.id === activePlan(current).programId) ??
      programs[0];
    const outcome = applySyncedRuns(current, program, runs);
    if (outcome.added > 0 || outcome.matched > 0) {
      update(() => outcome.state);
    }
    return {
      ok: true,
      added: outcome.added,
      matched: outcome.matched,
      reordered: outcome.reordered,
    };
    },
    [update, user.id]
  );

  // Runs sync themselves whenever the app is opened, subject to the cooldown;
  // the Settings button is a way to force one regardless.
  const autoSynced = useRef(false);
  useEffect(() => {
    if (!loaded || autoSynced.current) return;
    autoSynced.current = true;
    syncStrava({ auto: true }).catch(() => {});
  }, [loaded, syncStrava]);

  const plan = useMemo(() => activePlan(state), [state]);
  const program = useMemo(
    () => programs.find((p) => p.id === plan.programId) ?? programs[0],
    [plan.programId]
  );

  const value = useMemo(
    () => ({
      user,
      raceCount,
      loaded,
      state,
      update,
      plan,
      updatePlan,
      program,
      syncStrava,
      setRunFeel,
    }),
    [
      user,
      raceCount,
      loaded,
      state,
      update,
      plan,
      updatePlan,
      program,
      syncStrava,
      setRunFeel,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
