// Utility functions for intelligent tab matching and categorization

// Common domain patterns for quick categorization
export const domainPatterns = {
  "Social Media": [
    "facebook.com",
    "twitter.com",
    "x.com",
    "instagram.com",
    "linkedin.com",
    "reddit.com",
    "tiktok.com",
    "snapchat.com",
    "pinterest.com",
  ],
  Development: [
    "github.com",
    "stackoverflow.com",
    "gitlab.com",
    "bitbucket.org",
    "npmjs.com",
    "codepen.io",
    "codesandbox.io",
    "replit.com",
  ],
  Documentation: [
    "docs.",
    "documentation",
    "developer.",
    "dev.",
    "api.",
    "reference",
    "wiki",
  ],
  Shopping: [
    "amazon.com",
    "ebay.com",
    "walmart.com",
    "target.com",
    "etsy.com",
    "shopify.com",
    "alibaba.com",
  ],
  Entertainment: [
    "youtube.com",
    "netflix.com",
    "spotify.com",
    "twitch.tv",
    "hulu.com",
    "disneyplus.com",
    "primevideo.com",
  ],
  News: [
    "news",
    "bbc.com",
    "cnn.com",
    "nytimes.com",
    "theguardian.com",
    "reuters.com",
    "apnews.com",
  ],
  Productivity: [
    "notion.so",
    "trello.com",
    "asana.com",
    "slack.com",
    "discord.com",
    "zoom.us",
    "meet.google.com",
  ],
  Email: ["mail.google.com", "outlook.live.com", "yahoo.com/mail", "protonmail"],
};

// Smart tab matcher that uses both AI suggestions and domain patterns
export function smartMatchTabs(tabs, aiGroups) {
  const groupedTabs = {};
  const unmatchedTabs = [];

  // Initialize groups from AI suggestions
  aiGroups.forEach((group) => {
    groupedTabs[group.name] = [];
  });

  tabs.forEach((tab) => {
    const tabText = (tab.title + " " + tab.url).toLowerCase();
    let matched = false;

    // First try domain pattern matching for common categories
    for (const [category, patterns] of Object.entries(domainPatterns)) {
      if (patterns.some((pattern) => tab.url.includes(pattern))) {
        // Check if AI suggested a similar category
        const matchingGroup = aiGroups.find(
          (g) =>
            g.name.toLowerCase().includes(category.toLowerCase()) ||
            category.toLowerCase().includes(g.name.toLowerCase())
        );

        if (matchingGroup) {
          groupedTabs[matchingGroup.name].push(tab.id);
          matched = true;
          break;
        }
      }
    }

    // If not matched by domain, try AI keyword matching
    if (!matched) {
      let bestMatch = null;
      let bestScore = 0;

      aiGroups.forEach((group) => {
        let score = 0;
        group.keywords.forEach((keyword) => {
          if (tabText.includes(keyword.toLowerCase())) score++;
        });
        if (score > bestScore) {
          bestScore = score;
          bestMatch = group.name;
        }
      });

      if (bestMatch && bestScore > 0) {
        groupedTabs[bestMatch].push(tab.id);
        matched = true;
      }
    }

    if (!matched) {
      unmatchedTabs.push(tab);
    }
  });

  return { groupedTabs, unmatchedTabs };
}

// Extract keywords from AI response more intelligently
export function extractGroupsFromAI(aiResponse) {
  const groups = [];
  const lines = aiResponse.split("\n").filter((l) => l.trim());

  let currentGroup = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect group headers (bold, numbered, or ending with colon)
    const groupMatch = line.match(
      /^(?:\d+\.\s*)?(?:\*\*)?([A-Z][^:*\n]+?)(?:\*\*)?:?$/
    );

    if (groupMatch && line.length < 50) {
      // Save previous group
      if (currentGroup && currentGroup.keywords.length > 0) {
        groups.push(currentGroup);
      }

      // Start new group
      const groupName = groupMatch[1].trim();
      currentGroup = {
        name: groupName,
        keywords: [groupName.toLowerCase()],
      };
    } else if (currentGroup) {
      // Extract keywords from description
      const keywords = line
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !["tabs", "group", "with", "that"].includes(w));

      currentGroup.keywords.push(...keywords);
    }
  }

  // Add last group
  if (currentGroup && currentGroup.keywords.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

// Analyze tabs and suggest categories automatically
export function suggestCategories(tabs) {
  const suggestions = {};

  // Count matches for each category
  Object.keys(domainPatterns).forEach((category) => {
    const matches = tabs.filter((tab) =>
      domainPatterns[category].some((pattern) => tab.url.includes(pattern))
    );

    if (matches.length > 0) {
      suggestions[category] = matches.map((t) => t.id);
    }
  });

  return suggestions;
}