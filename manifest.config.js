import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

export default defineManifest({
  manifest_version: 3,
  name: "FUXI AI",
  version: pkg.version,
  icons: {
    48: "public/logo.png",
  },
  permissions: [
    "sidePanel", 
    "contentSettings", 
    "tabs", 
    "scripting", 
    "tabGroups", 
    "storage",
    "activeTab"
  ], 
  host_permissions: ["<all_urls>"],
  action: {
    default_icon: {
      48: "public/logo.png",
    },
    default_popup: "src/popup/index.html",
  },
  background: {
    service_worker: "src/background/index.js",
    type: "module",
  },
  content_scripts: [
    {
      js: ["src/content/extractPageText.js"],
      matches: ["http://*/*", "https://*/*"],
      run_at: "document_idle",
      all_frames: false
    }
  ],
  side_panel: {
    default_path: "src/sidepanel/index.html",
  },
});