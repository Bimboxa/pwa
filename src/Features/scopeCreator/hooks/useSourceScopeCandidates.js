import { useEffect, useMemo, useState } from "react";

import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import useScopes from "Features/scopes/hooks/useScopes";
import useGetProjectScopeConfigurations from "Features/remoteScopeConfigurations/hooks/useGetProjectScopeConfigurations";
import normalizeProjectIdMaster from "Features/dashboard/utils/normalizeProjectIdMaster";

// Candidates of the « Krto source » section: the scopes of the project
// installed on this device (`isLocal: true`, rows of db.scopes) and the
// remote ones not downloaded yet (`isLocal: false`, from the project's
// scopeConfigurations). A remote scope becomes local as soon as its row
// lands in db.scopes (live query) — same rule as the dashboard.
//
// Each candidate: { scopeId, name, isLocal, fileSize, configurationKey,
// createdAt }. The remote list degrades silently (offline, project without
// backend reference): local scopes only.

export default function useSourceScopeCandidates({ projectId, enabled }) {
  // data

  const jwt = useSelector((s) => s.auth.jwt);
  const { value: localScopes } = useScopes({ filterByProjectId: projectId });
  const project = useLiveQuery(
    () => (projectId ? db.projects.get(projectId) : null),
    [projectId]
  );
  const getProjectScopeConfigurations = useGetProjectScopeConfigurations();

  const idMaster = normalizeProjectIdMaster(project?.idMaster);
  const clientRef = project?.clientRef ? String(project.clientRef) : null;

  // state

  const [remoteConfigurations, setRemoteConfigurations] = useState([]);
  const [loadingRemote, setLoadingRemote] = useState(false);

  // effect — remote scopes of the project

  useEffect(() => {
    if (!enabled || !projectId || !jwt || (!idMaster && !clientRef)) {
      setRemoteConfigurations([]);
      return;
    }
    let cancelled = false;
    setLoadingRemote(true);
    getProjectScopeConfigurations({ idMaster, clientRef, projectId })
      .then((configurations) => {
        if (!cancelled) setRemoteConfigurations(configurations ?? []);
      })
      .catch((error) => {
        console.error("[useSourceScopeCandidates] remote scopes error", error);
        if (!cancelled) setRemoteConfigurations([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRemote(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, projectId, jwt, idMaster, clientRef]);

  // helpers

  const candidates = useMemo(() => {
    const local = (localScopes ?? [])
      .filter((s) => s && !s.deletedAt && s.id)
      .map((s) => ({
        scopeId: s.id,
        name: s.name,
        isLocal: true,
        fileSize: null,
        configurationKey: s.configurationKey ?? s.presetScopeKey ?? null,
        createdAt: s.createdAt ?? null,
      }));
    const localIds = new Set(local.map((c) => String(c.scopeId)));

    const remoteById = {};
    remoteConfigurations.forEach((config) => {
      const scopeId = config?.scopeId ? String(config.scopeId) : null;
      if (!scopeId || localIds.has(scopeId) || remoteById[scopeId]) return;
      remoteById[scopeId] = {
        scopeId,
        name: config.scopeName ?? scopeId,
        isLocal: false,
        fileSize: config.fileSize ?? null,
        configurationKey: null,
        createdAt: config.createdAt ?? null,
      };
    });

    return [...local, ...Object.values(remoteById)];
  }, [localScopes, remoteConfigurations]);

  return {
    candidates,
    loading: localScopes == null,
    loadingRemote,
  };
}
