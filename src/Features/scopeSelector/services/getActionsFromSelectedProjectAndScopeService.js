import db from "App/db/db";

export default async function getActionsFromSelectedProjectAndScope({
  project,
  scope,
}) {
  // init

  const actions = {
    project: {
      SYNC: false,
      CREATE: false,
    },
    scope: {
      SYNC: false,
      CREATE: false,
      COMPARE: false,
    },
    data: {
      DOWNLOAD: false,
      COMPARE: false,
    },
  };

  // edge case

  if (!project || !scope) return actions;

  // main

  const localProject = await db.projects.get(project.clientRef);
  const localScope = await db.scopes.get(scope.id);

  if (project.isNew) {
    actions.project.SYNC = true;
  } else if (!localProject) {
    actions.project.CREATE = true;
  }

  if (scope.isNew) {
    actions.scope.SYNC = true;
  } else if (!localScope) {
    actions.scope.CREATE = true;
  }

  return actions;
}
