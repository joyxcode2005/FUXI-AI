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

export const helpMessage = `## 🎯 AI Tab Manager - Complete Guide

### 🌐 **Open New Sites with Natural Language** (ENHANCED!)
Just tell me what you want to do!

**Activity-Based:**
- **"I want to watch reels"** → Opens Instagram Reels
- **"I want to watch shorts"** → Opens YouTube Shorts
- **"watch videos"** → Opens YouTube
- **"listen to music"** → Opens Spotify
- **"shop for clothes"** → Opens Amazon
- **"read news"** → Opens Google News
- **"check email"** → Opens Gmail

**Direct Site Opening:**
- **"open youtube"** → Opens YouTube
- **"visit github"** → Opens GitHub
- **"go to stackoverflow"** → Opens Stack Overflow

💡 AI understands your intent - just say what you want!

### 🔍 **Smart Search** (Email-Aware!)
Find and switch to existing tabs with powerful search!

**General Search:**
- **"gmail"** → Opens your Gmail tab
- **"react docs"** → Finds React documentation
- **"shopping cart"** → Finds shopping tabs

**Email-Specific Search:**
- **"email from john"** → Finds emails from John
- **"email about meeting"** → Finds emails with "meeting" in subject
- **"mail from support"** → Finds support emails
- **"email regarding invoice"** → Searches email subjects

💡 **Searches work across:**
- Tab titles
- Page content (automatically indexed)
- Email subjects, senders, and content
- URLs

### 📁 **Organization**
- **"organize my tabs"** → AI groups all tabs intelligently
- **"group all as Work"** → Group all tabs under one name
- **"groups"** → View all your groups

### ✏️ **Management**
- **"rename [old name] to [new name]"** → Rename a group
- **"ungroup [name]"** → Remove grouping
- **"list groups"** → Show all groups

### 💬 **Chat**
Ask me anything about your tabs or browsing!

---
**✨ Pro Tips:**
- Content is automatically indexed as you browse
- Email subjects and senders are specially indexed for Gmail
- Use natural language - "I want to..." or "show me..."
- Activity keywords: watch, listen, play, read, shop, check
- No "open" keyword = searches existing tabs
- With "open" keyword = creates new tab`;

export const aiReadyMessage = `
  🤖 AI is ready! Ask me to organize tabs or type help.
`;

export const aiUnavailableMessage = `
  ℹ️ AI unavailable. Manual commands work perfectly!
`;

// Fetch all tab groups along with their tab counts
export async function getAllGroups() {
  const groups = await chrome.tabGroups.query({});
  const groupsWithTabs = await Promise.all(
    groups.map(async (g) => {
      const tabs = await chrome.tabs.query({ groupId: g.id });
      return {
        id: g.id,
        title: g.title || "Untitled",
        color: g.color,
        tabCount: tabs.length,
      };
    })
  );
  return groupsWithTabs;
}

// Get existing groups with full details (for smart grouping)
export async function getExistingGroupsWithTabs() {
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

// Ungroup tabs from a specified group title
export async function ungroupTabs(title) {
  const groups = await chrome.tabGroups.query({});
  const targetGroup = groups.find(
    (g) => g.title.toLowerCase() === title.toLowerCase()
  );
  if (targetGroup) {
    const tabs = await chrome.tabs.query({ groupId: targetGroup.id });
    chrome.tabs.ungroup(tabs.map((t) => t.id));
    return { success: true, count: tabs.length };
  }
  return { success: false, error: "Group not found" };
}

// Rename a tab group
export async function renameGroup(oldTitle, newTitle) {
  const groups = await chrome.tabGroups.query({});
  const targetGroup = groups.find(
    (g) => g.title.toLowerCase() === oldTitle.toLowerCase()
  );
  if (targetGroup) {
    await chrome.tabGroups.update(targetGroup.id, { title: newTitle });
    return { success: true };
  }
  return { success: false, error: "Group not found" };
}

// Group existing tabs by IDs into a new group with specified title and color
export async function groupExistingTabs(title, color = "red") {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const groupableTabs = tabs.filter((tab) => {
    const url = tab.url || "";
    return (
      !url.startsWith("chrome://") &&
      !url.startsWith("chrome-extension://") &&
      !url.startsWith("edge://") &&
      !url.startsWith("about:")
    );
  });
  if (groupableTabs.length === 0)
    return { success: false, error: "No groupable tabs found" };
  
  const tabIds = groupableTabs.map((t) => t.id);
  
  const groupId = await chrome.tabs.group({ tabIds });
  await chrome.tabGroups.update(groupId, { title, color });
  
  return { success: true, count: tabIds.length };
}

// Validate and sanitize tab IDs
async function validateTabIds(tabIds) {
  const allTabs = await chrome.tabs.query({ currentWindow: true });
  const validTabIds = allTabs.map((t) => t.id);
  return tabIds
    .map((id) => (typeof id === "number" ? id : parseInt(id, 10)))
    .filter((id) => !isNaN(id) && validTabIds.includes(id));
}

// Create multiple tab groups based on provided grouped tab IDs (enhanced with merging)
export async function createMultipleGroups(groupedTabs) {
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
  let colorIndex = 0;
  const successfulGroups = [];
  let tabsAddedToExisting = 0;

  try {
    // Get existing groups
    const existingGroups = await getExistingGroupsWithTabs();
    const existingGroupMap = new Map();
    existingGroups.forEach(g => {
      existingGroupMap.set(g.title.toLowerCase(), g);
    });

    for (const [groupName, tabIds] of Object.entries(groupedTabs)) {
      if (tabIds.length > 0) {
        const validIds = await validateTabIds(tabIds);
        if (validIds.length === 0) continue;

        // Check if this group already exists
        const existingGroup = existingGroupMap.get(groupName.toLowerCase());

        if (existingGroup) {
          // Add to existing group
          await chrome.tabs.group({ 
            groupId: existingGroup.id, 
            tabIds: validIds 
          });
          tabsAddedToExisting += validIds.length;
          console.log(`✅ Added ${validIds.length} tab(s) to existing group: ${groupName}`);
        } else {
          // Create new group
          const groupId = await chrome.tabs.group({ tabIds: validIds });
          chrome.tabGroups.update(groupId, {
            title: groupName,
            color: colors[colorIndex % colors.length],
          });
          successfulGroups.push(groupName);
          colorIndex++;
        }
      }
    }

    return {
      success: true,
      groupsCreated: successfulGroups.length,
      groups: successfulGroups,
      tabsAddedToExisting
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Function to parse AI response safely
export const parseAIResponse = (response, tabs) => {
  try {
    let cleaned = response.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const data = JSON.parse(jsonMatch[0]);
    if (!data.groups) throw new Error("Invalid format");
    const normalizedGroups = {};
    for (const [name, ids] of Object.entries(data.groups)) {
      normalizedGroups[name] = ids
        .map((id) => (typeof id === "number" ? id : parseInt(id, 10)))
        .filter((id) => !isNaN(id));
    }
    return {
      groups: normalizedGroups,
      explanation: data.explanation || "AI-generated",
      valid: true,
    };
  } catch (err) {
    return { valid: false, error: err.message };
  }
};