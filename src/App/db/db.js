import Dexie from "dexie";

const db = new Dexie("appDB");

db.version(7).stores({
  orgaData: "key", // {key,data,dataStructure,file}
  projects: "id,clientRef",
  scopes: "id,projectId", // {id,name,projectId,sortedListings:[{id,table}]}. Table is used to resolve syncConfig
  listings: "id,key,uniqueByProject,projectId",
  entities: "id,listingId,[listingId+createdBy]",
  maps: "id,listingId",
  zones: "id,listingId", // {id,listingId,zonesTree}
  relsZoneEntity: "id,zoneId,listingId,entityId", // {id,zoneId,table,listingId,entityId}
  entitiesProps:
    "id,[listingKey+targetEntityId],listingKey,targetListingKey,targetEntityId", // entityProps = {id,tarketListingKey,targetEntityId,props}
  markers: "id,mapId,targetListingId,targetEntityId", // marker = {id,mapId,x,y,targetListingId,targetEntityId}
  files: "fileName,listingId,itemId", // {fileName, listingId, itemId, fileType} fileType: "IMAGE", "VIDEO",...
  relationsEntities:
    "id,sourceListingId,sourceEntityId,targetEntityId,relationType",
  reports: "id,listingId", // {id,listingId}
  syncFiles: "path,scopeId", // {path,updatedAt,updatedAtRemote,syncAt,syncFileType,scopeId,table,config,pathToItemTemplate} // updatedAt = local updates when one table is updated.// syncFileType: "PROJECT", "SCOPE", "LISTING","ENTITY", "FILE" => related to syncConfig.
});

export default db;
