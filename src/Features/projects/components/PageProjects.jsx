import { useNavigate } from "react-router-dom";

import useProjects from "../hooks/useProjects";

import ListItemsGeneric from "Features/layout/components/ListItemsGeneric";

export default function PageProjects() {
  const navigate = useNavigate();

  // data

  const { value: projects, loading } = useProjects();

  // helpers

  const items = projects.map((project) => ({
    id: project.id,
    label: project.name,
  }));

  // handlers

  function handleProjectClick(project) {
    console.log("Project clicked:", project);
    navigate(`/projects/${project.id}`);
  }
  return <ListItemsGeneric items={items} onClick={handleProjectClick} />;
}
