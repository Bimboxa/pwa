import { useSyncExternalStore, useRef, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";

import {
  LOCAL_TAB_ID,
  getPeers,
  getPeersVersion,
  subscribePeers,
} from "App/tabsRegistry";
import { isInSyncGroup } from "Features/layout/utils/isEffectivelyCoupled";

const PEER_FRESH_MS = 5000;

function getSnapshot() {
  // Version increments on every peer change; React re-renders when it changes.
  return getPeersVersion();
}

function getServerSnapshot() {
  return 0;
}

export default function useIsWidestCoupledTab() {
  const location = useLocation();
  const localInSyncGroup = useSelector((s) =>
    isInSyncGroup(s, location.pathname)
  );

  // Peers map (mutated in place by tabsRegistry, but listener fires on change).
  useSyncExternalStore(subscribePeers, getSnapshot, getServerSnapshot);

  // Local window width — we track it separately so resizing this tab also re-evaluates.
  const [localWidth, setLocalWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 0
  );
  const rafRef = useRef(0);
  useEffect(() => {
    function onResize() {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setLocalWidth(window.innerWidth);
      });
    }
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // If the local tab is not in the sync group (on /dashboard or no
  // project/scope), it has no peer to coordinate with — render the toolbar.
  if (!localInSyncGroup) return true;

  const now = Date.now();
  const candidates = [
    { tabId: LOCAL_TAB_ID, innerWidth: localWidth },
  ];
  for (const peer of getPeers().values()) {
    if (!peer.inSyncGroup) continue;
    if (now - peer.lastSeen > PEER_FRESH_MS) continue;
    candidates.push({ tabId: peer.tabId, innerWidth: peer.innerWidth });
  }

  let winner = candidates[0];
  for (const c of candidates) {
    if (c.innerWidth > winner.innerWidth) {
      winner = c;
    } else if (c.innerWidth === winner.innerWidth && c.tabId < winner.tabId) {
      winner = c;
    }
  }
  return winner.tabId === LOCAL_TAB_ID;
}
