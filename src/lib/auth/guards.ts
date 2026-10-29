import "server-only";
import { redirect } from "next/navigation";
import { getViewer } from "./session";
import { resolveAreaAccess, type Area, type Viewer } from "./policy";

/**
 * Use at the top of every protected layout AND every server action.
 * Layout checks alone are not sufficient for actions, which are public endpoints.
 */
export async function requireViewer(area: Area): Promise<Viewer> {
  const viewer = await getViewer();
  const decision = resolveAreaAccess(viewer, area);
  if (decision.kind === "redirect") redirect(decision.to);
  // resolveAreaAccess only allows when viewer is non-null.
  return viewer as Viewer;
}

/** For actions that must return an error state instead of redirecting. */
export async function assertRole(area: Area): Promise<Viewer | null> {
  const viewer = await getViewer();
  return resolveAreaAccess(viewer, area).kind === "allow" ? viewer : null;
}
