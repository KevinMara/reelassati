/** A reload/adoption owns a new persistence context, even for the same account.
 * Saves from the old context may finish on the server but cannot acknowledge,
 * report conflicts, or clear the new context's pending-save indicator. */
export class WorkspaceSaveLifecycle {
  private epoch = 0;
  private pending = 0;

  reset() {
    this.pending = 0;
    return ++this.epoch;
  }

  current(epoch: number) {
    return this.epoch === epoch;
  }

  begin() {
    this.pending++;
    return this.epoch;
  }

  finish(epoch: number): boolean | null {
    if (!this.current(epoch)) return null;
    this.pending = Math.max(0, this.pending - 1);
    return this.pending === 0;
  }
}
