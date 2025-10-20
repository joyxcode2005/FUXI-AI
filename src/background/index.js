// Background service worker for automatic tab grouping

let aiSession = null;
let aiStatus = "initializing";
let isProcessing = false;

const systemPrompt = `You are a tab organization assistant. Analyze tabs and group them logically by topic, purpose, or domain.

Rules:
1. Group similar tabs together (e.g., social media, work, shopping, news)
2. Use clear, concise group names
3. Each tab ID must appear in exactly one group
4. Return ONLY valid JSON with this structure:
{
  "groups": {
    "Group Name 1": [tab_id1, tab_id2],
    "Group Name 2": [tab_id3, tab_id4]
  },
  "explanation": "Brief explanation of grouping logic"
}`;

// Initialize AI on extension startup
async function initializeAI() {
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
        // Start monitoring after AI is ready
        startTabMonitoring();
        // Organize existing tabs on startup
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

// Get all ungrouped tabs
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
      return isValidUrl && isUngrouped;
    })
    .map((tab) => ({
      id: tab.id,
      title: tab.title,
      url: tab.url,
    }));
}

// Ask AI to group tabs
async function askAIToGroupTabs(tabs) {
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

// Parse AI response
function parseAIResponse(text, tabs) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.groups || typeof parsed.groups !== "object") {
      throw new Error("Invalid groups structure");
    }

    const allTabIds = new Set(tabs.map((t) => t.id));
    const usedIds = new Set();

    for (const [groupName, ids] of Object.entries(parsed.groups)) {
      if (!Array.isArray(ids)) throw new Error(`Invalid IDs for ${groupName}`);
      ids.forEach((id) => {
        if (!allTabIds.has(id)) throw new Error(`Unknown tab ID: ${id}`);
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

// Create multiple groups
async function createMultipleGroups(groupedTabs) {
  try {
    let groupsCreated = 0;
    const colors = ["blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];
    const groupNames = [];

    for (const [groupName, tabIds] of Object.entries(groupedTabs)) {
      if (tabIds.length > 0) {
        try {
          // Verify tabs still exist and are ungrouped
          const validTabIds = [];
          for (const tabId of tabIds) {
            try {
              const tab = await chrome.tabs.get(tabId);
              if (tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
                validTabIds.push(tabId);
              }
            } catch (e) {
              console.log(`Tab ${tabId} no longer exists`);
            }
          }

          if (validTabIds.length > 0) {
            const groupId = await chrome.tabs.group({ tabIds: validTabIds });
            await chrome.tabGroups.update(groupId, {
              title: groupName,
              color: colors[groupsCreated % colors.length],
            });
            groupsCreated++;
            groupNames.push(groupName);
            console.log(`✅ Created group: ${groupName} (${validTabIds.length} tabs)`);
          }
        } catch (err) {
          console.error(`Error creating group ${groupName}:`, err);
        }
      }
    }

    return {
      success: groupsCreated > 0,
      groupsCreated,
      groups: groupNames,
    };
  } catch (err) {
    console.error("Error in createMultipleGroups:", err);
    return { success: false, error: err.message };
  }
}

// Organize existing ungrouped tabs
async function organizeExistingTabs() {
  if (isProcessing || aiStatus !== "ready") return;

  isProcessing = true;
  console.log("🔄 Checking for ungrouped tabs...");

  try {
    const ungroupedTabs = await getUngroupedTabs();
    
    if (ungroupedTabs.length > 0) {
      console.log(`Found ${ungroupedTabs.length} ungrouped tabs`);
      const aiResult = await askAIToGroupTabs(ungroupedTabs);

      if (aiResult.valid) {
        console.log("AI grouping suggestion:", aiResult.explanation);
        const result = await createMultipleGroups(aiResult.groups);
        if (result.success) {
          console.log(`✅ Auto-organized ${result.groupsCreated} groups`);
        }
      }
    } else {
      console.log("✓ No ungrouped tabs found");
    }
  } catch (err) {
    console.error("Auto-organize error:", err);
  } finally {
    isProcessing = false;
  }
}

// Monitor for new tabs periodically
let monitorInterval = null;

function startTabMonitoring() {
  if (monitorInterval) clearInterval(monitorInterval);
  
  // Check every 5 seconds
  monitorInterval = setInterval(() => {
    organizeExistingTabs();
  }, 5000);

  console.log("📊 Tab monitoring started (checking every 5 seconds)");
}

// Handle new tab creation with delay
chrome.tabs.onCreated.addListener(async (tab) => {
  if (aiStatus !== "ready") return;

  // Wait 2 minutes before grouping new tab
  setTimeout(async () => {
    try {
      const currentTab = await chrome.tabs.get(tab.id);
      
      // Check if still ungrouped and valid
      if (
        currentTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE &&
        currentTab.url &&
        !currentTab.url.startsWith("chrome://") &&
        !currentTab.url.startsWith("chrome-extension://")
      ) {
        console.log(`🆕 New tab detected: ${currentTab.title}`);
        
        // Group with other ungrouped tabs
        const ungroupedTabs = await getUngroupedTabs();
        if (ungroupedTabs.length > 0) {
          const aiResult = await askAIToGroupTabs(ungroupedTabs);
          if (aiResult.valid) {
            await createMultipleGroups(aiResult.groups);
            console.log("✅ New tab auto-grouped");
          }
        }
      }
    } catch (err) {
      console.error("Tab creation handler error:", err);
    }
  }, 120000); // 2 minutes
});

// Listen for messages from popup
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

// Initialize on extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  console.log("Extension installed/updated:", details.reason);
  initializeAI();
});

// Initialize on browser startup
chrome.runtime.onStartup.addListener(() => {
  console.log("Browser started");
  initializeAI();
});

// Initialize immediately
initializeAI();

console.log("🚀 Background service worker loaded");