// src/background.js
async function ensureOffscreen() {
  const has = await chrome.offscreen.hasDocument();
  if (has) return;

  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["BLOBS", "DOM_PARSER"],
    justification: "Run Gemini Nano AI for tab grouping",
  });

  console.log("✅ Offscreen document created");
}

export async function callAIToGroupTabs(tabs) {
  await ensureOffscreen();

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "AI_GROUP_TABS", tabs }, async (res) => {
      // Clean up once done
      await chrome.offscreen.closeDocument();
      resolve(res);
    });
  });
}
