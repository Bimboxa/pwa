import useZonesTree from "../hooks/useZonesTree";

import {Box} from "@mui/material";

import TreeZones from "./TreeZones";

export default function SectionTreeZonesInListPanel() {
  const {value: zonesTree, loading} = useZonesTree();

  return loading ? <Box /> : <TreeZones items={zonesTree} />;
}
