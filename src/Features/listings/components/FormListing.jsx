import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useListingFormTemplate from "../hooks/useListingFormTemplate";

import FormGenericV2 from "Features/form/components/FormGenericV2";

export default function FormListing({ listing, onChange }) {
  // data
  const appConfig = useAppConfig();
  const template = useListingFormTemplate(listing);

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
