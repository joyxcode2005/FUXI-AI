// Background service worker for tab grouping

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "createMultipleGroups") {
    handleMultipleGroups(request.groupedTabs)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Required for async response
  }

  if (request.action === "groupExistingTabs") {
    handleSingleGroup(request.groupTitle, request.tabIds)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Handle creating multiple tab groups
async function handleMultipleGroups(groupedTabs) {
  try {
    let groupsCreated = 0;
    const colors = ["blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];

    for (const [groupName, tabIds] of Object.entries(groupedTabs)) {
      if (tabIds.length > 0) {
        // Create the group
        const groupId = await chrome.tabs.group({ tabIds });

        // Set group title and color
        await chrome.tabGroups.update(groupId, {
          title: groupName,
          color: colors[groupsCreated % colors.length],
        });

        groupsCreated++;
      }
    }

    return {
      success: true,
      groupsCreated,
      message: `Created ${groupsCreated} tab groups`,
    };
  } catch (error) {
    console.error("Error creating groups:", error);
    return { success: false, error: error.message };
  }
}

// Handle creating a single tab group
async function handleSingleGroup(groupTitle, tabIds) {
  try {
    if (tabIds.length === 0) {
      return { success: false, error: "No tabs to group" };
    }

    // Create the group
    const groupId = await chrome.tabs.group({ tabIds });

    // Set group title and color
    await chrome.tabGroups.update(groupId, {
      title: groupTitle,
      color: "blue",
    });

    return {
      success: true,
      message: `Grouped ${tabIds.length} tabs into "${groupTitle}"`,
    };
  } catch (error) {
    console.error("Error creating group:", error);
    return { success: false, error: error.message };
  }
}

// Optional: Listen for tab updates to maintain groups
chrome.tabs.onCreated.addListener((tab) => {
  console.log("New tab created:", tab.id);
});

console.log("Background script loaded");