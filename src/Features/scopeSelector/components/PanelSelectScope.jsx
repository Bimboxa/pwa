import {useSelector} from "react-redux";

import useScopes from "Features/scopes/hooks/useScopes";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useInitFetchRemoteProjectScopes from "Features/sync/hooks/useInitFetchRemoteProjectScopes";

import ItemsList from "Features/itemsList/components/ItemsList";
import SectionCreateScope from "Features/scopes/components/SectionCreateScope";

import mergeItemsArrays from "Features/misc/utils/mergeItemsArrays";

export default function PanelSelectScope({containerEl, onClose, onSelect}) {
  // data

  const project = useSelector((s) => s.scopeSelector.project);
  const {value: scopes} = useScopes({filterByProjectId: project?.id});
  const appConfig = useAppConfig();

  const {value: remoteScopes, loading} = useInitFetchRemoteProjectScopes({
    projectClientRef: project?.clientRef,
  });

  // helpers

  const allScopes = mergeItemsArrays(
    remoteScopes?.map((p) => ({...p, isRemote: true})),
    scopes,
    "id"
  );

  // helpers

  const createS = appConfig.strings.scope.create || "Créer un lot";

  // helpers - notItems

  const noItemS = appConfig.strings.scope.noScope || "Aucun lot";

  // helpers - items

  const items = allScopes?.map((scope) => {
    const primaryText = scope.name;
    const secondaryText = scope.clientRef;
    return {...scope, primaryText, secondaryText};
  });

  // handlers

  function handleClick(item, options) {
    let scope;
    if (options?.fromCreation) {
      scope = item;
    } else {
      console.log("debug - find scopes", item, scopes);
      scope = allScopes.find((p) => p.id === item.id);
    }
    if (onSelect) onSelect(scope);
  }

  return (
    <ItemsList
      loading={loading}
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
      clickOnCreation={true}
    />
  );
}
