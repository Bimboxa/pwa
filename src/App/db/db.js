import Dexie from "dexie";

const db = new Dexie("appDB");

db.version(6).stores({
  orgaData: "key", // {key,data,dataStructure}
  projects: "id,clientRef",
  scopes: "id,projectId",
  listings: "id,name",
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
