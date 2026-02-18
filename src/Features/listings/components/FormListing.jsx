import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useListingFormTemplate from "../hooks/useListingFormTemplate";
import useResolvedPresetListings from "../hooks/useResolvedPresetListings";

import FormGenericV2 from "Features/form/components/FormGenericV2";

export default function FormListing({
  listing,
  relatedListings,
  onChange,
  locatedListingOnly,
  variant = "standard",
}) {
  // data
  const appConfig = useAppConfig();

  const template = useListingFormTemplate(listing, {
    locatedListingOnly,
    relatedListings,
    variant,
  });

  // helpers - related listings : add temp fields.

  const relatedListingsKeys = template?.fields
    ?.filter((field) => field.parentObject === "relatedListings")
    .map((field) => field.key);

  // helper - item

  const item = { ...listing, ...(listing?.relatedListings ?? {}) };

  if (listing?.entityModel) {
    item.entityModel = {
      ...item.entityModel,
      label: listing?.entityModel?.name,
    };
  }

  // handlers

  function handleItemChange(item) {
    const relatedListingsKV = Object.entries(item).filter(([key]) =>
      relatedListingsKeys.includes(key)
    );
    const relatedListings = relatedListingsKV.reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});

    console.log("debug_1011_relatedListings", relatedListings);

    const newListing = {
      ...listing,
      ...item,
      relatedListings,
    };

    relatedListingsKV.forEach(([key]) => {
      delete newListing[key];
    });

    console.log("debug_1011_newListing", newListing);

    onChange(newListing);
  }

  // render
  return (
    <FormGenericV2
      template={template}
      item={item}
      onItemChange={handleItemChange}
      variant="whiteSections"
    />
  );
}
