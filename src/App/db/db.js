import Dexie from "dexie";

const db = new Dexie("appDB");

db.version(1).stores({});

export default db;
