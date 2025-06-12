import {useEffect, useState} from "react";

import {useSelector} from "react-redux";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import getListingEntityModelTemplateAsync from "Features/form/services/getListingEntityModelTemplateAsync";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function useEntityFormTemplate(options) {
  // options

  let listing = options?.listing;

  // data

  const entityTemplateUpdatedAt = useSelector(
    (s) => s.entities.entityTemplateUpdatedAt
  );
  const {value: _listing} = useSelectedListing({withEntityModel: true});
  const appConfig = useAppConfig();
  listing = listing || _listing;

  // helpers
  const entityModelsObject = appConfig?.entityModelsObject;

  // state

  const [template, setTemplate] = useState({});

  // effect

  const setTemplateAsync = async () => {
    const template = await getListingEntityModelTemplateAsync({
      listing,
      entityModelsObject,
    });
    setTemplate(template);
  };

  useEffect(() => {
    if (listing?.id) {
      setTemplateAsync();
    }
  }, [listing?.id, entityTemplateUpdatedAt]);

  return template;
}
