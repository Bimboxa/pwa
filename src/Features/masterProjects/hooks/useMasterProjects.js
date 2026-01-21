import { useSelector } from "react-redux";

import exampleMasterProjects from "../data/exampleMasterProjects";

export default function useMasterProjects(options) {
  const examples = exampleMasterProjects;

  // data

  const masterById = useSelector((s) => s.masterProjects.itemsMap);
  const master = Object.values(masterById);

  //return [...examples, ...master];
  return master;
}
