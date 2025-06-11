import useIsMobile from "Features/layout/hooks/useIsMobile";

import FormVariantGrid from "./FormVariantGrid";
import FormVariantMobile from "./FormVariantMobile";

export default function FormGeneric({
  template,
  item,
  onItemChange,
  forceVariantGrid = false,
  forceVariantMobile = false,
  focusOnFirstField = true,
}) {
  let isMobile = useIsMobile();
  if (forceVariantGrid) isMobile = false;
  if (forceVariantMobile) isMobile = true;

  return (
    <>
      {isMobile ? (
        <FormVariantMobile
          template={template}
          item={item}
          onItemChange={onItemChange}
          focusOnFirstField={focusOnFirstField}
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
