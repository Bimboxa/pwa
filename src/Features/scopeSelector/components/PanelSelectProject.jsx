import {useState} from "react";
import {useSelector} from "react-redux";

import useProjects from "Features/projects/hooks/useProjects";
import useInitFetchRemoteOpenedProjects from "Features/sync/hooks/useInitFetchRemoteOpenedProjects";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useRemoteToken from "Features/sync/hooks/useRemoteToken";
import useRemoteContainer from "Features/sync/hooks/useRemoteContainer";

import ItemsList from "Features/itemsList/components/ItemsList";
import SectionCreateProject from "Features/projects/components/SectionCreateProject";

import mergeItemsArrays from "Features/misc/utils/mergeItemsArrays";
import getRemoteProjectFromOpenedProjectService from "../services/getRemoteProjectFromOpenedProjectService";

export default function PanelSelectProject({containerEl, onClose, onSelect}) {
  // data

  const {value: accessToken} = useRemoteToken();
  const remoteContainer = useRemoteContainer();
  const {value: projects} = useProjects();
  const appConfig = useAppConfig();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const {value: remoteOpenedProjects, loading} =
    useInitFetchRemoteOpenedProjects();

  // helpers

  const allProjects = mergeItemsArrays(
    remoteOpenedProjects?.map((p) => ({...p, isRemote: true})),
    projects,
    "clientRef"
  );

  // state

  const [syncing, setSyncing] = useState(false); // creating remote project if it doesn't exist.

  // helpers

  const createS = appConfig.strings.project.create || "Créer un projet";

  // helpers - selection

  const selection = projectId ? [projectId] : null;

  // helpers - notItems

  const noItemS = appConfig.strings.project.noProject || "Aucun projet";

  // helpers - items

  const items = allProjects.map((project) => {
    const primaryText = project.name;
    const secondaryText = project.clientRef;
    return {...project, primaryText, secondaryText, key: project.clientRef};
  });

  // handlers

  async function handleClick(item, options) {
    console.log("click on", item, options);
    if (syncing) return;

    let project;

    if (item.isRemote && !item.id) {
      setSyncing(true);
      project = await getRemoteProjectFromOpenedProjectService({
        openedProject: item,
        remoteContainer,
        accessToken,
      });
      setSyncing(false);
    } else if (options?.fromCreation) {
      project = item;
    } else {
      project = allProjects.find((p) => p.id === item.id);
    }

    if (onSelect) {
      console.log("[debug] ready to select", project);
      onSelect(project);
    }
  }

  return (
    <ItemsList
      items={items}
      selection={selection}
      onClick={handleClick}
      searchKeys={["primaryText", "secondaryText"]}
      sortBy={"secondaryText"}
      noItemLabel={noItemS}
      createLabel={createS}
      containerEl={containerEl}
      createComponent={({onClose, onCreated}) => (
        <SectionCreateProject onClose={onClose} onCreated={onCreated} />
      )}
      clickOnCreation={true}
      loading={loading || syncing}
    />
  );
}
