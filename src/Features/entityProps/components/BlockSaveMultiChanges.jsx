import {useSelector, useDispatch} from "react-redux";

import {setTempPropsObject, setSelection} from "../entityPropsSlice";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useEntitiesWithProps from "../hooks/useEntitiesWithProps";

import useCreateOrUpdateEntityProps from "../hooks/useCreateOrUpdateEntityProps";
import useDeleteEntityProps from "../hooks/useDeleteEntityProps";

import BlockButtonsCancelSave from "Features/layout/components/BlockButtonsCancelSave";

export default function BlockSaveMultiChanges() {
  const dispatch = useDispatch();

  const tempPropsObject = useSelector((s) => s.entityProps.tempPropsObject);

  // data

  const {value: listing} = useSelectedListing({withEntityModel: true});
  const selection = useSelector((s) => s.entityProps.selection);
  const {value: entitiesWithProps} = useEntitiesWithProps();

  // data - func

  const createOrUpdate = useCreateOrUpdateEntityProps();
  const deleteEntityProps = useDeleteEntityProps();

  // helpers

  const selectedEntitiesWithProps = entitiesWithProps?.filter((entity) =>
    selection.includes(entity.id)
  );

  function handleCancel() {
    dispatch(setTempPropsObject(null));
    dispatch(setSelection([]));
  }

  async function handleSave() {
    // edge case: delete
    if (tempPropsObject?.delete) {
      await Promise.all(
        selectedEntitiesWithProps.map(async (entity) => {
          const entityPropsId = entity?.entityPropsId;
          await deleteEntityProps(entityPropsId);
        })
      );
      dispatch(setTempPropsObject(null));
      dispatch(setSelection([]));
      return;
    }

    // main
    const listingKey = listing?.key;
    await Promise.all(
      selectedEntitiesWithProps.map(async (entity) => {
        const targetEntityId = entity?.id;
        const targetListingKey = entity?.listingKey;
        await createOrUpdate({
          listingKey,
          targetEntityId,
          targetListingKey,
          props: tempPropsObject?.props,
        });
      })
    );
    dispatch(setTempPropsObject(null));
  }

  return <BlockButtonsCancelSave onSave={handleSave} onCancel={handleCancel} />;
}
