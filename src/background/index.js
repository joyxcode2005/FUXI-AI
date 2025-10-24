// src/background/index.js
import Fuse from "fuse.js";
import { systemPrompt } from "../utils";

// -------------------- Existing AI & grouping variables --------------------
let aiSession = null;
let aiStatus = "initializing";
let isProcessing = false;
let monitorInterval = null;

// 🟢 Toggle state (controlled via popup)
let autoGroupingEnabled = true;

// -------------------- Fuse.js index --------------------
let fuse = null;
let indexDocs = []; // { id, title, url, windowId, groupId, snippet, updatedAt }

// Optimized fuse options for better search results
const FUSE_OPTIONS = {
  keys: [
    { name: "title", weight: 0.40 },
    { name: "snippet", weight: 0.45 },
    { name: "url", weight: 0.15 },
  ],
  threshold: 0.35, // More strict for better precision
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 2,
  useExtendedSearch: false,
  distance: 150,
  shouldSort: true,
};

// -------------------- Snippet persistence --------------------
const SNIPPETS_STORAGE_KEY = "_tabSnippets_v1";

async function loadPersistedSnippets() {
  try {
    const data = await chrome.storage.local.get(SNIPPETS_STORAGE_KEY);
    return data[SNIPPETS_STORAGE_KEY] || {};
  } catch (err) {
    console.error("loadPersistedSnippets error:", err);
    return {};
  }
}

async function savePersistedSnippetsMap(map) {
  try {
    await chrome.storage.local.set({ [SNIPPETS_STORAGE_KEY]: map });
  } catch (err) {
    console.error("savePersistedSnippetsMap error:", err);
  }
}

async function savePersistedSnippet(key, value) {
  try {
    const map = await loadPersistedSnippets();
    map[key] = value;
    await savePersistedSnippetsMap(map);
  } catch (err) {
    console.error("savePersistedSnippet error:", err);
  }
}

// -------------------- Load toggle state --------------------
chrome.storage.local.get("autoGroupingEnabled", (data) => {
  autoGroupingEnabled = data.autoGroupingEnabled ?? true;
  console.log("🧠 Auto-grouping setting:", autoGroupingEnabled);
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.autoGroupingEnabled) {
    autoGroupingEnabled = changes.autoGroupingEnabled.newValue;
    console.log("🔄 Auto-grouping toggled:", autoGroupingEnabled);

    if (autoGroupingEnabled) {
      console.log("▶️ Auto-grouping re-enabled");
      initializeAI();
    } else {
      console.log("⸏ Auto-grouping disabled");
      stopTabMonitoring();
    }
  }
});

// -------------------- Fuse index builder --------------------
async function buildFuseIndex() {
  try {
    const windows = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
    const docs = [];
    const persisted = await loadPersistedSnippets();

    for (const w of windows) {
      for (const t of w.tabs) {
        const url = t.url || "";
        if (
          !url.startsWith("chrome://") &&
          !url.startsWith("chrome-extension://") &&
          !url.startsWith("edge://") &&
          !url.startsWith("about:")
        ) {
          // Use both tabId and URL as keys
          const keyByTab = String(t.id);
          const keyByUrl = t.url;
          const persistedItem = persisted[keyByTab] || persisted[keyByUrl] || null;

          docs.push({
            id: t.id,
            title: t.title || "",
            url: t.url || "",
            windowId: t.windowId,
            groupId: t.groupId ?? null,
            snippet: persistedItem?.snippet || "",
            updatedAt: persistedItem?.updatedAt || null,
          });
        }
      }
    }

    indexDocs = docs;
    fuse = new Fuse(indexDocs, FUSE_OPTIONS);

    console.log(`🔎 Fuse index rebuilt: ${indexDocs.length} tabs (${docs.filter(d => d.snippet).length} with content)`);
    return true;
  } catch (err) {
    console.error("Error building Fuse index:", err);
    return false;
  }
}

async function ensureIndex() {
  if (!fuse) await buildFuseIndex();
}

/** Update snippet for tabId and persist */
async function updateSnippetForTab(tabId, snippetText, tabUrl = null, title = null) {
  const s = snippetText ? String(snippetText).slice(0, 4000) : "";

  // Update in-memory index
  const docIndex = indexDocs.findIndex(d => String(d.id) === String(tabId));
  if (docIndex !== -1) {
    const doc = indexDocs[docIndex];
    doc.snippet = s;
    if (title) doc.title = title;
    if (tabUrl) doc.url = tabUrl;
    doc.updatedAt = Date.now();
  } else {
    // Add new entry if tab not in index
    indexDocs.push({
      id: tabId,
      title: title || "",
      url: tabUrl || "",
      windowId: null,
      groupId: null,
      snippet: s,
      updatedAt: Date.now(),
    });
  }

  // Persist to storage
  try {
    const persistData = {
      snippet: s,
      title: title || "",
      url: tabUrl || "",
      updatedAt: Date.now()
    };

    if (tabId) {
      await savePersistedSnippet(String(tabId), persistData);
    }
    if (tabUrl) {
      await savePersistedSnippet(tabUrl, persistData);
    }
  } catch (e) {
    console.error("persist snippet error", e);
  }

  // Rebuild fuse index with updated data
  fuse = new Fuse(indexDocs, FUSE_OPTIONS);
  console.log(`✅ Updated content for tab ${tabId} (${s.length} chars)`);
}

// -------------------- AI initialization --------------------
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
        // Rebuild index when AI is ready
        await buildFuseIndex();
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

// -------------------- Tab monitoring --------------------
function stopTabMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log("🛑 Tab monitoring stopped");
  }
}

function startTabMonitoring() {
  if (!autoGroupingEnabled) return;
  if (monitorInterval) clearInterval(monitorInterval);

  monitorInterval = setInterval(() => {
    organizeExistingTabs();
  }, 5000);

  console.log("📊 Tab monitoring started (checking every 5 seconds)");
}

// -------------------- Your original grouping code --------------------
// getUngroupedTabs
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

  return ungrouped;
}

// getExistingGroups
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

/**
 * askAIToGroupTabs
 * - Merges the two versions you provided.
 * - Builds a clear prompt including existing groups and userRequest.
 * - Sends prompt to aiSession, parses result via parseAIResponse, then validates/fixes assignments.
 *
 * Returns an object:
 * {
 *   valid: boolean,
 *   error?: string,
 *   raw: <parsed AI response object | null>,
 *   groups: { "<Group Name>": [ids], ... }, // final, validated grouping
 *   existingGroupAdds: { "<Existing Group Name>": [newly_added_ids], ... },
 *   newGroups: { "<New Group Name>": [ids], ... },
 *   fixes: { duplicates: [...], missing: [...], actions: "..." },
 *   explanation: "text"
 * }
 */
const askAIToGroupTabs = async (tabs = [], existingGroups = [], userRequest = "") => {
  try {
    // Basic readiness checks (keeps both styles from your originals)
    if (!aiSession) {
      return { valid: false, error: "AI session not available" };
    }
    if (typeof aiStatus !== "undefined" && aiStatus !== "ready") {
      return { valid: false, error: `AI not ready (status: ${aiStatus})` };
    }

    // Prepare tab list and ids
    const tabsList = tabs
      .map(
        (tab) => `Tab ${tab.id}: "${tab.title.replace(/\n/g, " ")}" - ${new URL(tab.url).hostname}`
      )
      .join("\n");
    const allIds = tabs.map((t) => t.id);

    // Format existing groups info for the prompt
    let existingGroupsInfo = "";
    const existingGroupNames = [];
    if (Array.isArray(existingGroups) && existingGroups.length > 0) {
      existingGroupsInfo =
        "EXISTING GROUPS:\n" +
        existingGroups
          .map((g) => {
            existingGroupNames.push(g.title);
            const tabInfo = (g.tabs || [])
              .map((t) => {
                const hostname = t.url ? new URL(t.url).hostname : "unknown";
                return `  - ${t.title.replace(/\n/g, " ")} (${hostname}) [id:${t.id}]`;
              })
              .join("\n");
            return `"${g.title}" (${(g.tabs || []).length} tabs):\n${tabInfo}`;
          })
          .join("\n\n");
    }

    // Build the prompt combining constraints from both of your versions
    const prompt = [
      `You are a Chrome Tab Manager AI. Analyze and organize the following NEW ungrouped tabs.`,
      ``,
      `CONSTRAINTS (must follow):`,
      `- Respond ONLY with valid JSON parsable to { "groups": { "<Name>": [ids] }, "explanation": "text" }. No extra top-level keys required by the AI but the caller will validate and augment.`,
      `- Use ONLY these exact tab IDs: ${allIds.join(", ")}`,
      `- Each tab ID must appear in EXACTLY ONE group (no duplicates, no omissions).`,
      `- If a new tab matches an EXISTING GROUP name, add it to that existing group (use the exact existing group name).`,
      `- Create new groups only when no existing group matches semantically.`,
      ``,
      `USER CONTEXT:`,
      `- User wants: "${userRequest.replace(/"/g, "'")}"`,
      ``,
      `${existingGroupsInfo}`,
      ``,
      `NEW TABS TO ORGANIZE:\n${tabsList}`,
      ``,
      `RESPONSE FORMAT (example):`,
      `{"groups": {"Social Media": [12,13], "React Tutorials": [21,22]}, "explanation": "Added X to Social Media; created React Tutorials for several YouTube React videos."}`
    ].join("\n");

    // Send prompt to AI
    const aiRawResponse = await aiSession.prompt(prompt);

    // Parse AI response using your existing helper (keeps compatibility with previous calls)
    // parseAIResponse should return an object with at least { groups: {...}, explanation: "..." }
    let parsed;
    try {
      parsed = await parseAIResponse(aiRawResponse, tabs, existingGroups);
    } catch (parseErr) {
      // If parse helper fails, attempt simple JSON parse fallback
      try {
        parsed = JSON.parse(aiRawResponse);
      } catch (jsonErr) {
        return { valid: false, error: "Failed to parse AI response", detail: parseErr.message || parseErr, aiRawResponse };
      }
    }

    // Ensure parsed.groups exists and is an object
    if (!parsed || typeof parsed !== "object" || !parsed.groups || typeof parsed.groups !== "object") {
      return { valid: false, error: "AI response missing required 'groups' object", raw: parsed || aiRawResponse };
    }

    // Normalization helper: ensure arrays of ints
    const normalizeGroups = (groupsObj) => {
      const out = {};
      for (const [name, arr] of Object.entries(groupsObj)) {
        out[String(name)] = Array.isArray(arr) ? arr.map((x) => Number(x)) : [];
      }
      return out;
    };

    let groups = normalizeGroups(parsed.groups);

    // Validate and fix duplicates/missing IDs
    const idToGroups = new Map();
    for (const [gName, ids] of Object.entries(groups)) {
      for (const id of ids) {
        if (!idToGroups.has(id)) idToGroups.set(id, []);
        idToGroups.get(id).push(gName);
      }
    }

    // Find duplicates and missing ids
    const duplicates = [];
    for (const [id, gList] of idToGroups.entries()) {
      if (gList.length > 1) duplicates.push({ id, groups: gList });
    }
    const seenIds = Array.from(idToGroups.keys()).filter((n) => !Number.isNaN(n));
    const missing = allIds.filter((id) => !seenIds.includes(id));

    const fixes = { duplicates: [], missing: [] };

    // Resolve duplicates by leaving id in the first group (order of Object.keys(groups)) and removing from rest
    if (duplicates.length > 0) {
      for (const d of duplicates) {
        const keepGroup = Object.keys(groups).find((k) => groups[k].includes(d.id));
        // remove from other groups
        for (const g of d.groups) {
          if (g !== keepGroup) {
            groups[g] = groups[g].filter((x) => x !== d.id);
          }
        }
        fixes.duplicates.push({ id: d.id, keptIn: keepGroup, removedFrom: d.groups.filter((g) => g !== keepGroup) });
      }
    }

    // Add missing IDs to a sensible place: prefer an existing group named "Misc", "Reading", "Research", otherwise create "Misc"
    if (missing.length > 0) {
      fixes.missing = missing.slice();
      const preferNames = ["Misc", "Reading", "Research"];
      let placed = false;
      for (const name of preferNames) {
        if (groups[name]) {
          groups[name] = groups[name].concat(missing);
          placed = true;
          break;
        }
      }
      if (!placed) {
        // create a Misc group
        const miscNameBase = "Misc";
        let miscName = miscNameBase;
        let counter = 1;
        while (groups[miscName]) {
          miscName = `${miscNameBase} ${counter++}`; // should be very rare
        }
        groups[miscName] = missing.slice();
      }
    }

    // Final check: ensure each id appears exactly once now
    const finalIdCounts = {};
    for (const ids of Object.values(groups)) {
      for (const id of ids) {
        finalIdCounts[id] = (finalIdCounts[id] || 0) + 1;
      }
    }
    const stillDuplicates = Object.entries(finalIdCounts).filter(([id, cnt]) => cnt > 1).map(([id, cnt]) => Number(id));
    const stillMissing = allIds.filter((id) => !finalIdCounts[id]);

    if (stillDuplicates.length > 0 || stillMissing.length > 0) {
      // force-resolve: build a deterministic assignment: iterate allIds and place into first group that contains it (or create Misc)
      const finalGroups = {};
      for (const [name] of Object.entries(groups)) finalGroups[name] = [];
      const miscName = Object.keys(finalGroups).find((n) => n === "Misc") || "Misc";
      if (!finalGroups[miscName]) finalGroups[miscName] = [];

      const seen = new Set();
      for (const id of allIds) {
        // find first group that included it originally
        const owningGroup = Object.keys(groups).find((g) => (groups[g] || []).includes(id));
        if (owningGroup && !seen.has(id)) {
          finalGroups[owningGroup].push(id);
          seen.add(id);
        } else if (!seen.has(id)) {
          finalGroups[miscName].push(id);
          seen.add(id);
        }
      }
      groups = finalGroups;
      fixes.actions = "Forced deterministic re-assignment to ensure exactly-one-per-id";
    }

    // Separate additions to existing groups vs newly created groups
    const existingGroupMap = {};
    for (const g of existingGroups || []) {
      existingGroupMap[g.title] = Array.isArray(g.tabs) ? g.tabs.map((t) => t.id) : [];
    }

    const existingGroupAdds = {};
    const newGroups = {};
    for (const [gName, ids] of Object.entries(groups)) {
      if (existingGroupMap.hasOwnProperty(gName)) {
        // compute newly added ids (present in ids but not present in original group)
        const adds = ids.filter((id) => !existingGroupMap[gName].includes(id));
        if (adds.length > 0) existingGroupAdds[gName] = adds;
      } else {
        newGroups[gName] = ids;
      }
    }

    // Build final return object
    return {
      valid: true,
      raw: parsed,
      groups,
      existingGroupAdds,
      newGroups,
      fixes,
      explanation: parsed.explanation || "",
    };
  } catch (err) {
    console.error("askAIToGroupTabs error:", err);
    return { valid: false, error: err.message || String(err) };
  }
};


// parseAIResponse
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
    };
  } catch (err) {
    console.error("Parse error:", err);
    return { valid: false, error: err.message };
  }
}

// createFallbackGroups
function createFallbackGroups(tabs, existingGroups = []) {
  const groups = {};
  const existingGroupMap = new Map();

  existingGroups.forEach(g => {
    const title = g.title.toLowerCase();
    existingGroupMap.set(title, g.title);
  });

  tabs.forEach((tab) => {
    try {
      const hostname = new URL(tab.url).hostname;
      const domain = hostname.replace(/^www\./, "");

      let category = "Other";
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

// findExistingGroup
function findExistingGroup(existingGroupMap, keywords) {
  for (const [key, originalTitle] of existingGroupMap.entries()) {
    if (keywords.some(keyword => key.includes(keyword))) {
      return originalTitle;
    }
  }
  return null;
}

// createMultipleGroups
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

    const existingGroupMap = new Map();
    existingGroups.forEach(g => {
      existingGroupMap.set(g.title.toLowerCase(), g);
    });

    for (const [groupName, tabIds] of Object.entries(groupedTabs)) {
      if (!Array.isArray(tabIds)) continue;
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
        const existingGroup = existingGroupMap.get(groupName.toLowerCase());

        if (existingGroup) {
          await chrome.tabs.group({
            groupId: existingGroup.id,
            tabIds: validTabIds
          });
          tabsAddedToExisting += validTabIds.length;
          console.log(`✅ Added ${validTabIds.length} tab(s) to existing group: ${groupName}`);
        } else {
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

// organizeExistingTabs
async function organizeExistingTabs(force = false) {
  if (!force && !autoGroupingEnabled) {
    return;
  }
  if (isProcessing || aiStatus !== "ready") return;

  isProcessing = true;

  try {
    const ungroupedTabs = await getUngroupedTabs();

    if (ungroupedTabs.length > 0) {
      console.log(`Found ${ungroupedTabs.length} ungrouped tabs`);

      const existingGroups = await getExistingGroups();

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
        }
      }
    }
  } catch (err) {
    console.error("Organize error:", err);
  } finally {
    isProcessing = false;
  }
}

// handler for new tab
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
        const ungroupedTabs = await getUngroupedTabs();
        if (ungroupedTabs.length > 0) {
          const existingGroups = await getExistingGroups();
          let aiResult = await askAIToGroupTabs(ungroupedTabs, existingGroups);
          if (!aiResult.valid) {
            aiResult = createFallbackGroups(ungroupedTabs, existingGroups);
          }
          if (aiResult.valid) {
            await createMultipleGroups(aiResult.groups, existingGroups);
          }
        }
      }
    } catch (err) {
      console.error("Tab creation handler error:", err);
    }
  }, 10000);
});

// -------------------- Message listener --------------------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (!request || !request.action) {
      sendResponse({ error: "no action" });
      return true;
    }

    // AI status
    if (request.action === "getAIStatus") {
      sendResponse({ status: aiStatus });
      return true;
    }

    // Organize now
    if (request.action === "organizeNow") {
      organizeExistingTabs(true)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    // Fuse search - ENHANCED
    if (request.action === "fuseSearch") {
      (async () => {
        const q = (request.query || "").trim();
        const limit = request.limit || 10;

        if (!q) {
          sendResponse({ results: [] });
          return;
        }

        await ensureIndex();

        try {
          // Primary search with Fuse
          const raw = fuse.search(q, { limit: limit * 3 }); // Get more candidates
          let results = raw.map(r => ({
            id: r.item.id,
            title: r.item.title,
            url: r.item.url,
            snippet: r.item.snippet,
            score: r.score,
            windowId: r.item.windowId,
            groupId: r.item.groupId
          }));

          // Filter out invalid tabs and verify they still exist
          const validResults = [];
          for (const result of results) {
            try {
              const tab = await chrome.tabs.get(result.id);
              if (tab && tab.url) {
                validResults.push({
                  ...result,
                  windowId: tab.windowId,
                  groupId: tab.groupId
                });
              }
            } catch (err) {
              // Tab no longer exists, skip
            }
          }

          results = validResults.slice(0, limit);

          // Fallback if no Fuse results
          if (results.length === 0) {
            console.log("🔍 No Fuse results, using fallback search");
            const ql = q.toLowerCase();
            const allTabs = await chrome.tabs.query({});

            const fallback = allTabs
              .filter(tab => {
                const url = tab.url || "";
                if (url.startsWith("chrome://") ||
                  url.startsWith("chrome-extension://") ||
                  url.startsWith("edge://") ||
                  url.startsWith("about:")) {
                  return false;
                }

                const title = (tab.title || "").toLowerCase();
                const urlLower = url.toLowerCase();

                return title.includes(ql) || urlLower.includes(ql);
              })
              .slice(0, limit)
              .map(tab => ({
                id: tab.id,
                title: tab.title,
                url: tab.url,
                snippet: "",
                score: null,
                windowId: tab.windowId,
                groupId: tab.groupId
              }));

            if (fallback.length > 0) {
              console.log(`✅ Fallback found ${fallback.length} results`);
              results = fallback;
            }
          }

          console.log(`🔎 Search "${q}" returned ${results.length} results`);
          sendResponse({ results });
        } catch (err) {
          console.error("Fuse search error:", err);
          sendResponse({ results: [] });
        }
      })();
      return true;
    }

    // Rebuild index
    if (request.action === "rebuildIndex") {
      (async () => {
        const ok = await buildFuseIndex();
        sendResponse({ success: ok });
      })();
      return true;
    }

    // Accept page snippets from content scripts - AUTOMATIC
    if (request.action === "pageSnippet") {
      (async () => {
        try {
          const tabId = (sender?.tab?.id) || request.tabId || null;
          const tabUrl = (sender?.tab?.url) || request.url || null;
          const title = (sender?.tab?.title) || request.title || null;
          const snippet = request.snippetText || request.snippet || "";

          if (!snippet || snippet.length < 50) {
            sendResponse({ ok: false, error: "snippet too short" });
            return;
          }

          if (!tabId) {
            sendResponse({ ok: false, error: "no tabId" });
            return;
          }

          await updateSnippetForTab(tabId, snippet, tabUrl, title);
          sendResponse({ ok: true });
        } catch (e) {
          console.error("pageSnippet error:", e);
          sendResponse({ ok: false, error: e.message || String(e) });
        }
      })();
      return true;
    }

    sendResponse({ error: "unknown action" });
    return true;
  } catch (err) {
    console.error("Message handler error:", err);
    try {
      sendResponse({ error: err.message || String(err) });
    } catch { }
    return true;
  }
});

// -------------------- Auto-request snippets from tabs --------------------
async function requestSnippetFromTab(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: "sendPageSnippet" });
  } catch (err) {
    // Content script not ready or tab doesn't support it
  }
}

// -------------------- Watch tabs/groups to keep index fresh --------------------
chrome.tabs.onCreated.addListener((tab) => {
  setTimeout(buildFuseIndex, 1000);
  // Auto-request snippet from new tab after it loads
  setTimeout(() => {
    if (tab.id) requestSnippetFromTab(tab.id);
  }, 4000);
});

chrome.tabs.onRemoved.addListener(() => {
  setTimeout(buildFuseIndex, 500);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    setTimeout(buildFuseIndex, 1000);
    // Auto-request snippet after page loads
    setTimeout(() => requestSnippetFromTab(tabId), 2000);
  } else if (changeInfo.title) {
    setTimeout(buildFuseIndex, 400);
  }
});

chrome.windows.onFocusChanged && chrome.windows.onFocusChanged.addListener(() => {
  setTimeout(buildFuseIndex, 500);
});

chrome.tabGroups.onUpdated && chrome.tabGroups.onUpdated.addListener(() => {
  setTimeout(buildFuseIndex, 500);
});

// -------------------- Extension lifecycle --------------------
chrome.runtime.onInstalled.addListener((details) => {
  console.log("📦 Extension installed/updated:", details.reason);

  // Auto-request snippets from all existing tabs
  setTimeout(async () => {
    try {
      const tabs = await chrome.tabs.query({});
      let count = 0;
      for (const tab of tabs) {
        if (tab.url && !tab.url.startsWith("chrome://") &&
          !tab.url.startsWith("chrome-extension://")) {
          setTimeout(() => requestSnippetFromTab(tab.id), count * 100);
          count++;
        }
      }
      console.log(`📥 Requested content from ${count} existing tabs`);
    } catch (err) {
      console.error("Error requesting snippets:", err);
    }
  }, 3000);

  initializeAI();
});

chrome.runtime.onStartup.addListener(() => {
  console.log("🚀 Browser started");
  initializeAI();

  // Request snippets on startup
  setTimeout(async () => {
    const tabs = await chrome.tabs.query({});
    tabs.forEach((tab, i) => {
      if (tab.url && !tab.url.startsWith("chrome://") &&
        !tab.url.startsWith("chrome-extension://")) {
        setTimeout(() => requestSnippetFromTab(tab.id), i * 100);
      }
    });
  }, 5000);
});

// Initialize immediately
initializeAI();

console.log("🚀 AI Tab Manager loaded with automatic content indexing");