import { useMemo } from "react";

import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";
import useScopes from "Features/scopes/hooks/useScopes";
import getFoundItems from "Features/search/getFoundItems";
import parseBackendDate from "Features/date/utils/parseBackendDate";
import normalizeProjectIdMaster from "../utils/normalizeProjectIdMaster";

// Unified project items for the dashboard master list.
// One item per project, local (Dexie) or remote-only (cloud):
// {
//   key,           // `local_<projectId>` | `remote_<idMaster|clientRef>`
//   isLocal,
//   projectId,     // Dexie id (local items only)
//   projectIdClient, // original local project id carried by the remote
//                  // configurations — reused as the Dexie id at install
//   idMaster,      // remote master id (normalized string) when known
//   name, clientRef, type, city,
//   scopes,        // local Dexie scopes
//   remoteConfigs, // remote scope configurations not installed locally
//   scopeCount,
//   lastConfigAt,  // most recent scopeConfiguration createdAt (epoch ms)
//   povPreviews,   // shared POV previews from the remote configurations
// }
//
// Configurations are matched to projects by projectIdClient (immutable client
// project id), then by référentiel id (config projectIdMaster vs project
// idMaster, int / string agnostic), then by clientRef.
//
// Items are sorted: projects with Krtos first, most recent configuration
// first, then by name.

function getRemoteKey({ idMaster, clientRef, name }) {
  return `remote_${idMaster ?? clientRef ?? name}`;
}

function createRemoteItem({ key, idMaster, name, clientRef, type, city }) {
  return {
    key,
    isLocal: false,
    projectId: null,
    projectIdClient: null,
    idMaster: idMaster ?? null,
    name,
    clientRef,
    type,
    city: city ?? null,
    scopes: [],
    remoteConfigs: [],
    povPreviews: [],
  };
}

// lookup of items by projectIdClient / idMaster / clientRef — the first
// item registered for a key wins
function createItemsIndex() {
  const byProjectIdClient = {};
  const byIdMaster = {};
  const byClientRef = {};

  function add(item) {
    const projectIdClient = item.isLocal
      ? item.projectId
      : item.projectIdClient;
    if (projectIdClient) {
      byProjectIdClient[String(projectIdClient)] ??= item;
    }
    if (item.idMaster) byIdMaster[item.idMaster] ??= item;
    if (item.clientRef) byClientRef[String(item.clientRef)] ??= item;
  }

  function find({ projectIdClient, idMaster, clientRef }) {
    return (
      (projectIdClient && byProjectIdClient[String(projectIdClient)]) ||
      (idMaster && byIdMaster[idMaster]) ||
      (clientRef && byClientRef[String(clientRef)]) ||
      null
    );
  }

  function findForConfig(config) {
    return find({
      projectIdClient: config.projectIdClient,
      idMaster: normalizeProjectIdMaster(config.projectIdMaster),
      clientRef: config.projectClientRef,
    });
  }

  return { add, find, findForConfig };
}

// attaches a remote configuration to an item: POV previews, sort date and —
// when the scope is not installed — the remote configs list
function attachConfig(item, config, localScopeIds) {
  if (!item.isLocal) {
    if (!item.projectIdClient && config.projectIdClient) {
      item.projectIdClient = config.projectIdClient;
    }
    if (!item.idMaster) {
      item.idMaster = normalizeProjectIdMaster(config.projectIdMaster);
    }
  }

  // POV previews come from the backend even for installed scopes
  if (config.povPreviews?.length) {
    item.povPreviews.push(...config.povPreviews);
  }

  // most recent configuration date — accumulated before the isInstalled
  // filter so fully-installed projects keep their sort date
  const configAt = parseBackendDate(config.createdAt)?.getTime();
  if (configAt && (!item.lastConfigAt || configAt > item.lastConfigAt)) {
    item.lastConfigAt = configAt;
  }

  const isInstalled =
    config.scopeId && localScopeIds.has(String(config.scopeId));
  if (!isInstalled) item.remoteConfigs.push(config);
}

// dedupe remote configs by scopeId (most recent version wins) and POV
// previews by idMaster, then compute the counts
function finalizeItem(item) {
  const configsByScopeId = new Map();
  item.remoteConfigs.forEach((config) => {
    const id = String(config.scopeId);
    const current = configsByScopeId.get(id);
    const isNewer =
      !current ||
      (parseBackendDate(config.createdAt)?.getTime() ?? 0) >
        (parseBackendDate(current.createdAt)?.getTime() ?? 0);
    if (isNewer) configsByScopeId.set(id, config);
  });
  item.remoteConfigs = [...configsByScopeId.values()];

  // POV previews: dedupe by idMaster + sort by fractional sortIndex (plain
  // ASCII comparison, same rule as usePovs)
  const seen = new Set();
  item.povPreviews = (item.povPreviews ?? [])
    .filter((p) => {
      const id = String(p?.idMaster ?? "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((a, b) => ((a.sortIndex ?? "") < (b.sortIndex ?? "") ? -1 : 1));

  item.scopeCount = item.scopes.length + item.remoteConfigs.length;
  item.scopeNames = [
    ...item.scopes.map((s) => s.name),
    ...item.remoteConfigs.map((c) => c.scopeName),
  ]
    .filter(Boolean)
    .join(" ");
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
    const hasSearch = Boolean(searchText?.trim());

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
        idMaster: normalizeProjectIdMaster(project.idMaster),
        name: project.name,
        clientRef: project.clientRef,
        type: project.type ?? masterProject?.type,
        city: masterProject?.address?.city,
        scopes: scopesByProjectId[project.id] ?? [],
        remoteConfigs: [],
        povPreviews: [],
      };
    });

    const mainIndex = createItemsIndex();
    localItems.forEach(mainIndex.add);

    const localScopeIds = new Set((scopes ?? []).map((s) => String(s.id)));

    // 2. Merge the stored remote scope configurations into the main items.
    // ByUser configs of an unknown project create a remote-only item;
    // ByProject configs only enrich an existing item (the fetched project
    // may be a cloud search result, see step 4.c).

    const remoteOnlyByKey = {};
    const pendingCloudConfigs = []; // { config, canCreate }

    (userConfigurations ?? []).forEach((config) => {
      let item = mainIndex.findForConfig(config);
      if (!item) {
        const key = getRemoteKey({
          clientRef: config.projectClientRef,
          name: config.projectName,
        });
        item = remoteOnlyByKey[key] =
          remoteOnlyByKey[key] ??
          createRemoteItem({
            key,
            name: config.projectName,
            clientRef: config.projectClientRef,
            type: config.projectType,
          });
      }
      attachConfig(item, config, localScopeIds);
      mainIndex.add(item);
    });

    Object.values(projectConfigurations ?? {})
      .flat()
      .forEach((config) => {
        const item = mainIndex.findForConfig(config);
        if (item) attachConfig(item, config, localScopeIds);
        else if (hasSearch) pendingCloudConfigs.push({ config });
      });

    // 3. Configurations found by the search (SearchAndFilters): attached to
    // the main item of their project, or kept for the cloud section

    if (hasSearch) {
      (remoteScopeConfigs ?? []).forEach((config) => {
        const item = mainIndex.findForConfig(config);
        if (item) attachConfig(item, config, localScopeIds);
        else pendingCloudConfigs.push({ config, canCreate: true });
      });
    }

    const allItems = [...localItems, ...Object.values(remoteOnlyByKey)];

    // 4. Search: build the "on the cloud" section

    const cloudItems = [];

    if (hasSearch) {
      const cloudIndex = createItemsIndex();

      // 4.a remote projects from the référentiel search (chantiers /
      // opportunités), unless already listed in the main list
      (remoteProjects ?? []).forEach((mp) => {
        if (typeFilter && mp.type && mp.type !== typeFilter) return;
        const idMaster = normalizeProjectIdMaster(mp.idMaster);
        const query = { idMaster, clientRef: mp.clientRef };
        if (mainIndex.find(query) || cloudIndex.find(query)) return;
        const item = createRemoteItem({
          key: getRemoteKey({ idMaster, clientRef: mp.clientRef }),
          idMaster,
          name: mp.name,
          clientRef: mp.clientRef,
          type: mp.type,
          city: mp.address?.city,
        });
        cloudItems.push(item);
        cloudIndex.add(item);
      });

      // 4.b remaining configurations: attached to their cloud project, or a
      // new cloud item derived from the configuration (search results only)
      pendingCloudConfigs.forEach(({ config, canCreate }) => {
        if (
          typeFilter &&
          config.projectType &&
          config.projectType !== typeFilter
        )
          return;
        let item = cloudIndex.findForConfig(config);
        if (!item) {
          if (!canCreate) return;
          item = createRemoteItem({
            key: getRemoteKey({
              clientRef: config.projectClientRef,
              name: config.projectName,
            }),
            name: config.projectName,
            clientRef: config.projectClientRef,
            type: config.projectType,
          });
          cloudItems.push(item);
        }
        attachConfig(item, config, localScopeIds);
        cloudIndex.add(item);
      });

      cloudItems.forEach(finalizeItem);
    }

    allItems.forEach(finalizeItem);

    // 5. Type filter (chantier / opportunité) — keep untyped items visible

    let visibleItems = typeFilter
      ? allItems.filter((i) => !i.type || i.type === typeFilter)
      : allItems;

    // 6. Search filter on the main list

    if (hasSearch) {
      visibleItems = getFoundItems({
        items: visibleItems,
        searchText,
        searchKeys: ["name", "clientRef", "scopeNames"],
      });
    }

    // 7. Sort: projects with Krtos first, most recent configuration first,
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
