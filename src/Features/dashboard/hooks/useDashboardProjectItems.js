import { useMemo } from "react";

import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";
import useScopes from "Features/scopes/hooks/useScopes";
import getFoundItems from "Features/search/getFoundItems";
import parseBackendDate from "Features/date/utils/parseBackendDate";

// Unified project items for the dashboard master list.
// One item per project, local (Dexie) or remote-only (cloud):
// {
//   key,           // `local_<projectId>` | `remote_<idMaster|clientRef>`
//   isLocal,
//   projectId,     // Dexie id (local items only)
//   projectIdClient, // original local project id carried by the remote
//                  // configurations — reused as the Dexie id at install
//   idMaster,      // remote master id (string) when known
//   name, clientRef, type, city,
//   scopes,        // local Dexie scopes
//   remoteConfigs, // remote scope configurations not installed locally
//   scopeCount,
//   lastConfigAt,  // most recent scopeConfiguration createdAt (epoch ms)
//   povPreviews,   // shared POV previews from the remote configurations
// }
//
// Items are sorted: projects with Krtos first, most recent configuration
// first, then by name.

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

    const localByProjectId = {};
    const localByIdMaster = {};
    const localByClientRef = {};
    localItems.forEach((item) => {
      if (item.projectId) localByProjectId[String(item.projectId)] = item;
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
      // projectIdClient (immutable client project id) is the unambiguous match
      // key — it survives re-linking the project to another référentiel entity.
      // idMaster / clientRef only remain as fallbacks for older configs.
      const localItem =
        (config.projectIdClient &&
          localByProjectId[String(config.projectIdClient)]) ||
        (config.projectIdMaster &&
          localByIdMaster[String(config.projectIdMaster)]) ||
        (config.idMaster && localByIdMaster[String(config.idMaster)]) ||
        (config.projectClientRef && localByClientRef[config.projectClientRef]);

      const isInstalled =
        config.scopeId && localScopeIds.has(String(config.scopeId));

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
          projectIdClient: null,
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

      if (!targetItem.isLocal && !targetItem.projectIdClient) {
        targetItem.projectIdClient = config.projectIdClient ?? null;
      }

      // POV previews come from the backend even for installed scopes
      if (config.povPreviews?.length) {
        targetItem.povPreviews.push(...config.povPreviews);
      }

      // most recent configuration date — accumulated before the isInstalled
      // filter so fully-installed projects keep their sort date
      const configAt = parseBackendDate(config.createdAt)?.getTime();
      if (
        configAt &&
        (!targetItem.lastConfigAt || configAt > targetItem.lastConfigAt)
      ) {
        targetItem.lastConfigAt = configAt;
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
          projectIdClient: null,
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
      const cloudByClientRef = {};
      cloudItems.forEach((i) => {
        cloudByKey[i.key] = i;
        if (i.clientRef) cloudByClientRef[i.clientRef] = i;
      });

      (remoteScopeConfigs ?? []).forEach((config) => {
        if (
          typeFilter &&
          config.projectType &&
          config.projectType !== typeFilter
        )
          return;
        let item = null;
        if (
          config.projectClientRef &&
          knownClientRefs.has(config.projectClientRef)
        ) {
          // The clientRef is already listed. When it belongs to a référentiel
          // cloud item (4.a), attach the config to it — it carries the
          // projectIdClient (original local project id) that the install MUST
          // reuse. When it belongs to a local / merged item, skip: its configs
          // come from the ByUser / ByProject redux stores (step 2).
          item = cloudByClientRef[config.projectClientRef];
          if (!item) return;
        } else {
          const key = getRemoteKey({
            clientRef: config.projectClientRef,
            name: config.projectName,
          });
          item = cloudByKey[key] = cloudByKey[key] ?? {
            key,
            isLocal: false,
            projectId: null,
            projectIdClient: null,
            idMaster: null,
            name: config.projectName,
            clientRef: config.projectClientRef,
            type: config.projectType,
            city: null,
            scopes: [],
            remoteConfigs: [],
            scopeCount: 0,
            povPreviews: [],
          };
        }
        if (!cloudItems.includes(item)) cloudItems.push(item);
        if (!item.projectIdClient) {
          item.projectIdClient = config.projectIdClient ?? null;
        }
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

    // 5. Sort: projects with Krtos first, most recent configuration first,
    // then by name for a deterministic order

    const sortedItems = [...(visibleItems ?? [])].sort((a, b) => {
      const aHasKrtos = a.scopeCount > 0;
      const bHasKrtos = b.scopeCount > 0;
      if (aHasKrtos !== bHasKrtos) return aHasKrtos ? -1 : 1;
      const dateDelta = (b.lastConfigAt ?? 0) - (a.lastConfigAt ?? 0);
      if (dateDelta !== 0) return dateDelta;
      return (a.name ?? "").localeCompare(b.name ?? "");
    });

    return { items: sortedItems, cloudItems };
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
