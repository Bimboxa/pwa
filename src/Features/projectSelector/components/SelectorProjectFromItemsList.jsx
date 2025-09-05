import { useNavigate } from "react-router-dom";

import useProjects from "Features/projects/hooks/useProjects";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ItemsListVariantSimple from "Features/itemsList/components/ItemsListVariantSimple";

export default function SelectorProjectFromItemsList({
  onClick,
  onCreateClick,
}) {
  const navigate = useNavigate();

  // data

  const { value: projects } = useProjects();

  // helpers

  const items = projects?.map((p) => ({ ...p, primaryText: p.name }));

  // handlers

  function handleClick(project) {
    console.log("click", project);
    //navigate("/dashboard");
    if (onClick) {
      onClick(project);
    }
  }

  function handleCreateProject() {
    if (onCreateClick) {
      onCreateClick();
    }
  }

  return (
    <BoxFlexVStretch>
      <ItemsListVariantSimple
        items={items}
        onClick={handleClick}
        searchKeys={["name"]}
        onCreateClick={handleCreateProject}
      />
    </BoxFlexVStretch>
  );
}
