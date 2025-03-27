import {nanoid} from "@reduxjs/toolkit";
import db from "App/db/db";

export default function useCreateOrUpdateEntityProps() {
  const createOrUpdate = async ({
    props,
    listingKey,
    targetEntityId,
    targetListingKey,
  }) => {
    // edge case
    if (!listingKey || !targetEntityId || !targetListingKey) {
      console.error("[DB] createOrUpdateEntityProps: missing required params");
      return;
    }

    // main
    console.log("[DB] composed index [listingKey+targetEntityId]", [
      listingKey,
      targetEntityId,
    ]);
    const existingEntityProps = await db.entitiesProps
      .where("[listingKey+targetEntityId]")
      .equals([listingKey, targetEntityId])
      .first();

    if (existingEntityProps) {
      const updatedProps = {
        ...existingEntityProps.props,
        ...props,
      };
      const result = await db.entitiesProps.update(existingEntityProps.id, {
        props: updatedProps,
      });
      console.log("[DB] Updated entityProps", result);
    } else {
      const newEntityProps = {
        id: nanoid(),
        listingKey,
        targetEntityId,
        targetListingKey,
        props,
      };
      const result = await db.entitiesProps.add(newEntityProps);
      console.log("[DB] Created entityProps", result);
    }
  };

  return createOrUpdate;
}
