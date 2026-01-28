import db from "App/db/db";

import { useEffect, useState } from "react";

import { useSelector } from "react-redux";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import getListingEntityModelTemplateAsync from "Features/form/services/getListingEntityModelTemplateAsync";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function useEntityFormTemplate(options) {
  // options

  let listing = options?.listing;
  const listingId = options?.listingId;

  // data

  const entityTemplateUpdatedAt = useSelector(
    (s) => s.entities.entityTemplateUpdatedAt
  );
  const { value: _listing } = useSelectedListing({ withEntityModel: true });
  const appConfig = useAppConfig();
  listing = listing || _listing;

  // helpers

  const entityModelsObject = appConfig?.entityModelsObject;

  // state

  const [template, setTemplate] = useState({});

  // effect

  const setTemplateAsync = async () => {
    let _listing = listing;
    if (listingId) _listing = await db.listings.get(listingId);

    const template = await getListingEntityModelTemplateAsync({
      listing: _listing,
      entityModelsObject,
    });
    setTemplate(template);
  };

  useEffect(() => {
    if (listing?.id || listingId) {
      setTemplateAsync();
    }
  }, [listing?.id, listingId, entityTemplateUpdatedAt]);

  return template;
}
