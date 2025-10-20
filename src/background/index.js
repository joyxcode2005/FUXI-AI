// Background service worker for automatic tab grouping

let aiSession = null;
let aiStatus = "initializing";
let isProcessing = false;

import { systemPrompt,} from "../utils";

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
  // Get all windows first
  const windows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
  
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
  
  console.log("Ungrouped tab IDs:", ungrouped.map(t => t.id).join(", "));
  return ungrouped;
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

    const allIds = tabs.map((t) => t.id);
    
    const prompt = `Analyze ${tabs.length} tabs and group them logically.

CRITICAL RULES:
1. You MUST use ONLY these exact tab IDs: ${allIds.join(", ")}
2. Each tab ID must appear in EXACTLY ONE group (no duplicates)
3. ALL tab IDs must be assigned to a group (don't skip any)
4. Use logical groupings (social media, work, shopping, news, documentation, etc.)
5. DO NOT invent or hallucinate any tab IDs

Tabs to organize:
${tabsList}

Respond with ONLY valid JSON in this exact format:
{"groups": {"Group Name 1": [${allIds[0]}, ${allIds[1]}], "Group Name 2": [${allIds[2]}]}, "explanation": "brief explanation"}

Remember: Use ONLY the IDs provided above!`;

    const response = await aiSession.prompt(prompt);
    console.log("AI Raw Response:", response.substring(0, 500));
    return parseAIResponse(response, tabs);
  } catch (err) {
    console.error("AI grouping error:", err);
    return { valid: false, error: err.message };
  }
}

// Fallback: Simple domain-based grouping
function createFallbackGroups(tabs) {
  const groups = {};
  
  tabs.forEach(tab => {
    try {
      const hostname = new URL(tab.url).hostname;
      const domain = hostname.replace(/^www\./, '');
      
      // Simple categorization
      let category = "Other";
      
      if (domain.includes('google') || domain.includes('stackoverflow') || domain.includes('github')) {
        category = "Development";
      } else if (domain.includes('youtube') || domain.includes('twitter') || domain.includes('facebook') || domain.includes('instagram')) {
        category = "Social & Media";
      } else if (domain.includes('amazon') || domain.includes('ebay') || domain.includes('shop')) {
        category = "Shopping";
      } else if (domain.includes('news') || domain.includes('cnn') || domain.includes('bbc')) {
        category = "News";
      } else if (domain.includes('gmail') || domain.includes('outlook') || domain.includes('mail')) {
        category = "Email";
      }
      
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(tab.id);
    } catch (e) {
      if (!groups["Other"]) {
        groups["Other"] = [];
      }
      groups["Other"].push(tab.id);
    }
  });
  
  return {
    valid: true,
    groups: groups,
    explanation: "Organized by domain categories (fallback mode)"
  };
}
function parseAIResponse(text, tabs) {
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

    // Validate and clean up groups
    for (const [groupName, ids] of Object.entries(parsed.groups)) {
      if (!Array.isArray(ids)) {
        console.warn(`Skipping group "${groupName}": invalid IDs format`);
        continue;
      }
      
      const validIds = [];
      for (const id of ids) {
        if (!allTabIds.has(id)) {
          console.warn(`Skipping unknown tab ID: ${id}`);
          continue;
        }
        if (usedIds.has(id)) {
          console.warn(`Skipping duplicate tab ID: ${id} in group "${groupName}"`);
          continue;
        }
        validIds.push(id);
        usedIds.add(id);
      }
      
      if (validIds.length > 0) {
        validGroups[groupName] = validIds;
      }
    }

    // If no valid groups created, return error
    if (Object.keys(validGroups).length === 0) {
      throw new Error("No valid groups could be created");
    }

    // Check if all tabs are assigned
    if (usedIds.size !== allTabIds.size) {
      console.warn(`Only ${usedIds.size} of ${allTabIds.size} tabs were assigned to groups`);
      
      // Create a "Miscellaneous" group for unassigned tabs
      const unassignedIds = [...allTabIds].filter(id => !usedIds.has(id));
      if (unassignedIds.length > 0) {
        validGroups["Other"] = unassignedIds;
      }
    }

    return {
      valid: true,
      groups: validGroups,
      explanation: parsed.explanation || "Tabs organized successfully",
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
          // Verify tabs still exist, are ungrouped, and in normal windows
          const validTabIds = [];
          for (const tabId of tabIds) {
            try {
              const tab = await chrome.tabs.get(tabId);
              const window = await chrome.windows.get(tab.windowId);
              
              // Only include tabs that are:
              // 1. Still ungrouped
              // 2. In normal windows (not popup, devtools, etc.)
              if (
                tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE &&
                window.type === 'normal'
              ) {
                validTabIds.push(tabId);
              } else {
                console.log(`Skipping tab ${tabId}: ${window.type !== 'normal' ? 'not in normal window' : 'already grouped'}`);
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
      
      // Try AI first
      let aiResult = await askAIToGroupTabs(ungroupedTabs);
      
      // If AI fails, use fallback
      if (!aiResult.valid) {
        console.warn("AI grouping failed, using fallback method");
        aiResult = createFallbackGroups(ungroupedTabs);
      }

      if (aiResult && aiResult.valid) {
        console.log("Grouping strategy:", aiResult.explanation);
        const result = await createMultipleGroups(aiResult.groups);
        if (result.success) {
          console.log(`✅ Auto-organized ${result.groupsCreated} groups`);
        } else {
          console.error("Failed to create groups:", result.error);
        }
      } else {
        console.error("❌ Could not organize tabs");
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

  // Wait 5 seconds before grouping new tab
  setTimeout(async () => {
    try {
      const currentTab = await chrome.tabs.get(tab.id);
      const window = await chrome.windows.get(currentTab.windowId);
      
      // Check if still ungrouped, valid, and in normal window
      if (
        currentTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE &&
        currentTab.url &&
        !currentTab.url.startsWith("chrome://") &&
        !currentTab.url.startsWith("chrome-extension://") &&
        window.type === 'normal'
      ) {
        console.log(`🆕 New tab detected: ${currentTab.title}`);
        
        // Group with other ungrouped tabs
        const ungroupedTabs = await getUngroupedTabs();
        if (ungroupedTabs.length > 0) {
          const aiResult = await askAIToGroupTabs(ungroupedTabs);
          if (!aiResult.valid) {
            aiResult = createFallbackGroups(ungroupedTabs);
          }
          if (aiResult.valid) {
            await createMultipleGroups(aiResult.groups);
            console.log("✅ New tab auto-grouped");
          }
        }
      }
    } catch (err) {
      console.error("Tab creation handler error:", err);
    }
  }, 5000); // 5 seconds
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