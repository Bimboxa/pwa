import { useSelector } from "react-redux";

import useBaseMap from "Features/baseMaps/hooks/useBaseMap";

export default function useSelectedMainBaseMap() {
  const id = useSelector((s) => s.mapEditor.selectedMainBaseMapId);

  return useBaseMap({ id });
}
