import {useEffect} from "react";
import {useSelector, useDispatch} from "react-redux";
import {setNewEntity} from "../entitiesSlice";
import useEntities from "./useEntities";
import useEntityFormTemplate from "./useEntityFormTemplate";

export default function useNewEntity() {
  const dispatch = useDispatch();

  // init
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  useEffect(() => {
    dispatch(setNewEntity({}));
  }, [selectedListingId]);

  const newEntity = useSelector((s) => s.entities.newEntity);
  const template = useEntityFormTemplate();

  const {value: entities} = useEntities();

  const autoFields = template?.fields?.filter((field) => {
    return field.options?.increment === "auto";
  });

  const autoNew = {};
  autoFields?.forEach((field) => {
    const fieldKey = field.key;
    const values = entities?.map((entity) => parseInt(entity[fieldKey]));
    const max = values?.length > 0 ? Math.max(...values) : 0;
    const fieldValue = max + 1;
    autoNew[fieldKey] = fieldValue.toString();
  });

  return {
    ...newEntity,
    ...autoNew,
  };
}
