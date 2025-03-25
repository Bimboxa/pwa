import Dexie from "dexie";

const db = new Dexie("appDB");

db.version(1).stores({
  listings: "id,name",
  entities: "id,listingId",
  files: "id,listingId,entityId",
});

export default db;
