/** Demo mode cannot mask a configured database failure. */
export function isDemoMode(): boolean {
  return process.env.OUTSIDER_DEMO_MODE === "true" && !process.env.DATABASE_URL;
}
