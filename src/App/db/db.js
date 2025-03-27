import Dexie from "dexie";

const db = new Dexie("appDB");

db.version(1).stores({
  projects: "id,name",
  scopes: "id,projectId",
  listings: "id,name",
  relsScopeItem:
    "id,[scopeId+itemTable],[itemTable+itemId],scopeId,itemTable,itemId",
  entities: "id,listingId",
  entitiesProps: "id,targetListingKey,targetEntityId", // entityProps = {id,tarketListingKey,targetEntityId,props}
  files: "id,listingId,entityId",
});

export default db;
