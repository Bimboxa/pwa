import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useScopeFavorites from "Features/scopeFavorites/hooks/useScopeFavorites";
import useGetProjectScopeConfigurations from "Features/remoteScopeConfigurations/hooks/useGetProjectScopeConfigurations";
import useFetchMasterProjects from "Features/masterProjects/hooks/useFetchMasterProjects";

import db, { withSystemWrite } from "App/db/db";

import getLinkedProjectScopesConfig from "../utils/getLinkedProjectScopesConfig";
import getDashboardScopeRows from "../utils/getDashboardScopeRows";
import normalizeProjectIdMaster from "../utils/normalizeProjectIdMaster";

// Krtos of the project linked to a dashboard project item (edx: the
// opportunité of a chantier), see getLinkedProjectScopesConfig.
//
// The remote configurations are fetched by the linked idMaster and kept in
// local state: the Redux projectConfigurations map is keyed by idMaster
// without the project type, and it feeds the main items of the dashboard.
// The linked project may also be installed locally: its local scopes come
// first, as in the main list.
//
// Link not known yet (project installed locally, its master project not in
// memory): the project is looked up in the référentiel by its number — once
// per project when the panel opens, and on every refresh. The fetch feeds
// the masterProjects store, which resolves the item link; the effect below
// then persists it on the project row.
//
// Returns { rule, rows, loading, refresh, linkedProjectId, linkedProject } —
// rule is null when the item has no linked project (nothing to render).
// linkedProject = { name, clientRef } as known locally or from the configs.

const EMPTY = [];

// project ids whose link was already looked up in the référentiel (session)
const lookedUpProjectIds = new Set();

export default function useLinkedProjectScopes(item) {
  // data

  const appConfig = useAppConfig();
  const jwt = useSelector((s) => s.auth.jwt);
  const userConfigurations = useSelector(
    (s) => s.remoteScopeConfigurations.userConfigurations
  );
  const { isFavorite } = useScopeFavorites();
  const userProfile = useSelector((s) => s.auth.userProfile);
  const getProjectScopeConfigurations = useGetProjectScopeConfigurations();
  const fetchMasterProjects = useFetchMasterProjects();

  const linked = getLinkedProjectScopesConfig(appConfig, item);
  const linkedIdMaster = linked?.linkedIdMaster ?? null;
  // the rule is only exposed once the linked project is known
  const rule = linkedIdMaster ? linked.rule : null;
  const linkedProjectType = rule?.linkedProjectType ?? null;

  // link lookup: only for a référentiel project whose type has a rule
  const lookupClientRef =
    linked && !linkedIdMaster && item?.idMaster && item?.clientRef
      ? String(item.clientRef)
      : null;
  const lookupOriginKey = linked?.rule?.originKey ?? null;
  const lookupProjectId = item?.projectId ?? null;

  // state

  const [loading, setLoading] = useState(false);
  // { idMaster, configurations } — tagged so a stale answer is never shown
  const [fetched, setFetched] = useState(null);

  // data - linked project installed locally, with its scopes

  const local = useLiveQuery(async () => {
    if (!linkedIdMaster) return null;
    const project = await db.projects
      .filter(
        (p) =>
          !p.deletedAt &&
          normalizeProjectIdMaster(p.idMaster) === linkedIdMaster &&
          (!p.type || !linkedProjectType || p.type === linkedProjectType)
      )
      .first();
    if (!project) return null;
    const scopes = (
      await db.scopes.where("projectId").equals(project.id).toArray()
    ).filter((s) => !s.deletedAt);
    return { project, scopes };
  }, [linkedIdMaster, linkedProjectType]);

  // fetch

  const fetchConfigs = useCallback(async () => {
    if (!linkedIdMaster || !jwt) return;
    try {
      setLoading(true);
      const configurations = await getProjectScopeConfigurations({
        idMaster: linkedIdMaster,
      });
      setFetched({
        idMaster: linkedIdMaster,
        configurations: configurations ?? [],
      });
    } catch (error) {
      console.error("[dashboard] fetch linked project scopes error", error);
    } finally {
      setLoading(false);
    }
  }, [linkedIdMaster, jwt]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  // fetch - link lookup in the référentiel

  const lookingUpRef = useRef(false);

  const lookupLink = useCallback(async () => {
    if (!lookupClientRef || !jwt || !userProfile || lookingUpRef.current)
      return;
    try {
      lookingUpRef.current = true;
      setLoading(true);
      await fetchMasterProjects({
        jwt,
        userProfile,
        searchValue: lookupClientRef,
        ...(lookupOriginKey && { filterByOriginKey: lookupOriginKey }),
      });
    } catch (error) {
      console.error("[dashboard] linked project lookup error", error);
    } finally {
      lookingUpRef.current = false;
      setLoading(false);
    }
  }, [lookupClientRef, lookupOriginKey, jwt, userProfile]);

  useEffect(() => {
    if (!lookupClientRef || !lookupProjectId || !jwt || !userProfile) return;
    if (lookedUpProjectIds.has(lookupProjectId)) return;
    lookedUpProjectIds.add(lookupProjectId);
    lookupLink();
  }, [lookupClientRef, lookupProjectId, jwt, userProfile, lookupLink]);

  // refresh: the linked Krtos, or the link itself while unknown (the Krtos
  // are then fetched by the effect above once the link resolves)

  const refresh = useCallback(async () => {
    if (linkedIdMaster) await fetchConfigs();
    else await lookupLink();
  }, [linkedIdMaster, fetchConfigs, lookupLink]);

  // effect - keep the link on the local project row: the master project is
  // only in memory when the référentiel fetch returned it

  const projectId = item?.isLocal ? item.projectId : null;
  const linkedIdMastersKey = item?.linkedIdMasters
    ? JSON.stringify(item.linkedIdMasters)
    : null;

  useEffect(() => {
    if (!projectId || !linkedIdMastersKey) return;
    (async () => {
      const project = await db.projects.get(projectId);
      if (!project) return;
      if (
        JSON.stringify(project.linkedIdMasters ?? null) === linkedIdMastersKey
      )
        return;
      await withSystemWrite(() =>
        db.projects.update(projectId, {
          linkedIdMasters: JSON.parse(linkedIdMastersKey),
        })
      );
    })();
  }, [projectId, linkedIdMastersKey]);

  // helpers

  const configurations =
    fetched?.idMaster === linkedIdMaster ? fetched.configurations : EMPTY;
  const localScopes = local?.scopes ?? EMPTY;
  const linkedProjectId = local?.project?.id ?? null;

  const rows = useMemo(() => {
    if (!linkedIdMaster) return EMPTY;
    const localScopeIds = new Set(localScopes.map((s) => String(s.id)));
    return getDashboardScopeRows({
      item: {
        idMaster: linkedIdMaster,
        scopes: localScopes,
        remoteConfigs: configurations.filter(
          (c) => !localScopeIds.has(String(c.scopeId))
        ),
      },
      projectConfigurations: { [linkedIdMaster]: configurations },
      userConfigurations,
      isFavorite,
    });
  }, [
    linkedIdMaster,
    localScopes,
    configurations,
    userConfigurations,
    isFavorite,
  ]);

  const linkedProject = {
    name: local?.project?.name ?? configurations[0]?.projectName ?? null,
    clientRef:
      local?.project?.clientRef ?? configurations[0]?.projectClientRef ?? null,
  };

  return {
    rule,
    rows,
    loading,
    refresh,
    linkedProjectId,
    linkedProject,
  };
}
