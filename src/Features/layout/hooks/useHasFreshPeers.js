import { useSyncExternalStore } from "react";

import { getPeers, getPeersVersion, subscribePeers } from "App/tabsRegistry";

const PEER_FRESH_MS = 5000;

function getSnapshot() {
  return getPeersVersion();
}

function getServerSnapshot() {
  return 0;
}

export default function useHasFreshPeers() {
  useSyncExternalStore(subscribePeers, getSnapshot, getServerSnapshot);

  const now = Date.now();
  for (const peer of getPeers().values()) {
    if (now - peer.lastSeen <= PEER_FRESH_MS) return true;
  }
  return false;
}
