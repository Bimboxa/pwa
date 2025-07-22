import exampleMasterProjects from "../data/exampleMasterProjects";

import useProjects from "Features/projects/hooks/useProjects";

export default function useMasterProjects() {
  const examples = exampleMasterProjects;

  const { value: projects } = useProjects();

  return [...examples, ...projects];
}
