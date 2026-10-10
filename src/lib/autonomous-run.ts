export interface AutonomousRunContext {
  ownerEmail: string;
  brandId: string;
  projectId: string;
}

/** Check the intended destination immediately before scheduling work or mutating a workspace. */
export function assertAutonomousRunCurrent(
  expected: AutonomousRunContext,
  current: AutonomousRunContext & { projectExists: boolean },
  signal: AbortSignal
) {
  signal.throwIfAborted();
  if (
    expected.ownerEmail !== current.ownerEmail ||
    expected.brandId !== current.brandId ||
    expected.projectId !== current.projectId ||
    !current.projectExists
  ) {
    throw new Error(
      "Your account, brand, or project changed. No further editing steps were started; reopen the intended project to continue."
    );
  }
}
