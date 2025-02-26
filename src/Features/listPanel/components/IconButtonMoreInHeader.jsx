import useSelectedList from "../hooks/useSelectedList";

import IconButtonMenuMoreShapes from "Features/shapes/components/IconButtonMenuMoreShapes";

export default function IconButtonMoreInHeader() {
  // data

  const selectedList = useSelectedList();

  // helper

  const type = selectedList?.type ?? "DEFAULT";

  return <>{type === "SHAPES" && <IconButtonMenuMoreShapes />}</>;
}
