import Dexie from "dexie";
import "dexie-export-import";

const db = new Dexie("appDB");

db.version(12).stores({
  orgaData: "key", // {key,data,dataStructure,file}
  projects: "id,clientRef,__importTag",

  projectFiles: "id",

  scopes: "id,projectId", // {id,name,projectId,sortedListings:[{id,table}]}. Table is used to resolve syncConfig
  baseMaps: "id,listingId,projectId",
  baseMapViews: "id,scopeId,baseMapId",
  baseMapTransforms: "id", // {id, description, prompt}
  blueprints: "id,projectId,scopeId,listingId",

  listings: "id,key,uniqueByProject,projectId",
  entities: "id,projectId,listingId,[listingId+createdBy]",

  maps: "id,projectId,listingId,[listingId+createdBy]",

  zonings: "listingId", // {listingId,zonesTree}
  materials: "id,projectId,listingId,[listingId+createdBy]",

  relsZoneEntity: "id,projectId,listingId,zoneId,entityId", // {id,projectId,zoningId,zoneId,listingId,entityId,relListingId,relId}
  entitiesProps:
    "id,[listingKey+targetEntityId],listingKey,targetListingKey,targetEntityId", // entityProps = {id,tarketListingKey,targetEntityId,props}

  legends: "id,listingId",
  markers: "id,mapId,listingId,targetEntityId", // marker = {id,mapId,x,y,listingId,targetEntityId,createdBy,createdAt,updatedAt}

  points: "id,projectId,listingId,baseMapId",

  annotations: "id,projectId,baseMapId,listingId,entityId,annotationTemplateId", // annotation = {id,mapId,listingId,entityId,...}
  annotationTemplates: "id,projectId,listingId,code,label", // annotationTemplate = {id,listingId,label} code = listingKey+MARKER+...

  files: "fileName,projectId,listingId,entityId", // {fileName (=id), srcFileName, projectId, listingId, entityId, fileMime,fileType} fileType: "IMAGE", "VIDEO",...

  relationsEntities: "id,listingId,sourceEntityId,targetEntityId,relationType",
  reports: "id,listingId", // {id,listingId}
  syncFiles: "path,scopeId", // {path,updatedAt,updatedAtRemote,syncAt,syncFileType,scopeId,table,config,pathToItemTemplate} // updatedAt = local updates when one table is updated.// syncFileType: "PROJECT", "SCOPE", "LISTING","ENTITY", "FILE" => related to syncConfig.
});

export default db;
