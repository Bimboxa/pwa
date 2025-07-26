import { useSelector } from "react-redux";
import useBaseMap from "Features/baseMaps/hooks/useBaseMap";

export default function useLoadedMainBaseMap() {
  const id = useSelector((s) => s.mapEditor.loadedMainBaseMapId);

  return useBaseMap({ id });
}
