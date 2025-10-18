chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "groupExistingTabs") {
    const { groupTitle, tabIds } = message;

    (async () => {
      try {
        // Group existing tabs
        const groupId = await chrome.tabs.group({ tabIds });

        // Wait briefly to ensure stability
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Set title and color
        await chrome.tabGroups.update(groupId, {
          title: groupTitle,
          color: "blue",
        });

        sendResponse({ success: true, groupId });
      } catch (err) {
        console.error(err);
        sendResponse({ success: false, error: err.message });
      }
    })();

    return true; // Keep message channel open for async response
  }
});
