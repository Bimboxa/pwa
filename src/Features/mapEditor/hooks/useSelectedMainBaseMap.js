import { useSelector } from "react-redux";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";

export default function useSelectedMainBaseMap() {
  const id = useSelector((s) => s.mapEditor.selectedMainBaseMapId);

  const { value: baseMaps } = useBaseMaps();

  const selectedBaseMap = baseMaps?.find((baseMap) => baseMap.id === id);

  return selectedBaseMap;
}
