import defaultTitleBlockManifest from "../../../../Features/titleBlocks/data/defaultTitleBlockManifest.js";

// Keep DEFAULT so existing public scopes also pick up the public branding.
const titleBlock = {
  ...defaultTitleBlockManifest,
  name: "Cartouche reperage.pro",
  logoSlot: {
    ...defaultTitleBlockManifest.logoSlot,
    footer: {
      ...defaultTitleBlockManifest.logoSlot.footer,
      spans: [{ text: "app.reperage.pro", bold: true }],
    },
  },
};

export default titleBlock;
