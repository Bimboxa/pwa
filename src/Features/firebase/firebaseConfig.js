import {initializeApp} from "firebase/app";
import {getDatabase, ref, set, onValue, push} from "firebase/database";

import store from "App/store";

let app;
let db;

const dbPromise = new Promise((resolve) => {
  const unsubscribe = store.subscribe(() => {
    const servicesConfig = store.getState().settings.servicesConfig;
    if (servicesConfig) {
      console.log("[ServicesConfig] servicesConfig ready", servicesConfig);
      app = initializeApp(servicesConfig.firebaseConfig);
      db = getDatabase(app);
      resolve(db);
      unsubscribe();
    }
  });
});

export {dbPromise, ref, set, onValue, push};
