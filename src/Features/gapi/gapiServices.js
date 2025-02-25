import store from "App/store";
import {setGapiIsLoaded} from "./gapiSlice";

export const loadGapiPromise = new Promise((resolve, reject) => {
  if (window.gapi?.client) {
    resolve(window.gapi);
  } else {
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = () => {
      resolve(window.gapi);
    };
    script.onerror = reject;
    document.body.appendChild(script);
  }
});

export const gapiPromise = new Promise(async (resolve, reject) => {
  // edge case
  if (window.gapi?.client?.drive) {
    resolve(window.gapi);
    return;
  }
  // main
  try {
    await loadGapiPromise;
    const gapiConfig = await gapiConfigPromise;

    window.gapi.load("client", async () => {
      console.log("[gapiServices] gapi loaded");
      await gapi.client.init({
        apiKey: gapiConfig.apiKey,
        discoveryDocs: gapiConfig.discoveryDocs,
      });
      console.log("[gapiServices] gapi initialized", gapiConfig);
      store.dispatch(setGapiIsLoaded(true));
      resolve(window.gapi);
    });
  } catch (error) {
    reject(error);
  }
});

export const gapiConfigPromise = new Promise((resolve) => {
  const servicesConfig = store.getState().settings.servicesConfig;
  if (servicesConfig.gapiConfig) {
    resolve(servicesConfig.gapiConfig);
  } else {
    const unsubscribe = store.subscribe(() => {
      const servicesConfig = store.getState().settings.servicesConfig;
      const gapiConfig = servicesConfig?.gapiConfig;
      if (gapiConfig) {
        resolve(gapiConfig);
        unsubscribe();
      }
    });
  }
});

export const gsiPromise = new Promise((resolve, reject) => {
  if (window.google) {
    resolve(window.google);
  } else {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      try {
        resolve(window.google);
      } catch (error) {
        reject(error);
      }
    };
    script.onerror = reject;
    document.body.appendChild(script);
  }
});
