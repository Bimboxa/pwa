import { useSelector } from "react-redux";

import useProjects from "Features/projects/hooks/useProjects";

import exampleMasterProjects from "../data/exampleMasterProjects";

export default function useMasterProjects() {
  const examples = exampleMasterProjects;

  const masterById = useSelector((s) => s.masterProjects.itemsMap);
  const master = Object.values(masterById);

  const { value: local } = useProjects();

  return [...examples, ...local, ...master];
}
