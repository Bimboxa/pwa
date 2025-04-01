import Dexie from "dexie";

const db = new Dexie("appDB");

db.version(2).stores({
  projects: "id,name",
  scopes: "id,projectId",
  listings: "id,name",
  relsScopeItem:
    "id,[scopeId+itemTable],[itemTable+itemId],scopeId,itemTable,itemId",
  entities: "id,listingId",
  entitiesProps:
    "id,[listingKey+targetEntityId],listingKey,targetListingKey,targetEntityId", // entityProps = {id,tarketListingKey,targetEntityId,props}
  markers: "id,mapId,targetListingId,targetEntityId", // marker = {id,mapId,x,y,targetListingId,targetEntityId}
  files: "id,listingId,entityId",
});

export default db;
