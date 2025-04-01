import useIsMobile from "Features/layout/hooks/useIsMobile";

import FormVariantGrid from "./FormVariantGrid";
import FormVariantMobile from "./FormVariantMobile";

export default function FormGeneric({
  template,
  item,
  lastItem,
  onItemChange,
  selectorContainerRef,
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
          lastItem={lastItem}
          onItemChange={onItemChange}
        />
      ) : (
        <FormVariantGrid
          template={template}
          item={item}
          lastItem={lastItem}
          onItemChange={onItemChange}
          selectorContainerRef={selectorContainerRef}
        />
      )}
    </>
  );
}
