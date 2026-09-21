// Reconnect with fresh credentials; resync on every connection, because the
// server sends invalidations rather than a replayable event log.
export function watchRelayEvents({
  stream,
  refresh,
  onStatus,
  retryMs = 1000,
  pollMs = 10000,
  idleMs = 45000,
}) {
  let stopped = false;
  let healthy = false;
  let controller;
  let retry;
  let watchdog;
  let refreshing = false;
  let dirty = false;
  let failures = 0;
  const resync = async () => {
    dirty = true;
    if (refreshing || stopped) return;
    refreshing = true;
    try {
      do {
        dirty = false;
        await refresh();
      } while (dirty && !stopped);
    } catch {
      if (!stopped) onStatus("error");
    } finally {
      refreshing = false;
    }
  };
  const connect = async () => {
    controller = new AbortController();
    const activity = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => controller.abort(), idleMs);
    };
    activity();
    try {
      await stream({
        signal: controller.signal,
        onActivity: activity,
        onEvent: (event) => {
          if (stopped) return;
          if (event.type === "error") {
            controller.abort();
            return;
          }
          if (event.type === "ready" || event.type === "change") {
            healthy = true;
            failures = 0;
            onStatus("subscribed");
            void resync();
          }
        },
      });
    } catch {
      // The periodic fallback keeps jobs available while streaming is down.
    } finally {
      clearTimeout(watchdog);
      healthy = false;
      if (!stopped) {
        onStatus("error");
        void resync();
        retry = setTimeout(connect, Math.min(retryMs * 2 ** failures++, 30000));
      }
    }
  };
  const polling = setInterval(() => {
    if (!healthy) void resync();
  }, pollMs);
  void connect();
  return () => {
    stopped = true;
    clearTimeout(retry);
    clearTimeout(watchdog);
    clearInterval(polling);
    controller?.abort();
    onStatus("idle");
  };
}
