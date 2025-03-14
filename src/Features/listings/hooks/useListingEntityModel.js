import {useState, useEffect} from "react";
import getEntityModelAsync from "App/services/getEntityModel";

export default function useListingEntityModel(listing) {
  // state

  const [entityModel, setEntityModel] = useState(null);

  // init

  useEffect(() => {
    getEntityModelAsync(listing?.entityModelKey).then(setEntityModel);
  }, [listing?.id]);

  // return

  return entityModel;
}
