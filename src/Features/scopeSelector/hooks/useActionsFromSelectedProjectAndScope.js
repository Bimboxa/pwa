import {useState, useEffect} from "react";

import getActionsFromSelectedProjectAndScope from "../services/getActionsFromSelectedProjectAndScopeService";

export default function useActionsFromSelectedProjectAndScope({
  scope,
  project,
}) {
  // state

  const [actions, setActions] = useState(null);

  // handlers

  async function getActions() {
    const actions = await getActionsFromSelectedProjectAndScope({
      project,
      scope,
    });
    setActions(actions);
  }
  // effect

  useEffect(() => {
    console.log("effect useActions");
    getActions();
  }, [project?.id, scope?.id]);

  return actions;
}
