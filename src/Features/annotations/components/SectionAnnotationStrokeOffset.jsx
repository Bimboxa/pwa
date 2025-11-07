import useUpdateAnnotation from "../hooks/useUpdateAnnotation";

import {
  VerticalAlignBottom as BottomIcon,
  VerticalAlignTop as TopIcon,
  VerticalAlignCenter as CenterIcon,
} from "@mui/icons-material";

import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";

export default function SectionAnnotationStrokeOffset({ annotation }) {
  console.log("annotation strokeOffset", annotation?.strokeOffset);
  // data

  const updateAnnotation = useUpdateAnnotation();

  // helpers

  const options = [
    { key: "BOTTOM", label: "Dessous", icon: <BottomIcon /> },
    { key: "CENTER", label: "Milieu", icon: <CenterIcon /> },
    { key: "TOP", label: "Dessus", icon: <TopIcon /> },
  ];

  let selectedKey = "CENTER";
  if (annotation?.strokeOffset === -1) selectedKey = "BOTTOM";
  if (annotation?.strokeOffset === 1) selectedKey = "TOP";

  async function handleChange(selectedKey) {
    let strokeOffset;
    if (selectedKey === "BOTTOM") strokeOffset = -1;
    if (selectedKey === "TOP") strokeOffset = 1;

    await updateAnnotation({ ...annotation, strokeOffset });
  }

  return (
    <ToggleSingleSelectorGeneric
      options={options}
      selectedKey={selectedKey}
      onChange={handleChange}
    />
  );
}
