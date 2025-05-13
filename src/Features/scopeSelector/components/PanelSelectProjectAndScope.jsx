import {useDispatch, useSelector} from "react-redux";

import {setScope} from "../scopeSelectorSlice";
import {setProject} from "../scopeSelectorSlice";
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
import PanelSelectProjectAndScopeLoadingScreen from "./PanelSelectProjectAndScopeLoadingScreen";

export default function PanelSelectProjectAndScope({containerEl}) {
  const dispatch = useDispatch();
  // data

  const {value: scopes} = useScopes({withProject: true});
  const appConfig = useAppConfig();
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);

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

  // helpers - selection

  const selection = selectedScopeId ? [selectedScopeId] : null;

  // handlers

  function handleClick(item, options) {
    console.log("click on", item);
    dispatch(setScope(item));
    if (item.project) dispatch(setProject(item.project));
    // let scope;
    // if (options?.fromCreation) {
    //   scope = item;
    // } else {
    //   scope = scopes.find((s) => s.id === item.id);
    // }
  }

  function handleLoaded({scope}) {
    console.log("loaded scope", scope);
    if (!scope || !scope.project) return;
    //
    const projectId = scope.project.id;
    //
    setInitProjectId(projectId);
    dispatch(setSelectedProjectId(projectId));
    dispatch(setProject(null));
    //
    setInitScopeId(scope.id);
    dispatch(setSelectedScopeId(scope.id));
    dispatch(setScope(null));
    //
    dispatch(setOpen(false));
  }

  return (
    <BoxFlexHStretch sx={{width: 1, position: "relative"}}>
      <ItemsList
        items={items}
        selection={selection}
        onClick={handleClick}
        searchKeys={["primaryText", "secondaryText"]}
        sortby="primaryText"
        noItemLabel={noScopeS}
        containerEl={containerEl}
        createComponent={({onClose, onCreated}) => (
          <PanelAddProjectAndScope
            containerEl={containerEl}
            onClose={onClose}
            onCreated={onCreated}
          />
        )}
        createLabel={addProjectAndScopeS}
        clickOnCreation={true}
      />

      <PanelSelectProjectAndScopeLoadingScreen
        containerEl={containerEl}
        onLoaded={handleLoaded}
      />
    </BoxFlexHStretch>
  );
}
