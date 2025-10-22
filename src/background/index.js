// Background service worker for automatic tab grouping

import { systemPrompt } from "../utils";

let aiSession = null;
let aiStatus = "initializing";
let isProcessing = false;
let monitorInterval = null;

// 🟢 Toggle state (controlled via popup)
let autoGroupingEnabled = true;

// Load saved toggle state at startup
chrome.storage.local.get("autoGroupingEnabled", (data) => {
  autoGroupingEnabled = data.autoGroupingEnabled ?? true;
  console.log("🧠 Auto-grouping setting:", autoGroupingEnabled);
});

// Listen for toggle changes from popup
chrome.storage.onChanged.addListener((changes) => {
  if (changes.autoGroupingEnabled) {
    autoGroupingEnabled = changes.autoGroupingEnabled.newValue;
    console.log("🔄 Auto-grouping toggled:", autoGroupingEnabled);

    if (autoGroupingEnabled) {
      console.log("▶️ Auto-grouping re-enabled");
      initializeAI();
    } else {
      console.log("⏸️ Auto-grouping disabled");
      stopTabMonitoring();
    }
  }
});

// 🧠 Initialize AI session
async function initializeAI() {
  if (!autoGroupingEnabled) {
    console.log("🚫 Skipping AI initialization (auto-grouping disabled)");
    return;
  }

  try {
    console.log("Initializing AI...");
    if (typeof LanguageModel !== "undefined") {
      const availability = await LanguageModel.availability();
      if (availability === "available") {
        aiSession = await LanguageModel.create({
          systemPrompt: systemPrompt,
        });
        aiStatus = "ready";
        console.log("✅ AI ready");

        startTabMonitoring();
        setTimeout(() => organizeExistingTabs(), 2000);
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

// 🪶 Stop monitoring loop
function stopTabMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log("🛑 Tab monitoring stopped");
  }
}

// 🧩 Start monitoring for ungrouped tabs
function startTabMonitoring() {
  if (!autoGroupingEnabled) return;
  if (monitorInterval) clearInterval(monitorInterval);

  monitorInterval = setInterval(() => {
    organizeExistingTabs();
  }, 5000);

  console.log("📊 Tab monitoring started (checking every 5 seconds)");
}

// 🧱 Get all ungrouped tabs
async function getUngroupedTabs() {
  const windows = await chrome.windows.getAll({
    populate: true,
    windowTypes: ["normal"],
  });
  let ungrouped = [];

  for (const window of windows) {
    const windowTabs = window.tabs.filter((tab) => {
      const url = tab.url || "";
      const isValidUrl =
        !url.startsWith("chrome://") &&
        !url.startsWith("chrome-extension://") &&
        !url.startsWith("edge://") &&
        !url.startsWith("about:");
      const isUngrouped = tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE;
      return isValidUrl && isUngrouped;
    });

    ungrouped = ungrouped.concat(
      windowTabs.map((tab) => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        windowId: tab.windowId,
      }))
    );
  }

  console.log("Ungrouped tab IDs:", ungrouped.map((t) => t.id).join(", "));
  return ungrouped;
}

// 📋 Get all existing groups with their tabs
async function getExistingGroups() {
  const groups = await chrome.tabGroups.query({});
  const groupsWithTabs = await Promise.all(
    groups.map(async (g) => {
      const tabs = await chrome.tabs.query({ groupId: g.id });
      return {
        id: g.id,
        title: g.title || "Untitled",
        color: g.color,
        tabIds: tabs.map(t => t.id),
        tabs: tabs.map(t => ({
          id: t.id,
          title: t.title,
          url: t.url
        }))
      };
    })
  );
  return groupsWithTabs;
}

// 🧠 Ask AI to group tabs (considering existing groups)
async function askAIToGroupTabs(tabs, existingGroups = []) {
  if (!aiSession || aiStatus !== "ready") {
    console.log("AI not ready");
    return { valid: false, error: "AI not ready" };
  }

  try {
    const tabsList = tabs
      .map(
        (tab) => `Tab ${tab.id}: "${tab.title}" - ${new URL(tab.url).hostname}`
      )
      .join("\n");

    const allIds = tabs.map((t) => t.id);

    // Prepare existing groups info for AI
    let existingGroupsInfo = "";
    if (existingGroups.length > 0) {
      existingGroupsInfo = "\n\nEXISTING GROUPS:\n" + existingGroups.map(g => {
        const tabInfo = g.tabs.map(t => `  - ${t.title} (${new URL(t.url).hostname})`).join("\n");
        return `"${g.title}" (${g.tabs.length} tabs):\n${tabInfo}`;
      }).join("\n\n");
    }

    const prompt = `Analyze ${tabs.length} NEW ungrouped tabs and decide how to organize them.

${existingGroupsInfo}

CRITICAL RULES:
1. **REUSE EXISTING GROUPS**: If a new tab matches the theme/category of an existing group, add it to that group
2. **CREATE NEW GROUPS**: Only create new groups for tabs that don't fit any existing category
3. You MUST use ONLY these exact tab IDs: ${allIds.join(", ")}
4. Each tab ID must appear in EXACTLY ONE group (no duplicates)
5. ALL tab IDs must be assigned (don't skip any)
6. Use existing group names EXACTLY as shown above when reusing groups
7. DO NOT invent or hallucinate any tab IDs

NEW TABS TO ORGANIZE:
${tabsList}

RESPONSE FORMAT:
{
  "groups": {
    "Existing Group Name": [new_tab_ids_to_add],
    "New Group Name": [tab_ids_for_new_group]
  },
  "explanation": "Brief explanation of which tabs were added to existing groups and which new groups were created"
}

Example response if "Social Media" group exists and new tab is Twitter:
{
  "groups": {
    "Social Media": [${allIds[0]}]
  },
  "explanation": "Added Twitter tab to existing Social Media group"
}

Remember: 
- Match tabs to existing groups based on content similarity (e.g., GitHub → Development, YouTube → Social & Media)
- Only create new groups when no existing group fits
- Use ONLY the IDs provided above!`;

    const response = await aiSession.prompt(prompt);
    console.log("AI Raw Response:", response.substring(0, 500));
    return parseAIResponse(response, tabs, existingGroups);
  } catch (err) {
    console.error("AI grouping error:", err);
    return { valid: false, error: err.message };
  }
}

// 🧩 Parse AI response safely (enhanced to handle existing groups)
function parseAIResponse(text, tabs, existingGroups = []) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in AI response");

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.groups || typeof parsed.groups !== "object") {
      throw new Error("Invalid groups structure");
    }

    const allTabIds = new Set(tabs.map((t) => t.id));
    const usedIds = new Set();
    const validGroups = {};
    const existingGroupMap = new Map(existingGroups.map(g => [g.title.toLowerCase(), g]));

    for (const [groupName, ids] of Object.entries(parsed.groups)) {
      if (!Array.isArray(ids)) continue;

      const validIds = [];
      for (const id of ids) {
        if (allTabIds.has(id) && !usedIds.has(id)) {
          validIds.push(id);
          usedIds.add(id);
        }
      }

      if (validIds.length > 0) {
        validGroups[groupName] = validIds;
      }
    }

    if (Object.keys(validGroups).length === 0) {
      throw new Error("No valid groups could be created");
    }

    // Add unassigned tabs to "Other" group
    if (usedIds.size !== allTabIds.size) {
      const unassignedIds = [...allTabIds].filter((id) => !usedIds.has(id));
      if (unassignedIds.length > 0) {
        validGroups["Other"] = unassignedIds;
      }
    }

    return {
      valid: true,
      groups: validGroups,
      explanation: parsed.explanation || "Tabs organized successfully",
      existingGroupMap // Pass this for later use
    };
  } catch (err) {
    console.error("Parse error:", err);
    return { valid: false, error: err.message };
  }
}

// 🧭 Fallback: domain-based grouping (enhanced with existing group consideration)
function createFallbackGroups(tabs, existingGroups = []) {
  const groups = {};
  const existingGroupMap = new Map();
  
  // Build a map of existing groups by category keywords
  existingGroups.forEach(g => {
    const title = g.title.toLowerCase();
    existingGroupMap.set(title, g.title); // Keep original casing
  });

  tabs.forEach((tab) => {
    try {
      const hostname = new URL(tab.url).hostname;
      const domain = hostname.replace(/^www\./, "");

      let category = "Other";
      
      // Try to match with existing groups first
      let matchedExistingGroup = null;
      
      if (domain.includes("google") || domain.includes("stackoverflow") || domain.includes("github")) {
        matchedExistingGroup = findExistingGroup(existingGroupMap, ["development", "dev", "code", "programming"]);
        category = matchedExistingGroup || "Development";
      } else if (domain.includes("youtube") || domain.includes("twitter") || domain.includes("facebook")) {
        matchedExistingGroup = findExistingGroup(existingGroupMap, ["social", "media", "social media"]);
        category = matchedExistingGroup || "Social & Media";
      } else if (domain.includes("amazon") || domain.includes("ebay") || domain.includes("shop")) {
        matchedExistingGroup = findExistingGroup(existingGroupMap, ["shopping", "shop", "store"]);
        category = matchedExistingGroup || "Shopping";
      } else if (domain.includes("news") || domain.includes("bbc")) {
        matchedExistingGroup = findExistingGroup(existingGroupMap, ["news", "articles"]);
        category = matchedExistingGroup || "News";
      } else if (domain.includes("gmail") || domain.includes("mail")) {
        matchedExistingGroup = findExistingGroup(existingGroupMap, ["email", "mail"]);
        category = matchedExistingGroup || "Email";
      }

      if (!groups[category]) groups[category] = [];
      groups[category].push(tab.id);
    } catch {
      if (!groups["Other"]) groups["Other"] = [];
      groups["Other"].push(tab.id);
    }
  });

  return {
    valid: true,
    groups,
    explanation: "Organized by domain categories (fallback mode), merged with existing groups where possible",
  };
}

// Helper function to find matching existing group
function findExistingGroup(existingGroupMap, keywords) {
  for (const [key, originalTitle] of existingGroupMap.entries()) {
    if (keywords.some(keyword => key.includes(keyword))) {
      return originalTitle;
    }
  }
  return null;
}

// 🧩 Create or update tab groups (enhanced to merge with existing groups)
async function createMultipleGroups(groupedTabs, existingGroups = []) {
  try {
    let groupsCreated = 0;
    let tabsAddedToExisting = 0;
    const colors = [
      "blue",
      "red",
      "yellow",
      "green",
      "pink",
      "purple",
      "cyan",
      "orange",
    ];
    
    // Create a map of existing groups by title (case-insensitive)
    const existingGroupMap = new Map();
    existingGroups.forEach(g => {
      existingGroupMap.set(g.title.toLowerCase(), g);
    });

    for (const [groupName, tabIds] of Object.entries(groupedTabs)) {
      if (tabIds.length === 0) continue;

      const validTabIds = [];
      for (const tabId of tabIds) {
        try {
          const tab = await chrome.tabs.get(tabId);
          const window = await chrome.windows.get(tab.windowId);

          if (
            tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE &&
            window.type === "normal"
          ) {
            validTabIds.push(tabId);
          }
        } catch {
          console.log(`Tab ${tabId} no longer exists`);
        }
      }

      if (validTabIds.length > 0) {
        // Check if this group already exists
        const existingGroup = existingGroupMap.get(groupName.toLowerCase());
        
        if (existingGroup) {
          // Add tabs to existing group
          await chrome.tabs.group({ 
            groupId: existingGroup.id, 
            tabIds: validTabIds 
          });
          tabsAddedToExisting += validTabIds.length;
          console.log(`✅ Added ${validTabIds.length} tab(s) to existing group: ${groupName}`);
        } else {
          // Create new group
          const groupId = await chrome.tabs.group({ tabIds: validTabIds });
          await chrome.tabGroups.update(groupId, {
            title: groupName,
            color: colors[groupsCreated % colors.length],
          });
          groupsCreated++;
          console.log(`✅ Created new group: ${groupName} (${validTabIds.length} tabs)`);
        }
      }
    }

    return { 
      success: (groupsCreated > 0 || tabsAddedToExisting > 0), 
      groupsCreated,
      tabsAddedToExisting 
    };
  } catch (err) {
    console.error("Error in createMultipleGroups:", err);
    return { success: false, error: err.message };
  }
}

// 🧠 Main organization logic (enhanced)
async function organizeExistingTabs(force = false) {
  if (!force && !autoGroupingEnabled) {
    console.log("⏸️ Auto grouping turned off, skipping organization.");
    return;
  }
  if (isProcessing || aiStatus !== "ready") return;

  isProcessing = true;
  console.log("🔄 Checking for ungrouped tabs...");

  try {
    const ungroupedTabs = await getUngroupedTabs();

    if (ungroupedTabs.length > 0) {
      console.log(`Found ${ungroupedTabs.length} ungrouped tabs`);

      // Get existing groups to consider when organizing
      const existingGroups = await getExistingGroups();
      console.log(`Found ${existingGroups.length} existing groups`);

      let aiResult = await askAIToGroupTabs(ungroupedTabs, existingGroups);
      if (!aiResult.valid) {
        console.warn("AI grouping failed, using fallback method");
        aiResult = createFallbackGroups(ungroupedTabs, existingGroups);
      }

      if (aiResult.valid) {
        console.log("Grouping strategy:", aiResult.explanation);
        const result = await createMultipleGroups(aiResult.groups, existingGroups);
        if (result.success) {
          const message = [];
          if (result.groupsCreated > 0) {
            message.push(`Created ${result.groupsCreated} new group(s)`);
          }
          if (result.tabsAddedToExisting > 0) {
            message.push(`Added ${result.tabsAddedToExisting} tab(s) to existing groups`);
          }
          console.log(`✅ ${message.join(", ")}`);
        } else {
          console.error("Failed to organize tabs:", result.error);
        }
      }
    } else {
      console.log("✓ No ungrouped tabs found");
    }
  } catch (err) {
    console.error("Organize error:", err);
  } finally {
    isProcessing = false;
  }
}

// 🆕 On new tab creation (enhanced)
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!autoGroupingEnabled || aiStatus !== "ready") return;

  setTimeout(async () => {
    try {
      const currentTab = await chrome.tabs.get(tab.id);
      const window = await chrome.windows.get(currentTab.windowId);

      if (
        currentTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE &&
        currentTab.url &&
        !currentTab.url.startsWith("chrome://") &&
        !currentTab.url.startsWith("chrome-extension://") &&
        window.type === "normal"
      ) {
        console.log(`🆕 New tab detected: ${currentTab.title}`);

        const ungroupedTabs = await getUngroupedTabs();
        if (ungroupedTabs.length > 0) {
          const existingGroups = await getExistingGroups();
          let aiResult = await askAIToGroupTabs(ungroupedTabs, existingGroups);
          if (!aiResult.valid) {
            aiResult = createFallbackGroups(ungroupedTabs, existingGroups);
          }
          if (aiResult.valid) {
            await createMultipleGroups(aiResult.groups, existingGroups);
            console.log("✅ New tab auto-grouped (merged with existing groups if applicable)");
          }
        }
      }
    } catch (err) {
      console.error("Tab creation handler error:", err);
    }
  }, 10000);
});

// 📨 Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getAIStatus") {
    sendResponse({ status: aiStatus });
    return true;
  }

  if (request.action === "organizeNow") {
    organizeExistingTabs(true)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// 🧩 Extension lifecycle events
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