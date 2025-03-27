import {useState} from "react";

import useEntities from "Features/entities/hooks/useEntities";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import {useLiveQuery} from "dexie-react-hooks";
import db from "App/db/db";

import getPropsLabel from "../utils/getPropsLabel";

export default function useEntitiesWithProps() {
  const [loading, setLoading] = useState(false);
  const [propsByEntityId, setPropsByEntityId] = useState({});

  const {value: listing} = useSelectedListing({withEntityModel: true});
  const targetKeys = listing?.targetKeys ?? [];

  const {value: entities} = useEntities({filterByListingsKeys: targetKeys});

  let entitiesWithProps = entities?.map((entity) => {
    const entityProps = propsByEntityId[entity.id];
    if (!entityProps) return entity;
    return {
      ...entity,
      props: entityProps.props,
      propsLabel: entityProps.propsLabel,
      entityPropsId: entityProps.id,
    };
  });

  useLiveQuery(async () => {
    setLoading(true);
    const props = await db.entitiesProps
      .where("targetListingKey")
      .anyOf(targetKeys)
      .toArray();
    const propsByEntityId = props.reduce((acc, propsItem) => {
      const props = propsItem.props;
      acc[propsItem.targetEntityId] = {
        ...propsItem,
        propsLabel: getPropsLabel(props, listing.entityModel),
      };
      return acc;
    }, {});
    setPropsByEntityId(propsByEntityId);
    setLoading(false);
    //return result;
  }, [entities]);

  return {loading, value: entitiesWithProps};
}
