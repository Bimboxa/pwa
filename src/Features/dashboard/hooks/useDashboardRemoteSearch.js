import { useState, useEffect, useRef } from "react";

import { useSelector } from "react-redux";

import useFetchMasterProjects from "Features/masterProjects/hooks/useFetchMasterProjects";
import useSearchScopeConfigurations from "Features/remoteScopeConfigurations/hooks/useSearchScopeConfigurations";

const DEBOUNCE_MS = 400;
const MIN_SEARCH_LENGTH = 2;

// masterProjects origin keys by project type (same mapping as the scopeCreator
// project selector — see SelectorProjectFromItemsList).
const ORIGIN_KEY_BY_TYPE = { CHANTIER: "chantiers", OPPORTUNITE: "opportunités" };

export default function useDashboardRemoteSearch(searchText, typeFilter) {
  // data

  const jwt = useSelector((s) => s.auth.jwt);
  const userProfile = useSelector((s) => s.auth.userProfile);

  const fetchMasterProjects = useFetchMasterProjects();
  const searchScopeConfigurations = useSearchScopeConfigurations();

  // state

  const [remoteProjects, setRemoteProjects] = useState([]);
  const [remoteScopeConfigs, setRemoteScopeConfigs] = useState([]);
  const [loading, setLoading] = useState(false);

  // staleness guard: only the latest search may write results
  const searchCounterRef = useRef(0);

  // effect

  useEffect(() => {
    const searchValue = searchText?.trim();

    if (!searchValue || searchValue.length < MIN_SEARCH_LENGTH) {
      setRemoteProjects([]);
      setRemoteScopeConfigs([]);
      setLoading(false);
      return;
    }

    if (!jwt || !userProfile) return;

    const searchId = ++searchCounterRef.current;
    setLoading(true);

    const timeoutId = setTimeout(async () => {
      const filterByOriginKey = typeFilter
        ? ORIGIN_KEY_BY_TYPE[typeFilter]
        : null;
      const [projects, configs] = await Promise.all([
        fetchMasterProjects({
          jwt,
          userProfile,
          searchValue,
          filterByOriginKey,
        }).catch((e) => {
          console.error("[useDashboardRemoteSearch] masterProjects error", e);
          return [];
        }),
        searchScopeConfigurations({ searchValue }).catch((e) => {
          console.error("[useDashboardRemoteSearch] scopeConfigs error", e);
          return [];
        }),
      ]);

      if (searchId !== searchCounterRef.current) return; // stale

      setRemoteProjects(projects ?? []);
      setRemoteScopeConfigs(configs ?? []);
      setLoading(false);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [searchText, typeFilter, jwt, userProfile]);

  return { remoteProjects, remoteScopeConfigs, loading };
}
