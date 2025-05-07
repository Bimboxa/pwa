import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useScopes from "Features/scopes/hooks/useScopes";

import ItemsList from "Features/itemsList/components/ItemsList";
import PanelAddProjectAndScope from "./PanelAddProjectAndScope";

export default function PanelSelectProjectAndScope({containerEl}) {
  // data

  const {value: scopes} = useScopes({withProject: true});
  const appConfig = useAppConfig();

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

  return (
    <ItemsList
      items={items}
      searchKeys={["primaryText", "secondaryText"]}
      sortby="primaryText"
      noItemLabel={noScopeS}
      containerEl={containerEl}
      createComponent={({onClose}) => (
        <PanelAddProjectAndScope containerEl={containerEl} onClose={onClose} />
      )}
      createLabel={addProjectAndScopeS}
    />
  );
}
