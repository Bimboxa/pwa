import Dexie from "dexie";

const db = new Dexie("appDB");

db.version(7).stores({
  orgaData: "key", // {key,data,dataStructure,file}
  projects: "id,clientRef",
  scopes: "id,projectId", // {id,name,projectId,sortedListings:[{id,table}]}. Table is used to resolve syncConfig
  listings: "id,projectId",
  entities: "id,listingId,[listingId+createdBy]",
  maps: "id,listingId",
  zones: "id,listingId", // {id,listingId,zonesTree}
  relsZoneEntity: "id,zoneId,listingId,entityId", // {id,zoneId,table,listingId,entityId}
  entitiesProps:
    "id,[listingKey+targetEntityId],listingKey,targetListingKey,targetEntityId", // entityProps = {id,tarketListingKey,targetEntityId,props}
  markers: "id,mapId,targetListingId,targetEntityId", // marker = {id,mapId,x,y,targetListingId,targetEntityId}
  files: "fileName,listingId,itemId", // {fileName, listingId, itemId, fileType}
  relationsEntities:
    "id,sourceListingId,sourceEntityId,targetEntityId,relationType",
  reports: "id,listingId", // {id,listingId}
  syncFiles: "path,scopeId", // {path,updatedAt,scopeId} // updatedAt = local updates when one table is updated.
});

export default db;
