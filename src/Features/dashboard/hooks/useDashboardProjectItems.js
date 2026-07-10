import { useMemo } from "react";

import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";
import useScopes from "Features/scopes/hooks/useScopes";
import getFoundItems from "Features/search/getFoundItems";

// Unified project items for the dashboard master list.
// One item per project, local (Dexie) or remote-only (cloud):
// {
//   key,           // `local_<projectId>` | `remote_<idMaster|clientRef>`
//   isLocal,
//   projectId,     // Dexie id (local items only)
//   idMaster,      // remote master id (string) when known
//   name, clientRef, type, city,
//   scopes,        // local Dexie scopes
//   remoteConfigs, // remote scope configurations not installed locally
//   scopeCount,
// }

function getRemoteKey({ idMaster, clientRef, name }) {
  return `remote_${idMaster ?? clientRef ?? name}`;
}

export default function useDashboardProjectItems({
  searchText,
  remoteProjects,
  remoteScopeConfigs,
}) {
  // data

  const { value: scopes } = useScopes({ withProject: true });
  const projects = useLiveQuery(() => db.projects.toArray(), []);

  const userConfigurations = useSelector(
    (s) => s.remoteScopeConfigurations.userConfigurations
  );
  const masterProjectsMap = useSelector((s) => s.masterProjects.itemsMap);

  const selectedProjectKey = useSelector(
    (s) => s.dashboard.selectedProjectKeyInDashboard
  );

  // items

  const { items, cloudItems } = useMemo(() => {
    // 1. Local projects (Dexie), with their scopes

    const scopesByProjectId = (scopes ?? []).reduce((acc, scope) => {
      acc[scope.projectId] = acc[scope.projectId] || [];
      acc[scope.projectId].push(scope);
      return acc;
    }, {});

    const localItems = (projects ?? []).map((project) => {
      const masterProject = project.idMaster
        ? masterProjectsMap?.[project.idMaster]
        : null;
      return {
        key: `local_${project.id}`,
        isLocal: true,
        projectId: project.id,
        idMaster: project.idMaster ? String(project.idMaster) : null,
        name: project.name,
        clientRef: project.clientRef,
        type: project.type ?? masterProject?.type,
        city: masterProject?.address?.city,
        scopes: scopesByProjectId[project.id] ?? [],
        remoteConfigs: [],
      };
    });

    const localByIdMaster = {};
    const localByClientRef = {};
    localItems.forEach((item) => {
      if (item.idMaster) localByIdMaster[item.idMaster] = item;
      if (item.clientRef) localByClientRef[item.clientRef] = item;
    });

    const localScopeIds = new Set((scopes ?? []).map((s) => String(s.id)));

    // 2. Merge user scope configurations (ByUser) into items

    const remoteOnlyByKey = {};

    (userConfigurations ?? []).forEach((config) => {
      const localItem =
        (config.idMaster && localByIdMaster[String(config.idMaster)]) ||
        (config.projectClientRef && localByClientRef[config.projectClientRef]);

      const isInstalled = config.scopeId && localScopeIds.has(String(config.scopeId));

      if (localItem) {
        if (!isInstalled) localItem.remoteConfigs.push(config);
        return;
      }

      // remote-only project derived from the configuration
      const key = getRemoteKey({
        clientRef: config.projectClientRef,
        name: config.projectName,
      });
      const item = (remoteOnlyByKey[key] = remoteOnlyByKey[key] ?? {
        key,
        isLocal: false,
        projectId: null,
        idMaster: null,
        name: config.projectName,
        clientRef: config.projectClientRef,
        type: config.projectType,
        city: null,
        scopes: [],
        remoteConfigs: [],
      });
      if (!isInstalled) item.remoteConfigs.push(config);
    });

    let allItems = [...localItems, ...Object.values(remoteOnlyByKey)];

    // dedupe remote configs by scopeId + compute counts
    allItems.forEach((item) => {
      const seen = new Set();
      item.remoteConfigs = item.remoteConfigs.filter((c) => {
        const id = String(c.scopeId);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      item.scopeCount = item.scopes.length + item.remoteConfigs.length;
      item.scopeNames = [
        ...item.scopes.map((s) => s.name),
        ...item.remoteConfigs.map((c) => c.scopeName),
      ]
        .filter(Boolean)
        .join(" ");
    });

    // 3. Search: filter items + build the "on the cloud" section

    let visibleItems = allItems;
    let cloudItems = [];

    if (searchText?.trim()) {
      visibleItems = getFoundItems({
        items: allItems,
        searchText,
        searchKeys: ["name", "clientRef", "scopeNames"],
      });

      const knownIdMasters = new Set(
        allItems.map((i) => i.idMaster).filter(Boolean)
      );
      const knownClientRefs = new Set(
        allItems.map((i) => i.clientRef).filter(Boolean)
      );

      // 3.a remote projects from chantiers / opportunités search
      (remoteProjects ?? []).forEach((mp) => {
        const idMaster = mp.idMaster ? String(mp.idMaster) : null;
        if (idMaster && knownIdMasters.has(idMaster)) return;
        if (mp.clientRef && knownClientRefs.has(mp.clientRef)) return;
        cloudItems.push({
          key: getRemoteKey({ idMaster, clientRef: mp.clientRef }),
          isLocal: false,
          projectId: null,
          idMaster,
          name: mp.name,
          clientRef: mp.clientRef,
          type: mp.type,
          city: mp.address?.city,
          scopes: [],
          remoteConfigs: [],
          scopeCount: 0,
        });
        if (idMaster) knownIdMasters.add(idMaster);
        if (mp.clientRef) knownClientRefs.add(mp.clientRef);
      });

      // 3.b projects derived from scope configurations search (SearchAndFilters)
      const cloudByKey = {};
      cloudItems.forEach((i) => (cloudByKey[i.key] = i));

      (remoteScopeConfigs ?? []).forEach((config) => {
        if (
          config.projectClientRef &&
          knownClientRefs.has(config.projectClientRef)
        ) {
          return;
        }
        const key = getRemoteKey({
          clientRef: config.projectClientRef,
          name: config.projectName,
        });
        const item = (cloudByKey[key] = cloudByKey[key] ?? {
          key,
          isLocal: false,
          projectId: null,
          idMaster: null,
          name: config.projectName,
          clientRef: config.projectClientRef,
          type: config.projectType,
          city: null,
          scopes: [],
          remoteConfigs: [],
          scopeCount: 0,
        });
        if (!cloudItems.includes(item)) cloudItems.push(item);
        const alreadyThere = item.remoteConfigs.some(
          (c) => String(c.scopeId) === String(config.scopeId)
        );
        if (!alreadyThere) {
          item.remoteConfigs.push(config);
          item.scopeCount = item.remoteConfigs.length;
        }
      });
    }

    return { items: visibleItems ?? [], cloudItems };
  }, [
    scopes,
    projects,
    userConfigurations,
    masterProjectsMap,
    searchText,
    remoteProjects,
    remoteScopeConfigs,
  ]);

  // selected item

  const selectedItem = useMemo(() => {
    if (!selectedProjectKey) return null;
    return (
      items.find((i) => i.key === selectedProjectKey) ??
      cloudItems.find((i) => i.key === selectedProjectKey) ??
      null
    );
  }, [items, cloudItems, selectedProjectKey]);

  return { items, cloudItems, selectedItem, loading: !projects };
}
