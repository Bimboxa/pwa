import { useSelector } from "react-redux";

import useBaseMap from "Features/baseMaps/hooks/useBaseMap";

export default function useMainBaseMap() {
  const id = useSelector((s) => s.mapEditor.selectedMainBaseMapId);

  return useBaseMap({ id });
}
