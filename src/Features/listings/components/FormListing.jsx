import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useListingFormTemplate from "../hooks/useListingFormTemplate";
import useResolvedPresetListings from "../hooks/useResolvedPresetListings";

import FormGenericV2 from "Features/form/components/FormGenericV2";

export default function FormListing({ listing, onChange, locatedListingOnly }) {
  // data
  const appConfig = useAppConfig();
  const template = useListingFormTemplate(listing, { locatedListingOnly });

  // helper - item

  const item = { ...listing };

  // handlers

  function handleItemChange(item) {
    const newListing = {
      ...listing,
      ...item,
    };
    onChange(newListing);
  }

  // render
  return (
    <FormGenericV2
      template={template}
      item={item}
      onItemChange={handleItemChange}
    />
  );
}
