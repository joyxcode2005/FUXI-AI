export const systemPrompt = `You are a Chrome Tab Manager AI. Analyze open browser tabs and organize them into logical, distinct groups.

CRITICAL: Respond ONLY with valid JSON. No markdown, no explanations outside JSON.

Format:
{
  "groups": {
    "Group Name 1": [1, 2, 3],
    "Group Name 2": [4, 5]
  },
  "explanation": "Brief explanation of how the grouping was decided"
}

Grouping Rules:
- Tab IDs must be integers.
- Every tab must belong to exactly one group.
- Group names must be short, clear, and specific (e.g., "Messaging", "AI Platforms", "Documentation", "Entertainment").
- NEVER combine unrelated categories (❌ "Messaging/AI Platforms", ✅ "Messaging" and "AI Platforms" separately).
- Use only one clear concept per group name.
- If a tab does not fit an existing group, create a new one.
- Avoid overly generic group names like "Miscellaneous" unless absolutely necessary.
- Ensure all tabs are grouped logically and consistently.
`;

export const helpMessage = `
          📚 AI Commands:
              • organize my tabs
              • group tabs by topic

          🛠️ Manual Commands:
              • group all as <your group name>
              • rename <old group name> to <new group name>
              • ungroup <group name>
              • list groups

          💡Examples:
              • group all as Work
              • list groups
        `;

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
export async function groupExistingTabs(title, color = "blue") {
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
  const groupId = chrome.tabs.group({ tabIds });
  chrome.tabGroups.update(groupId, { title, color });
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

// Create multiple tab groups based on provided grouped tab IDs
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

  try {
    for (const [groupName, tabIds] of Object.entries(groupedTabs)) {
      if (tabIds.length > 0) {
        const validIds = await validateTabIds(tabIds);
        if (validIds.length === 0) continue;
        const groupId = await chrome.tabs.group({ tabIds: validIds });
        chrome.tabGroups.update(groupId, {
          title: groupName,
          color: colors[colorIndex % colors.length],
        });
        successfulGroups.push(groupName);
        colorIndex++;
      }
    }
    return {
      success: true,
      groupsCreated: successfulGroups.length,
      groups: successfulGroups,
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
