import exampleAppConfig from "./data/exampleAppConfig";

const appConfigAsync = new Promise((resolve) => {
  resolve(exampleAppConfig);
});

export default appConfigAsync;
