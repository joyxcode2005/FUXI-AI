// src/utils/index.js - COMPLETE VERSION
export const systemPrompt = `
You are an advanced Chrome Tab Management AI Assistant, designed to maximize user productivity by intelligently organizing browser tabs. Your goal is to create logical, context-aware, and distinct groups that dynamically reflect the user's current tasks and workflows, balanced with sensible generalization when task context is unclear. Analyze the provided tabs (titles, URLs, domains, snippets) and existing groups meticulously.

CRITICAL: Respond ONLY with valid, raw JSON. Do NOT use markdown formatting (like \`\`\`) or add any explanatory text outside the specified JSON structure.

INPUT CONTEXT:
- You will receive:
  • \`tabs\`: A list of all open, ungrouped tabs. Each tab object contains:
    - \`id\`: Unique numeric identifier.
    - \`title\`: Page title.
    - \`url\`: Full URL.
    - \`domain\`: Extracted hostname (e.g., "google.com").
    - \`snippet\`: A short text snippet extracted from the page content (up to 300 characters). Use this for deeper semantic understanding.
  • \`existing_groups\`: A list of currently active tab groups. Each group object contains:
    - \`name\`: The current name of the group.
    - \`tab_ids\`: A list of tab IDs already within that group.

OUTPUT FORMAT (Strict JSON):
{
  "groups": {
    "Group Name 1": [101, 102, 103],
    "Specific Project Research": [104, 105],
    "Social Media": [106]
  },
  "explanation": "Detailed rationale for grouping decisions, including merges, new groups, reasoning based on content/task, and justification for specific vs. general groups."
}

============================
ADVANCED GROUPING PRINCIPLES
============================

1.  **Prioritize Task/Workflow Context (Dynamic Grouping):** **Highest priority.** Group tabs related to the *same immediate task* or *mental context*. Use titles, URLs, *and especially content snippets* to infer the user's workflow.
    * Example: Tabs for a specific codebase on GitHub, related Stack Overflow errors, documentation, and an AI chat (like Gemini or ChatGPT) used for debugging should ideally be grouped together under a task-specific name (e.g., "Fixing API Auth Bug").
    * **Developer Context:** Recognize that GitHub, Stack Overflow, Docs, and AI tools are often used *together* for development tasks. Look for thematic links (libraries, APIs, errors, project names) connecting tabs across these domains.

2.  **Generalize When Task is Unclear (Generalized Grouping):** If multiple tabs belong to the *same broad category* (e.g., several different AI chat tools, various news sites, multiple social media platforms) but lack evidence of being used for *one specific, shared task*, group them under a sensible **generalized category name** (e.g., "AI Assistants", "Tech News", "Social Media"). This avoids creating too many small, site-specific groups.

3.  **Intelligent Reuse & Merging:**
    * **High Similarity (Task Match):** If new tabs strongly match the topic and *inferred task* of an existing group, assign them to that group using the *exact* existing name.
    * **Category Match:** If new tabs fit the general category of an existing group (e.g., a new AI tool tab and an existing "AI Assistants" group) but don't clearly share the *same specific task* as the tabs already in that group, merge them into the existing group.
    * **Developer Merging:** Be very willing to merge new GitHub, Stack Overflow, Docs, or AI tool tabs into existing *developer-themed* groups (e.g., 'Development', 'Project [X]', 'API Research') if the topic aligns thematically, even if the specific task isn't identical.
    * **Low Similarity:** Always create a new group if no strong semantic, task-based, or category match exists.

4.  **Optimal Group Granularity (Balancing Specificity and Generality):**
    * **Ideal Size:** Aim for groups of 3-7 related tabs.
    * **Merge Related Small Groups:** If multiple small groups (1-2 tabs) represent *similar categories* (e.g., one group for "Gemini" and one for "ChatGPT") and they don't seem tied to different specific tasks, merge them under a broader category name (e.g., "AI Assistants").
    * **Avoid Overly Broad Groups:** Do not create excessively broad groups (e.g., "Work", "Internet") unless tabs truly lack *any* more specific shared context.

5.  **Semantic Hierarchy (Inferential Weighting):**
    * **Content Snippet & Title Keywords:** Highest weight (Specific subject/action/task).
    * **Domain & URL Patterns:** Medium weight (Site type/purpose). Use to reinforce snippet/title analysis and identify categories.
    * **General Platform:** Lowest weight (Broad categories like "Social Media", "News").

6.  **Uniqueness & Exclusivity:** Each input tab ID *must* belong to exactly one output group. No omissions or duplicates.

=====================
DYNAMIC NAMING RULES
=====================

1.  **Task-Specific Names (Preferred):** If a clear task is inferred, use names reflecting it. Examples: "API Authentication Bug", "Q3 Marketing Report", "Travel Planning: Tokyo".
2.  **Generalized Category Names (Use When Task Unclear):** If grouping by broader category, use clear category names. Examples: "AI Assistants", "Developer Resources", "Cloud Platforms", "Project Management Tools", "Tech News", "Social Media", "Video Streaming", "Music", "Online Learning", "Shopping".
3.  **Concise & Clear:** Keep names relatively short but descriptive.
4.  **Avoid Duplicates:** Ensure new group names don't clash with existing ones unless merging. Add distinguishing keywords if needed.
5.  **Emojis (Optional & Sparingly):** A single relevant emoji at the start is acceptable (e.g., "🐛 API Bug", "🤖 AI Assistants", "📰 Tech News").

===========================
DOMAIN-SPECIFIC GUIDANCE
===========================

Use these to inform *category grouping* when specific task context is weak:
-   **AI/ML Tools:** chatgpt.com, claude.ai, gemini.google.com, perplexity.ai, huggingface.co -> Group under "AI Assistants" or a task name if appropriate.
-   **Developer Platforms:** github.com, gitlab.com, stackoverflow.com, *.vercel.app, *.netlify.app -> Group under "Developer Resources", "Project [X]", or task name. **Strongly prefer grouping these together if related.**
-   **Documentation:** *docs.*, developer.*, readthedocs.io, mdn.io -> Group by technology ("React Docs") or merge with related "Developer Resources".
-   **Cloud/Infra:** aws.amazon.com, cloud.google.com, azure.microsoft.com -> Group under "Cloud Platforms" or project name.
-   **Project Management:** jira.com, trello.com, asana.com, notion.so, figma.com -> Group under "Project Management" or project name.
-   **News/Blogs:** techcrunch.com, news.ycombinator.com, dev.to, medium.com -> Group under "Tech News", "Articles", or specific topic.
-   **Social Media:** twitter.com, linkedin.com, facebook.com, instagram.com, reddit.com -> Group under "Social Media" unless task context ("LinkedIn Job Search").
-   **Media/Streaming:** youtube.com, netflix.com, spotify.com -> Group under "Video Streaming", "Music", or subject.
-   **Learning:** coursera.org, udemy.com, freecodecamp.org -> Group under "Online Learning" or course subject.
-   **Shopping:** amazon.com, ebay.com -> Group under "Shopping" or item research.

=====================
EDGE CASE HANDLING
=====================
-   **Duplicate Tabs:** Place together in the most relevant group.
-   **Multi-Context Tabs:** Prioritize task group > specific category group > general category group.

=====================
EXPLANATION FIELD REQS
=====================
Provide a concise summary mentioning:
-   Which existing groups received tabs and why (task or category match).
-   Which new groups were created (task-specific or generalized category) and why.
-   Justify the choice between specific task-based groups vs. more generalized category groups.
-   Example: "Merged 2 tabs into 'Social Media'. Created task group 'Project X Debugging' for related GitHub/Stack Overflow/Gemini tabs based on API error context. Grouped remaining news sites under generalized category 'Tech News' as no specific shared task was apparent."

Strictly adhere to the JSON-only output format. Prioritize dynamic, task-oriented groups when identifiable, but fall back to sensible generalized categories to avoid excessive fragmentation.
`;

// Replace the existing helpMessage in src/utils/index.js

export const helpMessage = `## 🚀 AI Tab Manager Help

I can find open tabs, open new sites intelligently, and organize your workspace.

---

### 1. 🔍 Smart Search & Open (Primary Command)

This is the main "do-it-all" command. It always **searches your open tabs first** (including their content) and switches to the best match. If no open tab is found, it intelligently searches the web.

You can trigger it just by typing your query, or by using a command word:

**Examples (all do the same thing):**
- **"open react dashboard"**
- **"find react dashboard"**
- **"search react dashboard"**
- **"react dashboard"**

---

### 2. 💻 Developer Tools (Smart Opener)

The Smart Search is even smarter for developers. It uses APIs to find the *exact* repo or answer.

**GitHub Examples:**
- **"open github react"** → Opens the \`facebook/react\` repo
- **"open github nextjs"** → Opens the \`vercel/next.js\` repo

**Stack Overflow Examples:**
- **"open so react query error"** → Finds the top-rated answer
- **"so how to center a div"**

---

### 3. 📧 Gmail Context Search

Search the content of your open Gmail tabs. *This is separate from the main search.*

**Examples:**
- **"find mail from google"**
- **"open email about meeting"**
- **"show mail from john"**

---

### 4. 🎬 Quick Media & Site Shortcuts

These commands go directly to specific places.

- **"listen to music"** / **"play music"** → Opens Spotify
- **"watch reels"** → Opens Instagram Reels
- **"watch shorts"** → Opens YouTube Shorts
- **"check email"** → Opens Gmail

---

### 5. 🗂️ Tab & Group Organization

- **"organize my tabs"** / **"organize"**: Lets the AI analyze and group all ungrouped tabs.
- **"group all as [name]"**: Groups all ungrouped tabs into a single new group.
- **"list groups"** / **"groups"**: Shows the group manager UI.
- **"rename [old] to [new]"**: Renames an existing group.
- **"ungroup [name]"**: Ungroups all tabs from a group.
- **"help"**: Shows this help message.
`;

export const aiReadyMessage = `🤖 AI is ready! Type 'help' for commands.`;
export const aiUnavailableMessage = `ℹ️ AI unavailable. Manual commands still work!`;

// --- Grouping & Management Functions ---

export async function getAllGroups() {
  try {
      const groups = await chrome.tabGroups.query({});
      const groupsWithTabs = await Promise.all(
        groups.map(async (g) => {
           if (!g || typeof g.id === 'undefined') return null;
          try {
              const tabs = await chrome.tabs.query({ groupId: g.id });
              return {
                id: g.id,
                title: g.title || "Untitled Group",
                color: g.color || "grey",
                tabCount: tabs.length,
              };
          } catch { return null; }
        })
      );
      return groupsWithTabs.filter(g => g !== null).sort((a, b) => a.title.localeCompare(b.title));
   } catch (error) {
       console.error("Error in getAllGroups:", error);
       return [];
   }
}

export async function getExistingGroupsWithTabs() {
  try {
      const groups = await chrome.tabGroups.query({});
      const groupsWithTabs = await Promise.all(
        groups.map(async (g) => {
          if (!g || typeof g.id === 'undefined') return null;
           try {
              const tabs = await chrome.tabs.query({ groupId: g.id });
              return {
                id: g.id,
                title: g.title || "Untitled Group",
                color: g.color || "grey",
                tabIds: tabs.map(t => t.id),
                tabs: tabs.map(t => ({
                  id: t.id,
                  title: t.title || "Untitled Tab",
                  url: t.url || ""
                }))
              };
           } catch { return null; }
        })
      );
      return groupsWithTabs.filter(g => g !== null);
  } catch (error) {
       console.error("Error in getExistingGroupsWithTabs:", error);
       return [];
   }
}

export async function ungroupTabs(title) {
   if (!title || typeof title !== 'string') return { success: false, error: "Invalid group title provided." };
  try {
      const groups = await chrome.tabGroups.query({ title: title });
      const targetGroup = groups.find(g => g.title.toLowerCase() === title.toLowerCase());

      if (targetGroup) {
        const tabs = await chrome.tabs.query({ groupId: targetGroup.id });
        if (tabs.length > 0) {
            await chrome.tabs.ungroup(tabs.map((t) => t.id));
            return { success: true, count: tabs.length };
        } else {
             return { success: true, count: 0, message: "Group was empty." };
        }
      }
      return { success: false, error: `Group "${title}" not found.` };
   } catch (error) {
        console.error(`Error ungrouping "${title}":`, error);
        return { success: false, error: error.message || "An unexpected error occurred." };
   }
}

export async function renameGroup(oldTitle, newTitle) {
    if (!oldTitle || !newTitle || typeof oldTitle !== 'string' || typeof newTitle !== 'string') {
        return { success: false, error: "Invalid titles provided." };
    }
    const trimmedNewTitle = newTitle.trim();
     if (!trimmedNewTitle) return { success: false, error: "New group name cannot be empty." };

  try {
      const groups = await chrome.tabGroups.query({ title: oldTitle });
      const targetGroup = groups.find(g => g.title.toLowerCase() === oldTitle.toLowerCase());

      if (targetGroup) {
        await chrome.tabGroups.update(targetGroup.id, { title: trimmedNewTitle });
        return { success: true };
      }
      return { success: false, error: `Group "${oldTitle}" not found.` };
   } catch (error) {
       console.error(`Error renaming "${oldTitle}" to "${trimmedNewTitle}":`, error);
       return { success: false, error: error.message || "An unexpected error occurred." };
   }
}

export async function groupExistingTabs(title, color = "grey") {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return { success: false, error: "Group title cannot be empty." };

  try {
      const tabs = await chrome.tabs.query({ windowType: "normal", groupId: chrome.tabGroups.TAB_GROUP_ID_NONE });
      const groupableTabs = tabs.filter((tab) => {
        const url = tab.url || "";
        return ( tab.id &&
          !url.startsWith("chrome://") &&
          !url.startsWith("chrome-extension://") &&
          !url.startsWith("edge://") &&
          !url.startsWith("about:")
        );
      });

      if (groupableTabs.length === 0) {
        return { success: false, error: "No ungroupable tabs found." };
      }

      const tabIds = groupableTabs.map((t) => t.id);

       const existingGroups = await chrome.tabGroups.query({ title: trimmedTitle });
       let groupId;
       if (existingGroups.length > 0) {
           groupId = existingGroups[0].id;
           await chrome.tabs.group({ groupId: groupId, tabIds });
            console.log(`Added ${tabIds.length} tabs to existing group "${trimmedTitle}"`);
       } else {
           groupId = await chrome.tabs.group({ tabIds });
           await chrome.tabGroups.update(groupId, { title: trimmedTitle, color: color });
           console.log(`Created new group "${trimmedTitle}" with ${tabIds.length} tabs`);
       }

      return { success: true, count: tabIds.length, groupId: groupId };
   } catch (error) {
       console.error(`Error grouping tabs as "${trimmedTitle}":`, error);
       return { success: false, error: error.message || "An unexpected error occurred." };
   }
}

// Validation helper
async function validateTabIdsForGrouping(tabIds) {
  if (!Array.isArray(tabIds)) return [];
  const validIds = [];
  for (const tabId of tabIds) {
      const numId = Number(tabId);
      if (isNaN(numId)) continue;
      try {
          const tab = await chrome.tabs.get(numId);
          if (tab && tab.windowType === 'normal' && tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
              validIds.push(numId);
          }
      } catch { }
  }
  return validIds;
}

export async function createMultipleGroups(groupedTabs) {
   if (!groupedTabs || typeof groupedTabs !== 'object' || Object.keys(groupedTabs).length === 0) {
       return { success: false, error: "No group data provided.", groupsCreated: 0, tabsAddedToExisting: 0 };
   }
  let groupsCreatedCount = 0;
  let tabsAddedCount = 0;
  const colors = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];
  const successfulGroups = [];
  let colorIndex = 0;

  try {
      const currentGroups = await chrome.tabGroups.query({});
      const groupNameToIdMap = new Map();
      currentGroups.forEach(g => groupNameToIdMap.set(g.title.toLowerCase(), g.id));

      for (const [groupName, originalTabIds] of Object.entries(groupedTabs)) {
        const trimmedGroupName = groupName.trim();
        if (!trimmedGroupName || !Array.isArray(originalTabIds) || originalTabIds.length === 0) continue;

        const validTabIds = await validateTabIdsForGrouping(originalTabIds);
        if (validTabIds.length === 0) {
             console.log(`No valid, ungrouped tabs found for group "${trimmedGroupName}".`);
            continue;
        }

        const lowerGroupName = trimmedGroupName.toLowerCase();
        let targetGroupId = groupNameToIdMap.get(lowerGroupName);

        if (targetGroupId) {
          try {
              await chrome.tabs.group({ groupId: targetGroupId, tabIds: validTabIds });
              tabsAddedCount += validTabIds.length;
              console.log(`✅ Added ${validTabIds.length} tab(s) to existing group: "${trimmedGroupName}"`);
          } catch (e) { 
              console.error(`Error adding tabs to group "${trimmedGroupName}":`, e); 
              // *** FIX: Throw a robust error message ***
              const errorMsg = e?.message || String(e) || "Unknown error";
              throw new Error(`Failed to add tabs to "${trimmedGroupName}": ${errorMsg}`);
          }
        } else {
          try {
              const newGroupId = await chrome.tabs.group({ tabIds: validTabIds });
              const chosenColor = colors[colorIndex % colors.length];
              await chrome.tabGroups.update(newGroupId, { title: trimmedGroupName, color: chosenColor });
              groupsCreatedCount++;
              successfulGroups.push(trimmedGroupName);
              colorIndex++;
              groupNameToIdMap.set(lowerGroupName, newGroupId);
              console.log(`✅ Created new group: "${trimmedGroupName}" with ${validTabIds.length} tabs.`);
          } catch(e) {
               console.error(`Error creating new group "${trimmedGroupName}":`, e);
               try { await chrome.tabs.ungroup(validTabIds); } catch {}
               
               // *** FIX: Throw a robust error message ***
               const errorMsg = e?.message || String(e) || "Unknown error";
               throw new Error(`Failed to create group "${trimmedGroupName}": ${errorMsg}`);
          }
        }
      }
      const success = (groupsCreatedCount > 0 || tabsAddedCount > 0);
      return { 
        success: success,
        groupsCreated: groupsCreatedCount, 
        tabsAddedToExisting: tabsAddedCount,
        groups: successfulGroups,
        // *** THIS IS THE FIX: Add a default error if success is false ***
        error: success ? null : "No tabs were grouped. (They might be already grouped or no valid tabs found)"
      };
   } catch (error) {
    // *** FIX: This ensures a valid string is always returned ***
    const errorMessage = error?.message || String(error) || "An unknown error occurred in createMultipleGroups";
    console.error("Error in createMultipleGroups:", error);
    return { success: false, error: errorMessage };
  }
}

// Robust AI Response Parser
export const parseAIResponse = (responseString, tabs = []) => {
  if (!responseString || typeof responseString !== 'string') {
      return { valid: false, error: "Invalid AI response input (not a string or empty)." };
  }
  try {
      const jsonMatch = responseString.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
          console.error("No JSON object found in AI response:", responseString);
          return { valid: false, error: "No JSON object found in AI response." };
      }

      const potentialJson = jsonMatch[0];
      const data = JSON.parse(potentialJson);

      if (!data || typeof data !== 'object') {
          throw new Error("Parsed data is not an object.");
      }
      if (!data.groups || typeof data.groups !== 'object') {
          console.error("Invalid format: 'groups' key missing or not an object.", data);
          return { valid: false, error: "Invalid format: 'groups' key missing or not an object." };
      }

      const normalizedGroups = {};
      const allTabIdsFromInput = new Set((tabs || []).map(t => t.id));

      for (const [rawName, ids] of Object.entries(data.groups)) {
          const groupName = String(rawName).trim();
          if (!groupName) continue;

          if (!Array.isArray(ids)) {
               console.warn(`Group "${groupName}" has invalid 'ids' (not an array), skipping.`);
               continue;
          }

          const validIds = [];
          for (const id of ids) {
              const numId = Number(id);
              if (!isNaN(numId) && allTabIdsFromInput.has(numId)) {
                  validIds.push(numId);
              } else {
                  console.warn(`Invalid or unexpected tab ID (${id}) found in group "${groupName}", skipping ID.`);
              }
          }

          if (validIds.length > 0) {
              normalizedGroups[groupName] = validIds;
          } else {
              console.log(`Group "${groupName}" ended up empty after validation, removing group.`);
          }
      }

      return {
        groups: normalizedGroups,
        explanation: typeof data.explanation === 'string' ? data.explanation.trim() : "AI organized tabs.",
        valid: true,
      };
    } catch (err) {
      console.error("Error parsing AI JSON response:", err, "Raw response:", responseString);
      return { valid: false, error: `JSON parsing failed: ${err.message}` };
    }
};