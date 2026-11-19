// Release preview WASM heaps while the export engine owns the memory budget.
// Canvas pixels stay visible; previews resume when the export settles.
let exportsInProgress = 0;
const listeners = new Set<() => void>();
export const nativeGraphicExportActive = () => exportsInProgress > 0;
export function subscribeNativeGraphicActivity(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function beginNativeGraphicExport() {
  exportsInProgress++;
  listeners.forEach(listener => listener());
  let released = false;
  return () => {
    if (released) return;
    released = true;
    exportsInProgress--;
    listeners.forEach(listener => listener());
  };
}
