import {useSelector} from "react-redux";

import useProjects from "Features/projects/hooks/useProjects";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import ItemsList from "Features/itemsList/components/ItemsList";
import SectionCreateProject from "Features/projects/components/SectionCreateProject";

export default function PanelSelectProject({containerEl, onClose, onSelect}) {
  // data

  const {value: projects} = useProjects();
  const appConfig = useAppConfig();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  // helpers

  const createS = appConfig.strings.project.create || "Créer un projet";

  // helpers - selection

  const selection = projectId ? [projectId] : null;

  // helpers - notItems

  const noItemS = appConfig.strings.project.noProject || "Aucun projet";

  // helpers - items

  const items = projects.map((project) => {
    const primaryText = project.name;
    const secondaryText = project.clientRef;
    return {...project, primaryText, secondaryText};
  });

  // handlers

  function handleClick(item, options) {
    let project;
    if (options?.fromCreation) {
      project = item;
    } else {
      project = projects.find((p) => p.id === item.id);
    }

    if (onSelect) onSelect(project);
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
    />
  );
}
