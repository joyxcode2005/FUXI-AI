// Background service worker for automatic tab grouping

let aiSession = null;
let aiStatus = "initializing";
let isProcessing = false;



// -------------------- AI Initialization --------------------
async function initializeAI() {
  try {
    console.log("Initializing AI...");
    if (typeof LanguageModel !== "undefined") {
      const availability = await LanguageModel.availability();
      if (availability === "available") {
        aiSession = await LanguageModel.create({ systemPrompt });
        aiStatus = "ready";
        console.log("✅ AI ready");

        startTabMonitoring();
        setTimeout(() => organizeExistingTabs(), 2000); // organize existing tabs
      } else {
        aiStatus = "unavailable";
        console.log("❌ AI unavailable");
      }
    } else {
      aiStatus = "unavailable";
      console.log("❌ LanguageModel API not found");
    }
  } catch (err) {
    aiStatus = "error";
    console.error("AI initialization error:", err);
  }
}

// -------------------- Tab Utilities --------------------
async function getUngroupedTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs
    .filter((tab) => {
      const url = tab.url || "";
      const isValidUrl =
        !url.startsWith("chrome://") &&
        !url.startsWith("chrome-extension://") &&
        !url.startsWith("edge://") &&
        !url.startsWith("about:");
      const isUngrouped = tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE;
      const isNormalWindow = tab.windowId !== undefined; // normal windows only
      return isValidUrl && isUngrouped && isNormalWindow;
    })
    .map((tab) => ({ id: tab.id, title: tab.title, url: tab.url }));
}

// -------------------- AI Tab Grouping --------------------
async function askAIToGroupTabs(tabs) {
  if (!aiSession || aiStatus !== "ready") {
    console.log("AI not ready");
    return { valid: false, error: "AI not ready" };
  }

  try {
    const tabsList = tabs
      .map((tab) => `Tab ${tab.id}: "${tab.title}" - ${new URL(tab.url).hostname}`)
      .join("\n");

    const prompt = `Analyze ${tabs.length} tabs and group them logically.
Tabs: ${tabsList}
Respond with ONLY JSON: {"groups": {"Name": [ids]}, "explanation": "text"}
All IDs: ${tabs.map((t) => t.id).join(", ")}`;

    const response = await aiSession.prompt(prompt);
    return parseAIResponse(response, tabs);
  } catch (err) {
    console.error("AI grouping error:", err);
    return { valid: false, error: err.message };
  }
}

// Parse AI JSON safely
function parseAIResponse(text, tabs) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");

    console.log("JSON MATCH: " , jsonMatch)

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.groups || typeof parsed.groups !== "object")
      throw new Error("Invalid groups structure");

    console.log("PARSED GROUPS: ", parsed);

    const allTabIds = new Set(tabs.map((t) => t.id));
    const usedIds = new Set();

    console.log("ALL TAB IDS: ", allTabIds);
    console.log("PARSED GROUP ENTRIES: ", Object.entries(parsed.groups));

    for (const [groupName, ids] of Object.entries(parsed.groups)) {
      console.log(`Validating group: ${groupName} with IDs: `, ids);
      if (!Array.isArray(ids)) throw new Error(`Invalid IDs for ${groupName}`);
      ids.forEach((id) => {
        // if (!allTabIds.has(id)) throw new Error(`Unknown tab ID: ${id}`);
        if (usedIds.has(id)) throw new Error(`Duplicate tab ID: ${id}`);
        usedIds.add(id);
      });
    }

    return {
      valid: true,
      groups: parsed.groups,
      explanation: parsed.explanation || "Tabs organized",
    };
  } catch (err) {
    console.error("Parse error:", err);
    return { valid: false, error: err.message };
  }
}

// -------------------- Create Tab Groups --------------------
async function createMultipleGroups(groupedTabs) {
  const colors = ["blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];
  let groupsCreated = 0;
  const groupNames = [];

  for (const [groupName, tabIds] of Object.entries(groupedTabs)) {
    if (!tabIds || tabIds.length === 0) continue;

    try {
      // Filter valid, ungrouped tabs in normal windows
      const validTabIds = [];
      for (const tabId of tabIds) {
        try {
          const tab = await chrome.tabs.get(tabId);
          const win = await chrome.windows.get(tab.windowId);
          if (
            tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE &&
            win.type === "normal"
          ) {
            validTabIds.push(tabId);
          }
        } catch (e) {
          console.log(`Tab ${tabId} is invalid or closed`);
        }
      }

      if (validTabIds.length === 0) continue;

      const groupId = await chrome.tabs.group({ tabIds: validTabIds });
      await chrome.tabGroups.update(groupId, {
        title: groupName,
        color: colors[groupsCreated % colors.length],
      });

      groupsCreated++;
      groupNames.push(groupName);
      console.log(`✅ Created group: ${groupName} (${validTabIds.length} tabs)`);
    } catch (err) {
      console.error(`Error creating group ${groupName}:`, err);
    }
  }

  return {
    success: groupsCreated > 0,
    groupsCreated,
    groups: groupNames,
  };
}

// -------------------- Organize Tabs --------------------
async function organizeExistingTabs() {
  if (isProcessing || aiStatus !== "ready") return;
  isProcessing = true;

  console.log("🔄 Checking for ungrouped tabs...");

  try {
    const ungroupedTabs = await getUngroupedTabs();

    if (ungroupedTabs.length === 0) {
      console.log("✓ No ungrouped tabs found");
      return;
    }

    console.log(`Found ${ungroupedTabs.length} ungrouped tabs`);
    const aiResult = await askAIToGroupTabs(ungroupedTabs);

    if (aiResult.valid) {
      console.log("AI grouping suggestion:", aiResult.explanation);
      const result = await createMultipleGroups(aiResult.groups);
      if (result.success) {
        console.log(`✅ Auto-organized ${result.groupsCreated} groups`);
      }
    }
  } catch (err) {
    console.error("Auto-organize error:", err);
  } finally {
    isProcessing = false;
  }
}

// -------------------- Monitor Tabs --------------------
let monitorInterval = null;
function startTabMonitoring() {
  if (monitorInterval) clearInterval(monitorInterval);

  monitorInterval = setInterval(() => {
    organizeExistingTabs();
  }, 5000);

  console.log("📊 Tab monitoring started (every 5 seconds)");
}

// -------------------- Handle New Tabs --------------------
chrome.tabs.onCreated.addListener((tab) => {
  if (aiStatus !== "ready") return;

  setTimeout(async () => {
    try {
      const currentTab = await chrome.tabs.get(tab.id);
      if (
        currentTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE &&
        currentTab.url &&
        !currentTab.url.startsWith("chrome://") &&
        !currentTab.url.startsWith("chrome-extension://")
      ) {
        console.log(`🆕 New tab detected: ${currentTab.title}`);
        const ungroupedTabs = await getUngroupedTabs();
        if (ungroupedTabs.length > 0) {
          const aiResult = await askAIToGroupTabs(ungroupedTabs);
          if (aiResult.valid) await createMultipleGroups(aiResult.groups);
          console.log("✅ New tab auto-grouped");
        }
      }
    } catch (err) {
      console.error("Tab creation handler error:", err);
    }
  }, 120000); // 2 min delay
});

// -------------------- Popup / Messaging --------------------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getAIStatus") {
    sendResponse({ status: aiStatus });
    return true;
  }

  if (request.action === "organizeNow") {
    organizeExistingTabs()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// -------------------- Extension Lifecycle --------------------
chrome.runtime.onInstalled.addListener((details) => {
  console.log("Extension installed/updated:", details.reason);
  initializeAI();
});

chrome.runtime.onStartup.addListener(() => {
  console.log("Browser started");
  initializeAI();
});

// Initialize immediately
initializeAI();

console.log("🚀 Background service worker loaded");
