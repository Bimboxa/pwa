import { useDispatch } from "react-redux"; // useSelector n'était pas utilisé dans ton snippet
import { nanoid } from "@reduxjs/toolkit";

import { triggerEntitiesTableUpdate } from "../entitiesSlice";

import useUserEmail from "Features/auth/hooks/useUserEmail";


import db from "App/db/db";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import getEntityPureDataAndFilesDataByKey from "../utils/getEntityPureDataAndFilesDataByKey";

import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

export default function useCreateEntity() {
  const dispatch = useDispatch();

  // data
  const { value: userEmail } = useUserEmail();
  const { value: _listing } = useSelectedListing();

  // helper
  const create = async (data, options) => {
    // options
    const listingOption = options?.listing;
    const updateSyncFile = options?.updateSyncFile;
    const annotation = options?.annotation;

    // data injection from annotation
    if (annotation?.imageFile) {
      data.image = { file: annotation.imageFile };
    }

    // listing
    const listing = listingOption || _listing;

    // table
    const table = listing.table ?? listing?.entityModel.defaultTable;

    // ids
    let entityId = data?.id ?? nanoid();

    // 1. Preparation des données (Pure Data + Files Data)
    const { pureData, filesDataByKey } =
      await getEntityPureDataAndFilesDataByKey(data, {
        entityId,
        projectId: listing.projectId,
        listingId: listing.id,
        listingTable: table,
        createdBy: userEmail,
      });

    console.log("[useCreateEntity] pureData", pureData, filesDataByKey);

    // 2. Store files (Updated Logic)
    if (filesDataByKey) {
      try {
        // MODIFICATION ICI :
        // On récupère toutes les valeurs et on utilise .flat()
        // Cela permet de gérer indifféremment :
        // - un champ simple (ex: 'avatar': { ... })
        // - un champ tableau (ex: 'images': [ {...}, {...} ])
        // Le résultat est un tableau unique contenant tous les objets fichiers à sauvegarder.
        const allFilesToStore = Object.values(filesDataByKey).flat();

        await Promise.all(
          allFilesToStore.map(async (fileData) => {
            // Sauvegarde DB locale
            await db.files.put(fileData);

            // Gestion Sync
            if (updateSyncFile) {
              await updateItemSyncFile({
                item: fileData,
                type: "FILE",
                updatedAt: fileData.updatedAt,
                // syncAt: options.syncAt,
              });
            }
          })
        );
      } catch (e) {
        console.log("[useCreateEntity] error storing files", e);
        // Optionnel : Tu pourrais vouloir throw l'erreur ici pour arrêter la création de l'entité
        // si les fichiers échouent.
      }
    }

    // 3. Store entity
    const entity = {
      id: entityId,
      createdBy: userEmail,
      listingId: listing.id,
      ...pureData,
    };

    try {
      console.log("[db] adding entity ...", entity);
      await db[table].add(entity);

      // Handle Annotation linkage
      if (annotation) {
        await create({
          ...annotation,
          entityId: entity.id,
          listingId: listing.id,
          listingTable: listing.table,
        });
      }

      // Handle Sync for Entity
      if (updateSyncFile) {
        await updateItemSyncFile({
          item: entity,
          type: "ENTITY",
          updatedAt: entity.updatedAt ?? entity.createdAt,
          // syncAt: options.syncAt,
        });
      }

      // Update UI
      dispatch(triggerEntitiesTableUpdate(table));

      return entity;

    } catch (e) {
      console.log("[db] error adding entity", e);
      // C'est mieux de retourner undefined ou throw l'erreur en cas d'échec
    }
  };

  return create;
}