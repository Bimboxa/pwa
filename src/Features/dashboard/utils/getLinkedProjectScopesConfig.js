import normalizeProjectIdMaster from "./normalizeProjectIdMaster";

// Resolves the "linked project scopes" rule of a dashboard project item:
// appConfig.features.masterProjects.linkedProjectScopes lists, per project
// type, the linked project type whose Krtos are shown in a second section of
// the project panel (edx: a CHANTIER also shows the Krtos of its OPPORTUNITE).
// rule = { projectType, linkedProjectType, linkKey, originKey, title,
//          emptyLabel }
// `originKey` = key of the masterProjects origin of `projectType`, used to
// look the project up in the référentiel when its link is not known yet.
// `linkKey` = path of the linked project idMaster on the item (a mapped field
// of the masterProjects origin, e.g. "linkedIdMasters.OPPORTUNITE").
// Returns { rule, linkedIdMaster } (linkedIdMaster normalized, null while the
// item has no known linked project), or null when no rule applies.

function getDeepValue(obj, path) {
  return String(path ?? "")
    .split(".")
    .reduce((acc, part) => acc?.[part], obj);
}

export default function getLinkedProjectScopesConfig(appConfig, item) {
  const rules = appConfig?.features?.masterProjects?.linkedProjectScopes;
  if (!Array.isArray(rules) || !item?.type) return null;

  const rule = rules.find((r) => r?.projectType === item.type && r?.linkKey);
  if (!rule) return null;

  const linkedIdMaster = normalizeProjectIdMaster(
    getDeepValue(item, rule.linkKey)
  );
  return { rule, linkedIdMaster };
}
