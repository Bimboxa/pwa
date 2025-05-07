import {useDispatch} from "react-redux";

import {setSelectedScopeId} from "Features/scopes/scopesSlice";
import {setSelectedProjectId} from "Features/projects/projectsSlice";
import {setOpen} from "../scopeSelectorSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useScopes from "Features/scopes/hooks/useScopes";

import ItemsList from "Features/itemsList/components/ItemsList";
import PanelAddProjectAndScope from "./PanelAddProjectAndScope";
import BoxFlexHStretch from "Features/layout/components/BoxFlexHStretch";
import setInitScopeId from "Features/init/services/setInitScopeId";
import setInitProjectId from "Features/init/services/setInitProjectId";

export default function PanelSelectProjectAndScope({containerEl}) {
  const dispatch = useDispatch();
  // data

  const {value: scopes} = useScopes({withProject: true});
  const appConfig = useAppConfig();

  console.log("scopes", scopes);

  // helpers

  let noScopeS = appConfig?.strings?.scope?.noScope ?? "Aucune mission";
  const addProjectAndScopeS =
    appConfig?.strings?.projectAndScope?.add || "Ajouter une mission";

  // helpers

  const items = scopes?.map((scope) => {
    const primaryText = scope.name;
    const ref1 = scope.project?.clientRef;
    const ref2 = scope.clientRef ?? "";
    const fullRef = ref1 ? `${ref1} • ${ref2}` : ref2;
    const secondaryText = `[${fullRef}] ${scope.project?.name}`;

    return {
      ...scope,
      primaryText,
      secondaryText,
    };
  });

  // handlers

  function handleClick(item) {
    const scope = scopes.find((s) => s.id === item.id);
    if (!scope || !scope.project) return;
    //
    const projectId = scope.project.id;
    //
    setInitProjectId(projectId);
    dispatch(setSelectedProjectId(projectId));
    //
    setInitScopeId(scope.id);
    dispatch(setSelectedScopeId(scope.id));
    //
    dispatch(setOpen(false));
  }

  return (
    <BoxFlexHStretch sx={{width: 1}}>
      <ItemsList
        items={items}
        onClick={handleClick}
        searchKeys={["primaryText", "secondaryText"]}
        sortby="primaryText"
        noItemLabel={noScopeS}
        containerEl={containerEl}
        createComponent={({onClose}) => (
          <PanelAddProjectAndScope
            containerEl={containerEl}
            onClose={onClose}
          />
        )}
        createLabel={addProjectAndScopeS}
      />
    </BoxFlexHStretch>
  );
}
