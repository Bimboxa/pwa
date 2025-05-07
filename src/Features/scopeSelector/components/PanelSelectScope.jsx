import {useSelector} from "react-redux";

import useScopes from "Features/scopes/hooks/useScopes";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import ItemsList from "Features/itemsList/components/ItemsList";
import SectionCreateScope from "Features/scopes/components/SectionCreateScope";

export default function PanelSelectScope({containerEl, onClose, onSelect}) {
  // data

  const project = useSelector((s) => s.scopeSelector.project);
  const {value: scopes} = useScopes({filterByProjectId: project?.id});
  const appConfig = useAppConfig();

  // helpers

  const createS = appConfig.strings.scope.create || "Créer un lot";

  // helpers - notItems

  const noItemS = appConfig.strings.scope.noScope || "Aucun lot";

  // helpers - items

  const items = scopes?.map((scope) => {
    const primaryText = scope.name;
    const secondaryText = scope.clientRef;
    return {...scope, primaryText, secondaryText};
  });

  // handlers

  function handleClick(item) {
    const scope = scopes.find((p) => p.id === item.id);
    if (onSelect) onSelect(scope);
  }

  return (
    <ItemsList
      items={items}
      onClick={handleClick}
      searchKeys={["primaryText", "secondaryText"]}
      sortBy={"secondaryText"}
      noItemLabel={noItemS}
      createLabel={createS}
      containerEl={containerEl}
      createComponent={({onClose, onCreated}) => (
        <SectionCreateScope
          onClose={onClose}
          onCreated={onCreated}
          projectId={project.id}
        />
      )}
    />
  );
}
