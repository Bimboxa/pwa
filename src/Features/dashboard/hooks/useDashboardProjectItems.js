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
//   povPreviews,   // shared POV previews from the remote configurations
// }

function getRemoteKey({ idMaster, clientRef, name }) {
  return `remote_${idMaster ?? clientRef ?? name}`;
}

// dedupe by idMaster + sort by fractional sortIndex (plain ASCII comparison,
// same rule as usePovs)
function finalizePovPreviews(item) {
  const seen = new Set();
  item.povPreviews = (item.povPreviews ?? [])
    .filter((p) => {
      const id = String(p?.idMaster ?? "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((a, b) => ((a.sortIndex ?? "") < (b.sortIndex ?? "") ? -1 : 1));
}

export default function useDashboardProjectItems({
  searchText,
  typeFilter,
  remoteProjects,
  remoteScopeConfigs,
}) {
  // data

  const { value: scopes } = useScopes({ withProject: true });
  const projects = useLiveQuery(() => db.projects.toArray(), []);

  const userConfigurations = useSelector(
    (s) => s.remoteScopeConfigurations.userConfigurations
  );
  const projectConfigurations = useSelector(
    (s) => s.remoteScopeConfigurations.projectConfigurations
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
        povPreviews: [],
      };
    });

    const localByIdMaster = {};
    const localByClientRef = {};
    localItems.forEach((item) => {
      if (item.idMaster) localByIdMaster[item.idMaster] = item;
      if (item.clientRef) localByClientRef[item.clientRef] = item;
    });

    const localScopeIds = new Set((scopes ?? []).map((s) => String(s.id)));

    // 2. Merge remote scope configurations (ByUser + ByProject) into items

    const remoteOnlyByKey = {};

    const remoteConfigurations = [
      ...(userConfigurations ?? []),
      ...Object.values(projectConfigurations ?? {}).flat(),
    ];

    remoteConfigurations.forEach((config) => {
      const localItem =
        (config.projectIdMaster &&
          localByIdMaster[String(config.projectIdMaster)]) ||
        (config.idMaster && localByIdMaster[String(config.idMaster)]) ||
        (config.projectClientRef && localByClientRef[config.projectClientRef]);

      const isInstalled = config.scopeId && localScopeIds.has(String(config.scopeId));

      let targetItem = localItem;

      if (!targetItem) {
        // remote-only project derived from the configuration
        const key = getRemoteKey({
          clientRef: config.projectClientRef,
          name: config.projectName,
        });
        targetItem = remoteOnlyByKey[key] = remoteOnlyByKey[key] ?? {
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
          povPreviews: [],
        };
      }

      // POV previews come from the backend even for installed scopes
      if (config.povPreviews?.length) {
        targetItem.povPreviews.push(...config.povPreviews);
      }

      if (!isInstalled) targetItem.remoteConfigs.push(config);
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
      finalizePovPreviews(item);
      item.scopeCount = item.scopes.length + item.remoteConfigs.length;
      item.scopeNames = [
        ...item.scopes.map((s) => s.name),
        ...item.remoteConfigs.map((c) => c.scopeName),
      ]
        .filter(Boolean)
        .join(" ");
    });

    // 3. Type filter (chantier / opportunité) — keep untyped items visible

    let visibleItems = typeFilter
      ? allItems.filter((i) => !i.type || i.type === typeFilter)
      : allItems;

    // 4. Search: filter items + build the "on the cloud" section

    let cloudItems = [];

    if (searchText?.trim()) {
      visibleItems = getFoundItems({
        items: visibleItems,
        searchText,
        searchKeys: ["name", "clientRef", "scopeNames"],
      });

      const knownIdMasters = new Set(
        allItems.map((i) => i.idMaster).filter(Boolean)
      );
      const knownClientRefs = new Set(
        allItems.map((i) => i.clientRef).filter(Boolean)
      );

      // 4.a remote projects from chantiers / opportunités search
      (remoteProjects ?? []).forEach((mp) => {
        const idMaster = mp.idMaster ? String(mp.idMaster) : null;
        if (typeFilter && mp.type && mp.type !== typeFilter) return;
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
          povPreviews: [],
        });
        if (idMaster) knownIdMasters.add(idMaster);
        if (mp.clientRef) knownClientRefs.add(mp.clientRef);
      });

      // 4.b projects derived from scope configurations search (SearchAndFilters)
      const cloudByKey = {};
      cloudItems.forEach((i) => (cloudByKey[i.key] = i));

      (remoteScopeConfigs ?? []).forEach((config) => {
        if (typeFilter && config.projectType && config.projectType !== typeFilter)
          return;
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
          povPreviews: [],
        });
        if (!cloudItems.includes(item)) cloudItems.push(item);
        const alreadyThere = item.remoteConfigs.some(
          (c) => String(c.scopeId) === String(config.scopeId)
        );
        if (!alreadyThere) {
          item.remoteConfigs.push(config);
          item.scopeCount = item.remoteConfigs.length;
          if (config.povPreviews?.length) {
            item.povPreviews.push(...config.povPreviews);
          }
        }
      });

      cloudItems.forEach(finalizePovPreviews);
    }

    return { items: visibleItems ?? [], cloudItems };
  }, [
    scopes,
    projects,
    userConfigurations,
    projectConfigurations,
    masterProjectsMap,
    searchText,
    typeFilter,
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
