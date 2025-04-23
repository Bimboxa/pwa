import Dexie from "dexie";

const db = new Dexie("appDB");

db.version(4).stores({
  projects: "id,clientRef",
  scopes: "id,projectId",
  listings: "id,name",
  entities: "id,listingId",
  entitiesProps:
    "id,[listingKey+targetEntityId],listingKey,targetListingKey,targetEntityId", // entityProps = {id,tarketListingKey,targetEntityId,props}
  markers: "id,mapId,targetListingId,targetEntityId", // marker = {id,mapId,x,y,targetListingId,targetEntityId}
  files: "id,listingId,entityId",
  relationsEntities:
    "id,sourceListingId,sourceEntityId,targetEntityId,relationType",
  syncFiles: "path", // {path,updatedAt} // updatedAt = local updates when one table is updated.
});

export default db;
