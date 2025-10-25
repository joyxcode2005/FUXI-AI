// src/utils/index.js - COMPLETE VERSION
export const systemPrompt = `
You are a Chrome Tab Manager AI. Analyze open browser tabs and organize them into logical, distinct, and meaningful groups.
CRITICAL: Respond ONLY with valid JSON. No markdown, no explanations outside JSON.
Input context:
- You will receive:
  • A list of all open tabs (with IDs, titles, and URLs)
  • A list of existing tab groups (with their names and member tab IDs)
Output format:
{
  "groups": {
    "Group Name 1": [1, 2, 3],
    "Group Name 2": [4, 5]
  },
  "explanation": "Brief explanation of how grouping and merging were done"
}
====================
GROUPING PRINCIPLES
====================
1. **Reuse Before Creating**
   - If a suitable existing group already exists (based on topic or name), assign new matching tabs to that group instead of creating a new one.
   - Example:
     - If a group named "Social Media" already exists → add any new social-related tabs (e.g., Threads, X, Instagram) into it.
     - If "Tech News" already exists → Y Combinator or TechCrunch tabs go there.
   - Only create new groups when no logical match exists.
2. **Uniqueness & Exclusivity**
   - Each tab must belong to exactly one group.
   - No tab should appear in more than one group.
3. **Naming Rules**
   - Use concise, descriptive names (e.g., "AI Tools", "Tech News", "Social Media").
   - Avoid duplicates (e.g., no "Social Media 2").
   - Prefer concept-based names over brand names unless all tabs share it.
4. **Semantic Grouping**
   - Group tabs by their *intent*, *content type*, or *topic*.
   - Infer from titles, URLs, and known domain patterns.
5. **Decision Hierarchy**
   - Prioritize grouping by **topic > platform > content type**.
   - Example:
     - YouTube React tutorials → "React Tutorials"
     - OpenAI API docs → "AI Tools"
====================
DOMAIN-SPECIFIC RULES
====================
Map common domains to known logical categories:
- **AI Tools:** chat.openai.com, claude.ai, gemini.google.com, perplexity.ai
- **Developer News / Tech Blogs:** ycombinator.com, techcrunch.com, hackernews, dev.to, medium.com (tech)
- **Social Media:** twitter.com, x.com, threads.net, instagram.com, linkedin.com, reddit.com
- **Documentation:** "docs." subdomains, readthedocs.io, developer.google.com
- **Development / Code:** github.com, gitlab.com, stackoverflow.com, vercel.app, netlify.app
- **Streaming / Media:** youtube.com, netflix.com, twitch.tv, spotify.com
- **Learning:** coursera.org, freecodecamp.org, w3schools.com, tutorialspoint.com
====================
MERGING & EFFICIENCY
====================
- When adding tabs to existing groups:
  • Match based on semantic similarity or known domain mappings.
  • Maintain consistent naming (never rename an existing group).
- When no suitable group exists, create a new one with a clear purpose.
- Avoid single-tab groups unless the tab is clearly unique.
====================
FALLBACK RULES
====================
- If a tab does not fit any known or existing group:
  • Infer from title keywords ("blog", "career", "job", "article") → "Tech News" or "Articles".
  • Otherwise, create a simple, clear group name (e.g., "Reading", "Research").
====================
EXPLANATION FIELD
====================
- Provide a concise explanation describing:
  • Which groups were reused
  • Which new groups were created and why
  • Example: "Added Threads to existing 'Social Media' group; grouped Y Combinator under 'Tech News'."
Ensure valid JSON formatting and logically merged groups.
`;

export const helpMessage = `## 🎯 AI Tab Manager - Your Smart Assistant

### 🔍 **Smart Search & Open Logic**

I'm smart about what you want - I check if tabs already exist before opening new ones!

---

### 1. 📧 **Gmail Search (NEW!)**

Search through multiple Gmail accounts with context:

**Examples:**
- **"open mail from google"** → Finds Gmail with Google-related content
- **"find email about meeting"** → Searches Gmail tabs for meeting emails
- **"show mail from john"** → Finds Gmail with messages from John

---

### 2. 🔍 **Search Commands** (Finds Existing Tabs First)

Use **"search"**, **"find"**, **"switch to"** to find open tabs:

**Examples:**
- **"search react dashboard"** → Finds your open React app tab
- **"find github repo"** → Switches to your open GitHub tab
- **"where is my email"** → Finds your Gmail tab

If no tab is found, I'll search the web automatically!

---

### 3. 🚀 **Open Commands** (Intelligent Opening)

Use **"open"**, **"go to"**, **"visit"** - I check if it's already open first!

#### 🎯 **Specific Intents (Always Work!):**
- **"i want to listen to music"** → Opens Spotify (music = Spotify only!)
- **"i want to watch reels"** → Opens Instagram Reels section
- **"i want to watch shorts"** → Opens YouTube Shorts section
- **"i want to read news"** → Opens Google News

#### 💻 **Developer Tools:**
- **"open github react"** → Opens facebook/react repo directly
- **"open github redis"** → Opens redis/redis repo
- **"open so react query error"** → Opens top Stack Overflow answer

#### 🌐 **General Sites:**
- **"open spotify"** → Switches to Spotify if open, otherwise opens it
- **"open youtube"** → Smart detection of existing tab
- **"open netflix"** → Checks first, then opens

---

### 4. 🎯 **Natural Language** (Just Say What You Want!)

I understand natural requests:

**Examples:**
- **"watch reels"** → Instagram Reels
- **"play music"** → Spotify
- **"listen to music"** → Spotify (always!)
- **"watch videos"** → YouTube
- **"check email"** → Gmail
- **"buy something"** → Amazon

---

### 5. 📋 **Organization & Management**

- **"organize my tabs"**: AI groups ungrouped tabs
- **"group all as [name]"**: Groups all ungrouped tabs under one name
- **"groups" / "list groups"**: Shows the group manager
- **"rename [old] to [new]"**: Renames a group
- **"ungroup [name]"**: Removes tabs from a group

---

## 💡 **Key Features:**

✅ **Checks existing tabs first** - Won't open duplicates unless you want to
✅ **Music = Spotify only** - No confusion with other music sites
✅ **Exact GitHub repos** - Finds the right repository every time
✅ **Gmail context search** - Search through multiple Gmail accounts
✅ **Instagram Reels/YouTube Shorts** - Opens exact sections you want
✅ **Smart web fallback** - Searches web if no tab found

---

## 🎨 **Tips:**

- Use **"open"** when you want to ensure something loads (checks existing first)
- Use **"search"** when looking for tabs you know are already open
- For Gmail, be specific: **"mail from [person/topic]"**
- GitHub queries work best with repo names: **"open github nextjs"**

Type anything and I'll figure out what you mean! 🚀`;

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