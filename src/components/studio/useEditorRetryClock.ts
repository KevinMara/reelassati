import { useEffect, useState } from "react";

/** Wake the retry control at the provider's deadline. Only a click starts work. */
export function useEditorRetryClock(retryAt?: number) {
  const [, update] = useState(0);
  useEffect(() => {
    if (!retryAt || retryAt <= Date.now()) return;
    const timer = window.setTimeout(
      () => update(value => value + 1),
      Math.min(86400000, retryAt - Date.now() + 1)
    );
    return () => window.clearTimeout(timer);
  }, [retryAt]);
  return retryAt && retryAt > Date.now()
    ? new Date(retryAt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : undefined;
}
