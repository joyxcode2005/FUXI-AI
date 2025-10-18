import { useState, useRef, useEffect } from "react";

// Core tab grouping functions
async function groupExistingTabs(title, color = "blue") {
  const tabs = await chrome.tabs.query({});
  const tabIds = tabs.map((t) => t.id);
  const groupId = await chrome.tabs.group({ tabIds });
  await chrome.tabGroups.update(groupId, { title, color });
  return { success: true, count: tabIds.length };
}

async function renameGroup(oldTitle, newTitle) {
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

async function ungroupTabs(title) {
  const groups = await chrome.tabGroups.query({});
  const targetGroup = groups.find(
    (g) => g.title.toLowerCase() === title.toLowerCase()
  );
  if (targetGroup) {
    const tabs = await chrome.tabs.query({ groupId: targetGroup.id });
    const tabIds = tabs.map((t) => t.id);
    await chrome.tabs.ungroup(tabIds);
    return { success: true, count: tabIds.length };
  }
  return { success: false, error: "Group not found" };
}

// Create multiple groups using Chrome API
async function createMultipleGroups(groupedTabs) {
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

  try {
    for (const [groupName, tabIds] of Object.entries(groupedTabs)) {
      if (tabIds.length > 0) {
        const groupId = await chrome.tabs.group({ tabIds });
        await chrome.tabGroups.update(groupId, {
          title: groupName,
          color: colors[colorIndex % colors.length],
        });
        colorIndex++;
      }
    }
    return { success: true, groupsCreated: Object.keys(groupedTabs).length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [aiStatus, setAiStatus] = useState("initializing");
  const [tabCount, setTabCount] = useState(0);
  const sessionRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    initializeAI();
    updateTabCount();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initializeAI = async () => {
    console.log("Initializing step:....")
    try {
      if (LanguageModel) {
        
        const availability = await LanguageModel.availability();
        console.log("Availibility: ", availability);
        if (availability === "available") {
          sessionRef.current = await LanguageModel.create({
            systemPrompt: `You are an expert Chrome Tab Manager AI. Your job is to analyze browser tabs and intelligently categorize them into meaningful groups.

When given a list of tabs with their titles and URLs, you should:
1. Analyze the content, purpose, and domain of each tab
2. Create logical, intuitive group names (like "Social Media", "Work Tools", "Shopping", "Entertainment", etc.)
3. Assign each tab to the most appropriate group
4. Be creative and context-aware - understand what users are actually doing

Always respond in this EXACT JSON format:
{
  "groups": {
    "Group Name 1": [1, 2, 3],
    "Group Name 2": [4, 5],
    "Group Name 3": [6, 7, 8]
  },
  "explanation": "Brief explanation of your grouping logic"
}

The numbers are tab IDs. Make sure every tab is assigned to exactly one group.`,
          });
          setAiStatus("ready");
          addMessage(
            "🤖 AI powered and ready! I'll analyze your tabs intelligently.\n\nType 'help' for commands or just ask me to organize!",
            "system"
          );
        } else {
          setAiStatus("unavailable");
          addMessage(
            "⚠️ Gemini Nano unavailable. Install Chrome Canary with AI features.",
            "system"
          );
        }
      } else {
        setAiStatus("demo");
        addMessage(
          "🎮 Demo mode - Simulating AI responses\n\nType 'help' for commands",
          "system"
        );
      }
    } catch (err) {
      setAiStatus("error");
      addMessage("⚠️ AI initialization failed. Using demo mode.", "system");
      console.error(err);
    }
  };

  const updateTabCount = async () => {
    try {
      const tabs = await getAllTabs();
      setTabCount(tabs.length);
    } catch (err) {
      console.error("Failed to count tabs:", err);
    }
  };

  const addMessage = (text, sender) => {
    setMessages((prev) => [...prev, { text, sender, timestamp: Date.now() }]);
  };

  const getAllTabs = async () => {
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

    return groupableTabs.map((tab) => ({
      id: tab.id,
      title: tab.title,
      url: tab.url,
    }));
  };

  const detectCommand = (text) => {
    const lower = text.toLowerCase();

    if (lower === "help" || lower === "commands") {
      return { type: "help" };
    }

    if (
      lower.includes("list group") ||
      lower.includes("show group") ||
      lower === "groups"
    ) {
      return { type: "listGroups" };
    }

    if (
      lower.includes("rename") &&
      (lower.includes("to") || lower.includes("as"))
    ) {
      const match = lower.match(
        /rename\s+(?:group\s+)?["']?(.+?)["']?\s+(?:to|as)\s+["']?(.+?)["']?$/
      );
      if (match)
        return {
          type: "rename",
          oldTitle: match[1].trim(),
          newTitle: match[2].trim(),
        };
    }

    if (lower.includes("ungroup") || lower.includes("remove group")) {
      const match = lower.match(/(?:ungroup|remove group)\s+["']?(.+?)["']?$/);
      if (match) return { type: "ungroup", title: match[1].trim() };
    }

    if (
      (lower.includes("group all") || lower.includes("group everything")) &&
      lower.includes("as")
    ) {
      const match = lower.match(
        /(?:group all|group everything)\s+(?:as|under)\s+["']?(.+?)["']?$/
      );
      if (match) return { type: "groupAll", title: match[1].trim() };
    }

    if (
      lower.includes("group") ||
      lower.includes("organize") ||
      lower.includes("categorize") ||
      lower.includes("sort") ||
      lower.includes("arrange")
    ) {
      return { type: "organize" };
    }

    return { type: "chat" };
  };

  const askAIToGroupTabs = async (tabs, userRequest) => {
    if (!sessionRef.current) {
      throw new Error("AI session not available");
    }

    const tabsList = tabs
      .map((tab) => `Tab ${tab.id}: "${tab.title}" - ${tab.url}`)
      .join("\n");

    const prompt = `User has ${
      tabs.length
    } browser tabs open and wants: "${userRequest}"

Here are the tabs:
${tabsList}

Analyze these tabs and create intelligent groups. Consider:
- What websites/services they are
- Common themes or purposes
- User's likely workflow or intent
- Domain patterns and content types

Respond with ONLY valid JSON in this format:
{
  "groups": {
    "Group Name": [tab_id1, tab_id2],
    "Another Group": [tab_id3, tab_id4]
  },
  "explanation": "Why you grouped them this way"
}

Make sure every tab ID (${tabs
      .map((t) => t.id)
      .join(", ")}) is included exactly once.`;

    const response = await sessionRef.current.prompt(prompt);
    return parseAIResponse(response, tabs);
  };

  const parseAIResponse = (response, tabs) => {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");

      const data = JSON.parse(jsonMatch[0]);

      if (!data.groups || typeof data.groups !== "object") {
        throw new Error("Invalid groups format");
      }

      // Validate all tab IDs are present
      const allTabIds = tabs.map((t) => t.id);
      const groupedIds = new Set();

      Object.values(data.groups).forEach((ids) => {
        ids.forEach((id) => groupedIds.add(id));
      });

      return {
        groups: data.groups,
        explanation: data.explanation || "AI-generated grouping",
        valid: true,
      };
    } catch (err) {
      console.error("Failed to parse AI response:", err);
      return { valid: false, error: err.message };
    }
  };

  const handleSend = async () => {
    const text = prompt.trim();
    if (!text || loading) return;

    addMessage(text, "user");
    setPrompt("");
    setLoading(true);

    try {
      const command = detectCommand(text);

      // Handle help
      if (command.type === "help") {
        setLoading(false);
        addMessage(
          `📚 Available Commands:

🤖 AI-Powered Organization:
• "organize my tabs" - Let AI analyze and group
• "group tabs by purpose" - AI categorizes by use
• "sort my tabs" - Smart AI organization

🔧 Manual Commands:
• "group all as [name]" - Group everything under one name
• "rename [old] to [new]" - Rename a group
• "ungroup [name]" - Remove a group
• "list groups" - Show all groups

💡 Examples:
• "organize my tabs intelligently"
• "group all as Research"  
• "rename Work to Projects"
• "ungroup Social Media"

Just describe what you want naturally!`,
          "bot"
        );
        return;
      }

      // Handle list groups
      if (command.type === "listGroups") {
        const groups = await chrome.tabGroups.query({});
        setLoading(false);

        if (groups.length === 0) {
          addMessage(
            "📋 No tab groups found. Organize your tabs first!",
            "bot"
          );
        } else {
          const groupList = await Promise.all(
            groups.map(async (group) => {
              const tabs = await chrome.tabs.query({ groupId: group.id });
              return `📁 ${group.title || "Untitled"} (${tabs.length} tabs)`;
            })
          );

          addMessage(`📋 Current Groups:\n\n${groupList.join("\n")}`, "bot");
        }
        return;
      }

      // Handle rename
      if (command.type === "rename") {
        const result = await renameGroup(command.oldTitle, command.newTitle);
        setLoading(false);
        if (result.success) {
          addMessage(
            `✅ Renamed "${command.oldTitle}" → "${command.newTitle}"`,
            "bot"
          );
        } else {
          addMessage(`❌ Group "${command.oldTitle}" not found`, "bot");
        }
        return;
      }

      // Handle ungroup
      if (command.type === "ungroup") {
        const result = await ungroupTabs(command.title);
        setLoading(false);
        if (result.success) {
          addMessage(
            `✅ Ungrouped ${result.count} tabs from "${command.title}"`,
            "bot"
          );
        } else {
          addMessage(`❌ Group "${command.title}" not found`, "bot");
        }
        await updateTabCount();
        return;
      }

      // Handle group all
      if (command.type === "groupAll") {
        const result = await groupExistingTabs(command.title);
        setLoading(false);
        addMessage(
          `✅ Grouped all ${result.count} tabs under "${command.title}"`,
          "bot"
        );
        await updateTabCount();
        return;
      }

      // Handle organize (AI-powered)
      if (command.type === "organize") {
        const tabs = await getAllTabs();

        if (tabs.length === 0) {
          setLoading(false);
          addMessage(
            "⚠️ No groupable tabs found. Open some webpages first!",
            "bot"
          );
          return;
        }

        if (!sessionRef.current) {
          console.log(sessionRef.current);
          setLoading(false);
          addMessage(
            "⚠️ AI not available. Try 'group all as [name]' instead.",
            "bot"
          );
          return;
        }

        // Ask AI to analyze and group
        addMessage("🤖 Analyzing your tabs with AI...", "system");

        const aiResult = await askAIToGroupTabs(tabs, text);

        if (!aiResult.valid) {
          setLoading(false);
          addMessage(`❌ AI grouping failed: ${aiResult.error}`, "bot");
          return;
        }

        setLoading(false);
        addMessage(`💡 ${aiResult.explanation}`, "bot");

        // Create the groups using Chrome API
        const result = await createMultipleGroups(aiResult.groups);

        if (result.success) {
          const summary = Object.entries(aiResult.groups)
            .map(([name, ids]) => `• ${name}: ${ids.length} tabs`)
            .join("\n");

          addMessage(
            `✅ Created ${result.groupsCreated} groups!\n\n${summary}`,
            "bot"
          );
          await updateTabCount();
        } else {
          addMessage(`❌ Failed to create groups: ${result.error}`, "bot");
        }
        return;
      }

      // Chat mode
      if (sessionRef.current) {
        const response = await sessionRef.current.prompt(text);
        setLoading(false);
        addMessage(response, "bot");
      } else {
        setLoading(false);
        addMessage(
          "I can help organize your tabs! Try:\n• 'organize my tabs'\n• 'group all as Work'",
          "bot"
        );
      }
    } catch (err) {
      setLoading(false);
      addMessage(`❌ Error: ${err.message}`, "bot");
      console.error(err);
    }
  };

  const quickOrganize = async () => {
    setLoading(true);
    addMessage("⚡ Quick AI organization starting...", "system");

    try {
      const tabs = await getAllTabs();

      if (tabs.length === 0) {
        addMessage("⚠️ No groupable tabs found!", "bot");
        setLoading(false);
        return;
      }

      if (!sessionRef.current) {
        addMessage("⚠️ AI not available for quick organize.", "bot");
        setLoading(false);
        return;
      }

      const aiResult = await askAIToGroupTabs(tabs, "organize intelligently");

      if (!aiResult.valid) {
        setLoading(false);
        addMessage(`❌ Quick organize failed: ${aiResult.error}`, "bot");
        return;
      }

      const result = await createMultipleGroups(aiResult.groups);

      if (result.success) {
        const summary = Object.entries(aiResult.groups)
          .map(([name, ids]) => `• ${name}: ${ids.length} tabs`)
          .join("\n");

        setLoading(false);
        addMessage(
          `✅ Quick organized into ${result.groupsCreated} groups!\n\n${summary}`,
          "bot"
        );
        await updateTabCount();
      } else {
        setLoading(false);
        addMessage(`❌ Error: ${result.error}`, "bot");
      }
    } catch (err) {
      setLoading(false);
      addMessage(`❌ Error: ${err.message}`, "bot");
    }
  };

  const handleReset = () => {
    setMessages([]);
    addMessage("🔄 Chat cleared. Ready to organize your tabs!", "system");
  };

  const getStatusColor = () => {
    switch (aiStatus) {
      case "ready":
        return "#10b981";
      case "demo":
        return "#f59e0b";
      case "unavailable":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const quickActions = [
    {
      label: "🤖 AI Organize",
      action: () => setPrompt("organize my tabs intelligently"),
    },
    {
      label: "📋 List Groups",
      action: () => setPrompt("list groups"),
    },
    {
      label: "❓ Help",
      action: () => setPrompt("help"),
    },
  ];

  return (
    <div
      style={{
        width: 380,
        height: 580,
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        fontFamily: "'Inter', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "rgba(255,255,255,0.15)",
          backdropFilter: "blur(10px)",
          padding: "16px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.2)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 24 }}>🤖</div>
          <div style={{ flex: 1 }}>
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                color: "#fff",
                fontWeight: 700,
              }}
            >
              AI Tab Manager
            </h3>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 4,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: getStatusColor(),
                  boxShadow: `0 0 8px ${getStatusColor()}`,
                }}
              />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.9)" }}>
                {tabCount} tabs • {aiStatus}
              </span>
            </div>
          </div>
          <button
            onClick={handleReset}
            style={{
              padding: "6px 12px",
              fontSize: 11,
              border: "1px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div
        style={{
          padding: "12px 16px",
          background: "rgba(0,0,0,0.1)",
          display: "flex",
          gap: 8,
          overflowX: "auto",
        }}
      >
        {quickActions.map((qa, i) => (
          <button
            key={i}
            onClick={qa.action}
            disabled={loading}
            style={{
              padding: "6px 12px",
              fontSize: 11,
              border: "1px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              borderRadius: 20,
              cursor: loading ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              fontWeight: 500,
            }}
          >
            {qa.label}
          </button>
        ))}
        <button
          onClick={quickOrganize}
          disabled={loading || aiStatus !== "ready"}
          style={{
            padding: "6px 12px",
            fontSize: 11,
            border: "none",
            background:
              loading || aiStatus !== "ready"
                ? "rgba(255,255,255,0.3)"
                : "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
            color: "#fff",
            borderRadius: 20,
            cursor: loading || aiStatus !== "ready" ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
            fontWeight: 600,
            boxShadow:
              !loading && aiStatus === "ready"
                ? "0 4px 12px rgba(245,87,108,0.4)"
                : "none",
          }}
        >
          ⚡ Quick
        </button>
      </div>

      {/* Chat Area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.sender === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                borderRadius:
                  msg.sender === "user"
                    ? "16px 16px 4px 16px"
                    : "16px 16px 16px 4px",
                maxWidth: "80%",
                background:
                  msg.sender === "user"
                    ? "rgba(255,255,255,0.95)"
                    : msg.sender === "system"
                    ? "rgba(0,0,0,0.2)"
                    : "rgba(255,255,255,0.85)",
                color:
                  msg.sender === "user"
                    ? "#1f2937"
                    : msg.sender === "system"
                    ? "#fff"
                    : "#1f2937",
                fontSize: 13,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                backdropFilter: "blur(10px)",
                boxShadow:
                  msg.sender === "user"
                    ? "0 4px 12px rgba(0,0,0,0.15)"
                    : "0 2px 8px rgba(0,0,0,0.1)",
                fontWeight: msg.sender === "system" ? 500 : 400,
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-start",
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "16px 16px 16px 4px",
                background: "rgba(255,255,255,0.85)",
                color: "#6b7280",
                fontSize: 13,
              }}
            >
              🤔 AI thinking...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div
        style={{
          padding: 16,
          background: "rgba(0,0,0,0.15)",
          backdropFilter: "blur(10px)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleSend()}
            placeholder="Ask AI to organize your tabs..."
            disabled={loading}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 24,
              border: "none",
              background: "rgba(255,255,255,0.95)",
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !prompt.trim()}
            style={{
              padding: "12px 20px",
              border: "none",
              background:
                loading || !prompt.trim()
                  ? "rgba(255,255,255,0.3)"
                  : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              borderRadius: 24,
              cursor: loading || !prompt.trim() ? "not-allowed" : "pointer",
              fontSize: 20,
              fontWeight: 600,
              boxShadow:
                !loading && prompt.trim()
                  ? "0 4px 12px rgba(102,126,234,0.4)"
                  : "none",
            }}
          >
            ✨
          </button>
        </div>
      </div>
    </div>
  );
}
