import Dexie from "dexie";

const db = new Dexie("appDB");

db.version(1).stores({
  projects: "id,name",
  scopes: "id,projectId",
  listings: "id,name",
  relsScopeItem: "id,[scopeId+itemTable],scopeId,itemTable,itemId",
  entities: "id,listingId",
  files: "id,listingId,entityId",
});

export default db;
