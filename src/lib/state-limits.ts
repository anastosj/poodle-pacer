/**
 * Largest accepted / stored serialized plan state, in bytes. Every stored blob
 * is read back and re-parsed for all users by `listUsersWithState` on each
 * group board render and cron alert tick, so one oversized record would be
 * everybody's problem.
 */
export const MAX_STATE_BYTES = 512 * 1024;
