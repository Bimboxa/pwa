import { useSyncExternalStore } from "react";

import { getPeers, getPeersVersion, subscribePeers } from "App/tabsRegistry";

const PEER_FRESH_MS = 5000;

function getSnapshot() {
  // Version increments on every peer change; React re-renders when it changes.
  return getPeersVersion();
}

function getServerSnapshot() {
  return 0;
}

// True when another (fresh) tab is currently showing the 3D viewer. Used to
// gate the explicit "navigate the 3D camera" toolbar action: it only makes
// sense when a 3D-viewer tab exists to receive the broadcast.
export default function useHasThreedViewerPeer() {
  useSyncExternalStore(subscribePeers, getSnapshot, getServerSnapshot);

  const now = Date.now();
  for (const peer of getPeers().values()) {
    if (!peer.is3dView) continue;
    if (now - peer.lastSeen > PEER_FRESH_MS) continue;
    return true;
  }
  return false;
}
