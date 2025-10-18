import { useState, useRef, useEffect } from "react";

// Validate and sanitize tab IDs
async function validateTabIds(tabIds) {
  const allTabs = await chrome.tabs.query({ currentWindow: true });
  const validTabIds = allTabs.map(t => t.id);
  
  // Convert to numbers and filter only valid, existing tabs
  return tabIds
    .map(id => typeof id === 'number' ? id : parseInt(id, 10))
    .filter(id => !isNaN(id) && validTabIds.includes(id));
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
  const successfulGroups = [];

  try {
    for (const [groupName, tabIds] of Object.entries(groupedTabs)) {
      if (tabIds.length > 0) {
        // Validate tab IDs before grouping
        const validIds = await validateTabIds(tabIds);
        
        if (validIds.length === 0) {
          console.warn(`No valid tabs for group: ${groupName}`);
          continue;
        }

        // Create the group
        const groupId = await chrome.tabs.group({ tabIds: validIds });
        
        // Set group title and color
        await chrome.tabGroups.update(groupId, {
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
      groups: successfulGroups
    };
  } catch (error) {
    console.error("Error creating groups:", error);
    return { success: false, error: error.message };
  }
}

async function groupExistingTabs(title, color = "blue") {
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
  
  if (groupableTabs.length === 0) {
    return { success: false, error: "No groupable tabs found" };
  }
  
  const tabIds = groupableTabs.map((t) => t.id);
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
    try {
      // Check if window.ai exists (Chrome built-in AI)
      if (LanguageModel) {
        const availability = await LanguageModel.availability();;
        
        if (availability === "available") {
          sessionRef.current = await LanguageModel.create({
            systemPrompt: `You are a Chrome Tab Manager AI. Analyze browser tabs and create logical groups.

CRITICAL: Respond ONLY with valid JSON. No markdown, no explanations outside JSON.

Format:
{
  "groups": {
    "Group Name 1": [1, 2, 3],
    "Group Name 2": [4, 5]
  },
  "explanation": "Brief explanation"
}

Rules:
- Tab IDs must be numbers
- Every tab must be in exactly one group
- Use clear, descriptive group names`
          });
          setAiStatus("ready");
          addMessage(
            "🤖 AI ready! Ask me to organize tabs or type 'help'.",
            "system"
          );
        } else if (availability.available === "after-download") {
          setAiStatus("downloading");
          addMessage(
            "⏳ Downloading Gemini Nano... This may take a few minutes. Manual commands work now!",
            "system"
          );
        } else {
          setAiStatus("unavailable");
          addMessage(
            "ℹ️ To enable AI features:\n1. Use Chrome Canary/Dev (127+)\n2. Go to chrome://flags\n3. Enable 'Prompt API for Gemini Nano'\n4. Enable 'Optimization Guide On Device Model'\n5. Restart Chrome\n\nManual commands work now!",
            "system"
          );
        }
      } else if (typeof LanguageModel !== 'undefined') {
        // Fallback to older API
        const availability = await LanguageModel.capabilities();
        
        if (availability.available === "readily") {
          sessionRef.current = await LanguageModel.create();
          setAiStatus("ready");
          addMessage("🤖 AI ready!", "system");
        } else {
          setAiStatus("unavailable");
          addMessage(
            "ℹ️ Enable AI in chrome://flags → Search 'Prompt API'\n\nManual commands work!",
            "system"
          );
        }
      } else {
        setAiStatus("unavailable");
        addMessage(
          "ℹ️ AI requires Chrome 127+ with flags enabled.\nManual commands work perfectly!",
          "system"
        );
      }
    } catch (err) {
      setAiStatus("error");
      addMessage(
        "ℹ️ AI unavailable. Manual commands work!\n\nTry: 'group all as Work' or 'help'",
        "system"
      );
      console.error("AI init error:", err);
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
      .map((tab) => `Tab ${tab.id}: "${tab.title}" - ${new URL(tab.url).hostname}`)
      .join("\n");

    const prompt = `Analyze ${tabs.length} tabs and group them logically.

Tabs:
${tabsList}

User wants: "${userRequest}"

Respond with ONLY this JSON format (no markdown, no code blocks):
{
  "groups": {
    "Group Name": [${tabs.slice(0, 3).map(t => t.id).join(', ')}]
  },
  "explanation": "Why grouped this way"
}

All tab IDs: ${tabs.map(t => t.id).join(', ')}
Include ALL tab IDs exactly once.`;

    const response = await sessionRef.current.prompt(prompt);
    return parseAIResponse(response, tabs);
  };

  const parseAIResponse = (response, tabs) => {
    try {
      // Remove markdown code blocks if present
      let cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Try to extract JSON
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in AI response");
      }

      const data = JSON.parse(jsonMatch[0]);

      if (!data.groups || typeof data.groups !== "object") {
        throw new Error("Invalid groups format");
      }

      // Ensure all IDs are numbers
      const normalizedGroups = {};
      for (const [groupName, ids] of Object.entries(data.groups)) {
        normalizedGroups[groupName] = ids.map(id => 
          typeof id === 'number' ? id : parseInt(id, 10)
        ).filter(id => !isNaN(id));
      }

      return {
        groups: normalizedGroups,
        explanation: data.explanation || "AI-generated grouping",
        valid: true,
      };
    } catch (err) {
      console.error("Failed to parse AI response:", err);
      console.log("Raw response:", response);
      return { valid: false, error: `Parse error: ${err.message}` };
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

      if (command.type === "help") {
        setLoading(false);
        addMessage(
          `📚 Available Commands:

🤖 AI Commands (when AI is ready):
• "organize my tabs"
• "group tabs by topic"
• "sort my tabs intelligently"

🔧 Manual Commands (always work):
• "group all as [name]" - Group everything
• "rename [old] to [new]" - Rename group
• "ungroup [name]" - Remove group
• "list groups" - Show all groups

💡 Examples:
• "group all as Work"
• "rename Social to Personal"
• "list groups"`,
          "bot"
        );
        return;
      }

      if (command.type === "listGroups") {
        const groups = await chrome.tabGroups.query({});
        setLoading(false);

        if (groups.length === 0) {
          addMessage("📋 No tab groups yet. Create some!", "bot");
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

      if (command.type === "groupAll") {
        const result = await groupExistingTabs(command.title);
        setLoading(false);
        if (result.success) {
          addMessage(
            `✅ Grouped ${result.count} tabs under "${command.title}"`,
            "bot"
          );
        } else {
          addMessage(`❌ ${result.error}`, "bot");
        }
        await updateTabCount();
        return;
      }

      if (command.type === "organize") {
        const tabs = await getAllTabs();

        if (tabs.length === 0) {
          setLoading(false);
          addMessage(
            "⚠️ No groupable tabs. Open some webpages first!",
            "bot"
          );
          return;
        }

        if (!sessionRef.current || aiStatus !== "ready") {
          setLoading(false);
          addMessage(
            `⚠️ AI not available. Try manual command:\n"group all as [name]"`,
            "bot"
          );
          return;
        }

        addMessage("🤖 AI analyzing tabs...", "system");

        const aiResult = await askAIToGroupTabs(tabs, text);

        if (!aiResult.valid) {
          setLoading(false);
          addMessage(`❌ AI error: ${aiResult.error}`, "bot");
          return;
        }

        addMessage(`💡 ${aiResult.explanation}`, "bot");

        const result = await createMultipleGroups(aiResult.groups);

        setLoading(false);
        
        if (result.success) {
          const summary = result.groups
            .map((name) => `• ${name}`)
            .join("\n");

          addMessage(
            `✅ Created ${result.groupsCreated} groups!\n\n${summary}`,
            "bot"
          );
          await updateTabCount();
        } else {
          addMessage(`❌ Error: ${result.error}`, "bot");
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
          "Try: 'group all as Work' or 'list groups'",
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
    if (aiStatus !== "ready") {
      addMessage("⚠️ AI not ready. Use manual commands instead!", "bot");
      return;
    }

    setLoading(true);
    addMessage("⚡ Quick organize starting...", "system");

    try {
      const tabs = await getAllTabs();

      if (tabs.length === 0) {
        addMessage("⚠️ No groupable tabs!", "bot");
        setLoading(false);
        return;
      }

      const aiResult = await askAIToGroupTabs(tabs, "organize intelligently");

      if (!aiResult.valid) {
        setLoading(false);
        addMessage(`❌ Error: ${aiResult.error}`, "bot");
        return;
      }

      const result = await createMultipleGroups(aiResult.groups);

      setLoading(false);
      
      if (result.success) {
        addMessage(
          `✅ Organized into ${result.groupsCreated} groups!`,
          "bot"
        );
        await updateTabCount();
      } else {
        addMessage(`❌ Error: ${result.error}`, "bot");
      }
    } catch (err) {
      setLoading(false);
      addMessage(`❌ Error: ${err.message}`, "bot");
    }
  };

  const handleReset = () => {
    setMessages([]);
    addMessage("🔄 Chat cleared!", "system");
  };

  const getStatusColor = () => {
    switch (aiStatus) {
      case "ready":
        return "#10b981";
      case "downloading":
        return "#3b82f6";
      case "unavailable":
        return "#f59e0b";
      default:
        return "#6b7280";
    }
  };

  const getStatusText = () => {
    switch (aiStatus) {
      case "ready":
        return `${tabCount} tabs • AI Ready ✓`;
      case "downloading":
        return `${tabCount} tabs • AI Downloading...`;
      case "unavailable":
        return `${tabCount} tabs • Manual Mode`;
      case "initializing":
        return `${tabCount} tabs • Starting...`;
      default:
        return `${tabCount} tabs • Manual Mode`;
    }
  };

  const quickActions = [
    {
      label: "📋 Groups",
      action: () => setPrompt("list groups"),
    },
    {
      label: "❓ Help",
      action: () => setPrompt("help"),
    },
    {
      label: "🔧 Enable AI",
      action: () => addMessage(
        "🚀 How to Enable Gemini Nano AI:\n\n1. Use Chrome Dev/Canary (127+)\n   Download: chrome.com/dev\n\n2. Enable flags:\n   • chrome://flags/#prompt-api-for-gemini-nano\n   • chrome://flags/#optimization-guide-on-device-model\n   Set both to 'Enabled'\n\n3. Restart Chrome\n\n4. AI will download automatically\n\n5. Reload this extension\n\nNote: Manual commands work without AI!",
        "bot"
      ),
      show: aiStatus !== "ready"
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
                {getStatusText()}
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
        {quickActions.filter(qa => qa.show !== false).map((qa, i) => (
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
          ⚡ Quick AI
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
              🤔 Thinking...
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
            placeholder="Try: 'group all as Work' or 'help'"
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