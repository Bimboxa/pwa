import useIsMobile from "Features/layout/hooks/useIsMobile";

import FormVariantGrid from "./FormVariantGrid";
import FormVariantMobile from "./FormVariantMobile";

export default function FormGeneric({
  template,
  item,
  onItemChange,
  forceVariantGrid = false,
}) {
  let isMobile = useIsMobile();
  if (forceVariantGrid) isMobile = false;

  return (
    <>
      {isMobile ? (
        <FormVariantMobile
          template={template}
          item={item}
          onItemChange={onItemChange}
        />
      ) : (
        <FormVariantGrid
          template={template}
          item={item}
          onItemChange={onItemChange}
        />
      )}
    </>
  );
}
