// src/utils/index.js - COMPLETE VERSION
export const systemPrompt = `You are an expert Chrome Tab Organization AI. Your mission is to intelligently group browser tabs based on context, task, and semantic relationships.

=== CRITICAL OUTPUT RULES ===
1. Respond ONLY with valid JSON. NO markdown, NO code blocks, NO extra text.
2. Format: {"groups": {"Name": [id1, id2]}, "explanation": "text"}
3. Every input tab ID must appear EXACTLY ONCE in the output
4. Use EXACT existing group names when adding tabs to them

=== ANALYSIS PRIORITY (Highest to Lowest) ===
1. **Content Snippets** - The actual page content reveals true intent
2. **Page Titles** - User-facing descriptions of the content
3. **URL Patterns** - Domain + path structure shows purpose
4. **Domain Categories** - Broad classification (social, dev, news)

=== GROUPING STRATEGY ===

**STEP 1: Identify Active Tasks**
Look for evidence of specific workflows:
- Development: GitHub repo + Stack Overflow + docs + AI assistant on same topic
- Research: Multiple articles/papers on same subject
- Shopping: Product comparisons across sites
- Learning: Tutorial + practice + reference docs
- Problem-solving: Error messages + solutions + documentation

**STEP 2: Match to Existing Groups**
For each tab, check if it fits an existing group by:
- Same specific topic (e.g., "React Authentication" matches tabs about React auth)
- Same workflow (e.g., debugging, research, learning)
- Same project context (e.g., company name, codebase name)

When matching to existing groups:
- Use the EXACT name from existing_groups
- Prioritize semantic match over domain match
- Add to existing group if 60%+ topic overlap

**STEP 3: Create New Groups When Needed**
Create a new group if:
- No existing group matches the task/topic
- 3+ tabs share a specific context that doesn't fit elsewhere
- Creating a new group adds clarity vs. forcing into existing

**STEP 4: Choose Group Names**
- **Task-Specific** (preferred): "Debugging API Auth", "Q4 Planning", "React Tutorial Series"
- **Project-Based**: "ProjectName Development", "ClientName Proposal"
- **Topic-Specific**: "Machine Learning Research", "Web3 Documentation"
- **Category-Based** (fallback): "AI Tools", "Developer Resources", "News & Articles"

=== DOMAIN INTELLIGENCE ===

**Developer Workflow Recognition:**
- github.com + stackoverflow.com + (docs|api) = likely debugging/development task
- Multiple tabs with same library/framework name = learning/implementation
- AI chat + code platform = active problem-solving

**Content Creation Recognition:**
- figma.com + drive.google.com + presentation tools = design project
- Multiple docs + spreadsheets with similar names = report/analysis
- Video platform + editing tools = content production

**Research Recognition:**
- Multiple academic/article sites on same topic = research task
- Wikipedia + news + specialized sites = deep-dive learning
- Multiple product pages = comparison shopping

**Common Categories (use when no specific task is clear):**
- "AI Assistants" - ChatGPT, Claude, Gemini, etc.
- "Developer Tools" - GitHub, GitLab, Vercel, Netlify
- "Documentation" - Any docs.* or developer.* sites
- "Cloud Services" - AWS, GCP, Azure
- "Design & Collaboration" - Figma, Miro, Notion
- "Social Media" - Twitter, LinkedIn, Reddit
- "News & Articles" - News sites, blogs, Medium
- "Video & Entertainment" - YouTube, Netflix, streaming
- "Shopping" - E-commerce sites
- "Communication" - Gmail, Slack, messaging
- "Productivity" - Calendar, tasks, notes

=== QUALITY GUIDELINES ===

**Group Size:**
- Ideal: 3-8 tabs per group
- Merge small groups (1-2 tabs) if they share category
- Split large groups (10+ tabs) if multiple subtopics exist

**Naming Best Practices:**
- Be specific when possible: "Next.js App Deployment" > "Development"
- Use project names if identifiable: "Acme Corp Dashboard" > "Work Project"
- Keep under 40 characters
- Optional: Single emoji prefix (🔧, 📚, 🎨, 💼, 🔬)

**Existing Group Reuse:**
- If tab matches existing group topic: USE EXACT EXISTING NAME
- If unsure between existing groups: Choose the most specific match
- If creating similar name to existing: Check if merge is better

=== SPECIAL CASES ===

**Gmail Context:**
If multiple Gmail tabs with different subjects:
- Check snippets for sender/topic patterns
- Group by project if related (e.g., all client emails)
- Otherwise use "Email" or "Gmail - [Topic]"

**Duplicate Tabs:**
Same URL multiple times? Group together, they're likely related.

**AI Chat Tools:**
- If discussing same topic (check snippets): Group by topic
- If different topics: Use "AI Assistants" category
- If with dev tools: Merge into development task group

**Mixed Content:**
When tabs don't clearly fit together:
- Create 2-3 focused groups rather than 1 vague group
- Use descriptive category names
- Prioritize user workflow over rigid categorization

=== EXPLANATION REQUIREMENTS ===
Your explanation should mention:
1. How many tabs added to existing groups and why
2. How many new groups created and their purpose
3. Key decision rationale (task-based vs category-based)
4. Any challenges or ambiguities you handled

Example: "Added 3 tabs to existing 'React Development' based on shared framework context. Created 'API Integration Research' for 4 tabs showing active debugging workflow (GitHub issue, Stack Overflow solutions, docs, AI troubleshooting). Grouped 2 news sites under 'Tech News' as no specific shared task was evident."

=== VALIDATION CHECKLIST ===
Before responding, verify:
✓ Valid JSON format (no markdown)
✓ Every input ID appears exactly once
✓ Existing group names are EXACT matches
✓ Group names are clear and specific
✓ Explanation describes key decisions
✓ No empty groups in output

Remember: Quality grouping helps users work faster. When in doubt, prefer specific task-based groups over generic categories, but don't force unrelated tabs together.`;

export const helpMessage = `## 🚀 AI Tab Manager Help

I can find open tabs, open new sites intelligently, and organize your workspace.

---

### 1. 🔍 Reliable Smart Search (Your Main Command)

This is the main "do-it-all" command. It provides **reliable search** by instantly scanning the **title, URL, and full text content** of all your open tabs to find the best match.

If no open tab is found, it intelligently searches the web for you.

**Examples (all do the same thing):**
* **"react dashboard"** (Will find your open \`localhost:3000/dashboard\` tab)
* **"find my-jira-ticket-123"** (Finds the tab by its title or content)
* **"open pull request"**
* **"search for the presentation"**

---

### 2. 💻 Smart Opener & Shortcuts

The smart search is even smarter for developers, media, and common sites.

**Developer Examples:**
* **"open github react"** → Opens the \`facebook/react\` repo
* **"open so react query error"** → Finds the top-rated answer
* **"so how to center a div"**
* **"open github account"** → Asks for and saves your username, then opens your profile.

**Media & Content Search:**
Use the **"... on [platform]"** pattern to find videos, movies, and tutorials.
* **"i want to see react tutorial on youtube"**
* **"open oppenheimer review on youtube"**
* **"find stranger things on netflix"**
* **"watch the boys on prime"**

**Quick Site Shortcuts:**
* **"listen to music"** → Opens Spotify
* **"watch reels"** → Opens Instagram Reels
* **"watch shorts"** → Opens YouTube Shorts
* **"check email"** → Opens Gmail

---

### 3. 📧 Gmail Context Search

Search *inside* your open Gmail tabs (this is separate from the main search).

**Examples:**
* **"find mail from google"**
* **"open email about meeting"**
* **"show mail from john"**

---

### 4. 🗂️ Tab & Group Organization

* **"organize"** / **"organize my tabs"**: Lets the AI analyze and group all ungrouped tabs.
* **"group all as [name]"**: Groups all ungrouped tabs into a single new group (e.g., \`group all as Work\`).
* **"list groups"** / **"groups"**: Shows the group manager UI.
* **"rename [old] to [new]"**: Renames an existing group (e.g., \`rename Work to Project X\`).
* **"ungroup [name]"**: Ungroups all tabs from a specific group.
* **"help"**: Shows this help message.
`;

//  NEW HTML VERSION HELP
export const helpMessageHTML = `
<div class="text-sm" style="color: inherit;">
  <h2 class="text-lg font-bold mb-2 flex items-center gap-2">🚀 AI Tab Manager Help</h2>
  <p class="mb-3">I can find open tabs, open new sites intelligently, and organize your workspace.</p>
  <hr class="my-3 border-slate-600/50">

  <h3 class="text-base font-semibold mt-4 mb-2">1. 🔍 Reliable Smart Search (Your Main Command)</h3>
  <p class="mb-2">This is the main "do-it-all" command. It provides <strong class="font-semibold text-black-300">reliable search</strong> by instantly scanning the <strong class="font-semibold">title, URL, and full text content</strong> of all your open tabs to find the best match.</p>
  <p class="mb-2">If no open tab is found, it intelligently searches the web for you.</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"react dashboard"</strong> (Finds your \`localhost:3000\` tab)</li>
    <li><strong>"find my-jira-ticket-123"</strong></li>
    <li><strong>"open pull request"</strong></li>
  </ul>

  <h3 class="text-base font-semibold mt-4 mb-2">2. 💻 Smart Opener & Shortcuts</h3>
  <p class="font-medium mb-1 mt-1">Developer Examples:</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"open github react"</strong> → Opens \`facebook/react\`</li>
    <li><strong>"open so react query error"</strong> → Finds top answer</li>
    <li><strong>"open github account"</strong> → Opens your profile</li>
  </ul>
  <p class="font-medium mb-1 mt-2">Media & Content Search:</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"i want to see react tutorial on youtube"</strong></li>
    <li><strong>"open oppenheimer review on youtube"</strong></li>
    <li><strong>"find stranger things on netflix"</strong></li>
  </ul>
  <p class="font-medium mb-1 mt-2">Quick Site Shortcuts:</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"listen to music"</strong> → Opens Spotify</li>
    <li><strong>"watch reels"</strong> → Opens Instagram Reels</li>
  </ul>

  <h3 class="text-base font-semibold mt-4 mb-2">3. 📧 Gmail Context Search</h3>
  <p class="mb-2">Search <em>inside</em> your open Gmail tabs (this is separate from the main search).</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"find mail from google"</strong></li>
    <li><strong>"open email about meeting"</strong></li>
  </ul>

  <h3 class="text-base font-semibold mt-4 mb-2">4. 🗂️ Tab & Group Organization</h3>
  <ul class="list-disc list-inside pl-2 space-y-1">
    <li><strong>"organize"</strong> / <strong>"organize my tabs"</strong></li>
    <li><strong>"group all as [name]"</strong> (e.g., \`group all as Work\`)</li>
    <li><strong>"list groups"</strong> / <strong>"groups"</strong></li>
    <li><strong>"rename [old] to [new]"</strong></li>
    <li><strong>"ungroup [name]"</strong></li>
    <li><strong>"help"</strong> (Shows this message)</li>
  </ul>
</div>
`;

export const completerSystemPrompt = `
You are a silent autocomplete assistant. Your ONLY job is to complete the user's partial command.
    Respond with ONLY the *full, completed* command text.
    If no logical completion exists or the command is already complete, respond with "NO_MATCH".

EXAMPLES:
User: "org"
Assistant: "organize"

User: "open git"
Assistant: "open github account"

User: "group all"
Assistant: "group all as "

User: "so rea"
Assistant: "so react"

User: "un"
Assistant: "ungroup "

User: "organize my "
Assitant: "organize my tabs
`;

export const aiReadyMessage = `🤖 AI is ready! Type 'help' for commands.`;
export const aiUnavailableMessage = `ℹ️ AI unavailable. Manual commands still work!`;

export const languages = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "zh", name: "中文 (Chinese)", flag: "🇨🇳" },
  { code: "hi", name: "हिन्दी (Hindi)", flag: "🇮🇳" },
  { code: "es", name: "Español (Spanish)", flag: "🇪🇸" },
  { code: "fr", name: "Français (French)", flag: "🇫🇷" },
  { code: "ar", name: "العربية (Arabic)", flag: "🇸🇦" },
  { code: "bn", name: "বাংলা (Bengali)", flag: "🇧🇩" },
  { code: "pt", name: "Português (Portuguese)", flag: "🇵🇹" },
  { code: "ru", name: "Русский (Russian)", flag: "🇷🇺" },
  { code: "ur", name: "اردو (Urdu)", flag: "🇵🇰" },
];

// --- Grouping & Management Functions ---

export async function getAllGroups() {
  try {
    const groups = await chrome.tabGroups.query({});
    const groupsWithTabs = await Promise.all(
      groups.map(async (g) => {
        if (!g || typeof g.id === "undefined") return null;
        try {
          const tabs = await chrome.tabs.query({ groupId: g.id });
          return {
            id: g.id,
            title: g.title || "Untitled Group",
            color: g.color || "grey",
            tabCount: tabs.length,
          };
        } catch {
          return null;
        }
      })
    );
    return groupsWithTabs
      .filter((g) => g !== null)
      .sort((a, b) => a.title.localeCompare(b.title));
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
        if (!g || typeof g.id === "undefined") return null;
        try {
          const tabs = await chrome.tabs.query({ groupId: g.id });
          return {
            id: g.id,
            title: g.title || "Untitled Group",
            color: g.color || "grey",
            tabIds: tabs.map((t) => t.id),
            tabs: tabs.map((t) => ({
              id: t.id,
              title: t.title || "Untitled Tab",
              url: t.url || "",
            })),
          };
        } catch {
          return null;
        }
      })
    );
    return groupsWithTabs.filter((g) => g !== null);
  } catch (error) {
    console.error("Error in getExistingGroupsWithTabs:", error);
    return [];
  }
}

export async function ungroupTabs(title) {
  if (!title || typeof title !== "string")
    return { success: false, error: "Invalid group title provided." };
  try {
    const groups = await chrome.tabGroups.query({ title: title });
    const targetGroup = groups.find(
      (g) => g.title.toLowerCase() === title.toLowerCase()
    );

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
    return {
      success: false,
      error: error.message || "An unexpected error occurred.",
    };
  }
}

export async function renameGroup(oldTitle, newTitle) {
  if (
    !oldTitle ||
    !newTitle ||
    typeof oldTitle !== "string" ||
    typeof newTitle !== "string"
  ) {
    return { success: false, error: "Invalid titles provided." };
  }
  const trimmedNewTitle = newTitle.trim();
  if (!trimmedNewTitle)
    return { success: false, error: "New group name cannot be empty." };

  try {
    const groups = await chrome.tabGroups.query({ title: oldTitle });
    const targetGroup = groups.find(
      (g) => g.title.toLowerCase() === oldTitle.toLowerCase()
    );

    if (targetGroup) {
      await chrome.tabGroups.update(targetGroup.id, { title: trimmedNewTitle });
      return { success: true };
    }
    return { success: false, error: `Group "${oldTitle}" not found.` };
  } catch (error) {
    console.error(
      `Error renaming "${oldTitle}" to "${trimmedNewTitle}":`,
      error
    );
    return {
      success: false,
      error: error.message || "An unexpected error occurred.",
    };
  }
}

export async function groupExistingTabs(title, color = "grey") {
  const trimmedTitle = title.trim();
  if (!trimmedTitle)
    return { success: false, error: "Group title cannot be empty." };

  try {
    const tabs = await chrome.tabs.query({
      windowType: "normal",
      groupId: chrome.tabGroups.TAB_GROUP_ID_NONE,
    });
    const groupableTabs = tabs.filter((tab) => {
      const url = tab.url || "";
      return (
        tab.id &&
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

    const existingGroups = await chrome.tabGroups.query({
      title: trimmedTitle,
    });
    let groupId;
    if (existingGroups.length > 0) {
      groupId = existingGroups[0].id;
      await chrome.tabs.group({ groupId: groupId, tabIds });
      console.log(
        `Added ${tabIds.length} tabs to existing group "${trimmedTitle}"`
      );
    } else {
      groupId = await chrome.tabs.group({ tabIds });
      await chrome.tabGroups.update(groupId, {
        title: trimmedTitle,
        color: color,
      });
      console.log(
        `Created new group "${trimmedTitle}" with ${tabIds.length} tabs`
      );
    }

    return { success: true, count: tabIds.length, groupId: groupId };
  } catch (error) {
    console.error(`Error grouping tabs as "${trimmedTitle}":`, error);
    return {
      success: false,
      error: error.message || "An unexpected error occurred.",
    };
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
      if (
        tab &&
        tab.windowType === "normal" &&
        tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE
      ) {
        validIds.push(numId);
      }
    } catch {}
  }
  return validIds;
}

export async function createMultipleGroups(groupedTabs) {
  if (
    !groupedTabs ||
    typeof groupedTabs !== "object" ||
    Object.keys(groupedTabs).length === 0
  ) {
    return {
      success: false,
      error: "No group data provided.",
      groupsCreated: 0,
      tabsAddedToExisting: 0,
    };
  }
  let groupsCreatedCount = 0;
  let tabsAddedCount = 0;
  const colors = [
    "grey",
    "blue",
    "red",
    "yellow",
    "green",
    "pink",
    "purple",
    "cyan",
    "orange",
  ];
  const successfulGroups = [];
  let colorIndex = 0;

  try {
    const currentGroups = await chrome.tabGroups.query({});
    const groupNameToIdMap = new Map();
    currentGroups.forEach((g) =>
      groupNameToIdMap.set(g.title.toLowerCase(), g.id)
    );

    for (const [groupName, originalTabIds] of Object.entries(groupedTabs)) {
      const trimmedGroupName = groupName.trim();
      if (
        !trimmedGroupName ||
        !Array.isArray(originalTabIds) ||
        originalTabIds.length === 0
      )
        continue;

      const validTabIds = await validateTabIdsForGrouping(originalTabIds);
      if (validTabIds.length === 0) {
        console.log(
          `No valid, ungrouped tabs found for group "${trimmedGroupName}".`
        );
        continue;
      }

      const lowerGroupName = trimmedGroupName.toLowerCase();
      let targetGroupId = groupNameToIdMap.get(lowerGroupName);

      if (targetGroupId) {
        try {
          await chrome.tabs.group({
            groupId: targetGroupId,
            tabIds: validTabIds,
          });
          tabsAddedCount += validTabIds.length;
          console.log(
            `✅ Added ${validTabIds.length} tab(s) to existing group: "${trimmedGroupName}"`
          );
        } catch (e) {
          console.error(`Error adding tabs to group "${trimmedGroupName}":`, e);
          // *** FIX: Throw a robust error message ***
          const errorMsg = e?.message || String(e) || "Unknown error";
          throw new Error(
            `Failed to add tabs to "${trimmedGroupName}": ${errorMsg}`
          );
        }
      } else {
        try {
          const newGroupId = await chrome.tabs.group({ tabIds: validTabIds });
          const chosenColor = colors[colorIndex % colors.length];
          await chrome.tabGroups.update(newGroupId, {
            title: trimmedGroupName,
            color: chosenColor,
          });
          groupsCreatedCount++;
          successfulGroups.push(trimmedGroupName);
          colorIndex++;
          groupNameToIdMap.set(lowerGroupName, newGroupId);
          console.log(
            `✅ Created new group: "${trimmedGroupName}" with ${validTabIds.length} tabs.`
          );
        } catch (e) {
          console.error(`Error creating new group "${trimmedGroupName}":`, e);
          try {
            await chrome.tabs.ungroup(validTabIds);
          } catch {}

          // *** FIX: Throw a robust error message ***
          const errorMsg = e?.message || String(e) || "Unknown error";
          throw new Error(
            `Failed to create group "${trimmedGroupName}": ${errorMsg}`
          );
        }
      }
    }
    const success = groupsCreatedCount > 0 || tabsAddedCount > 0;
    return {
      success: success,
      groupsCreated: groupsCreatedCount,
      tabsAddedToExisting: tabsAddedCount,
      groups: successfulGroups,
      // *** THIS IS THE FIX: Add a default error if success is false ***
      error: success
        ? null
        : "No tabs were grouped. (They might be already grouped or no valid tabs found)",
    };
  } catch (error) {
    // *** FIX: This ensures a valid string is always returned ***
    const errorMessage =
      error?.message ||
      String(error) ||
      "An unknown error occurred in createMultipleGroups";
    console.error("Error in createMultipleGroups:", error);
    return { success: false, error: errorMessage };
  }
}

// Robust AI Response Parser
export const parseAIResponse = (responseString, tabs = []) => {
  if (!responseString || typeof responseString !== "string") {
    return {
      valid: false,
      error: "Invalid AI response input (not a string or empty).",
    };
  }
  try {
    const jsonMatch = responseString.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON object found in AI response:", responseString);
      return { valid: false, error: "No JSON object found in AI response." };
    }

    const potentialJson = jsonMatch[0];
    const data = JSON.parse(potentialJson);

    if (!data || typeof data !== "object") {
      throw new Error("Parsed data is not an object.");
    }
    if (!data.groups || typeof data.groups !== "object") {
      console.error(
        "Invalid format: 'groups' key missing or not an object.",
        data
      );
      return {
        valid: false,
        error: "Invalid format: 'groups' key missing or not an object.",
      };
    }

    const normalizedGroups = {};
    const allTabIdsFromInput = new Set((tabs || []).map((t) => t.id));

    for (const [rawName, ids] of Object.entries(data.groups)) {
      const groupName = String(rawName).trim();
      if (!groupName) continue;

      if (!Array.isArray(ids)) {
        console.warn(
          `Group "${groupName}" has invalid 'ids' (not an array), skipping.`
        );
        continue;
      }

      const validIds = [];
      for (const id of ids) {
        const numId = Number(id);
        if (!isNaN(numId) && allTabIdsFromInput.has(numId)) {
          validIds.push(numId);
        } else {
          console.warn(
            `Invalid or unexpected tab ID (${id}) found in group "${groupName}", skipping ID.`
          );
        }
      }

      if (validIds.length > 0) {
        normalizedGroups[groupName] = validIds;
      } else {
        console.log(
          `Group "${groupName}" ended up empty after validation, removing group.`
        );
      }
    }

    return {
      groups: normalizedGroups,
      explanation:
        typeof data.explanation === "string"
          ? data.explanation.trim()
          : "AI organized tabs.",
      valid: true,
    };
  } catch (err) {
    console.error(
      "Error parsing AI JSON response:",
      err,
      "Raw response:",
      responseString
    );
    return { valid: false, error: `JSON parsing failed: ${err.message}` };
  }
};

export const closeGroupTabs = async (title) => {
  try {
    const groups = await chrome.tabGroups.query({ title });
    if (groups.length === 0) {
      return { success: false, error: "Group not found" };
    }
    
    const group = groups[0];
    const tabs = await chrome.tabs.query({ groupId: group.id });
    const tabIds = tabs.map(tab => tab.id);
    
    if (tabIds.length > 0) {
      chrome.tabs.remove(tabIds);
    }
    // The group will be removed automatically when its last tab is closed.
    
    return { success: true, count: tabIds.length };
  } catch (err) {
    console.error("Error closing group tabs:", err);
    return { success: false, error: err.message };
  }
};
