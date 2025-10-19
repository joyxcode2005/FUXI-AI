import { useState, useRef, useEffect } from "react";
import { systemPrompt } from "../utils";

// Validate and sanitize tab IDs
async function validateTabIds(tabIds) {
  const allTabs = await chrome.tabs.query({ currentWindow: true });
  const validTabIds = allTabs.map((t) => t.id);
  return tabIds
    .map((id) => (typeof id === "number" ? id : parseInt(id, 10)))
    .filter((id) => !isNaN(id) && validTabIds.includes(id));
}

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
        const validIds = await validateTabIds(tabIds);
        if (validIds.length === 0) continue;
        const groupId = await chrome.tabs.group({ tabIds: validIds });
        await chrome.tabGroups.update(groupId, {
          title: groupName,
          color: colors[colorIndex % colors.length],
        });
        successfulGroups.push(groupName);
        colorIndex++;
      }
    }
    return { success: true, groupsCreated: successfulGroups.length, groups: successfulGroups };
  } catch (error) {
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
  if (groupableTabs.length === 0) return { success: false, error: "No groupable tabs found" };
  const tabIds = groupableTabs.map((t) => t.id);
  const groupId = await chrome.tabs.group({ tabIds });
  await chrome.tabGroups.update(groupId, { title, color });
  return { success: true, count: tabIds.length };
}

async function renameGroup(oldTitle, newTitle) {
  const groups = await chrome.tabGroups.query({});
  const targetGroup = groups.find((g) => g.title.toLowerCase() === oldTitle.toLowerCase());
  if (targetGroup) {
    await chrome.tabGroups.update(targetGroup.id, { title: newTitle });
    return { success: true };
  }
  return { success: false, error: "Group not found" };
}

async function ungroupTabs(title) {
  const groups = await chrome.tabGroups.query({});
  const targetGroup = groups.find((g) => g.title.toLowerCase() === title.toLowerCase());
  if (targetGroup) {
    const tabs = await chrome.tabs.query({ groupId: targetGroup.id });
    await chrome.tabs.ungroup(tabs.map((t) => t.id));
    return { success: true, count: tabs.length };
  }
  return { success: false, error: "Group not found" };
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [aiStatus, setAiStatus] = useState("initializing");
  const [tabCount, setTabCount] = useState(0);
  const [isDark, setIsDark] = useState(true);
  const sessionRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    initializeAI();
    updateTabCount();
    const savedTheme = localStorage.getItem("tabManagerTheme");
    if (savedTheme) setIsDark(savedTheme === "dark");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    localStorage.setItem("tabManagerTheme", isDark ? "dark" : "light");
  }, [isDark]);

  const initializeAI = async () => {
    try {
      if (typeof LanguageModel !== "undefined") {
        const availability = await LanguageModel.availability();
        if (availability === "available") {
          sessionRef.current = await LanguageModel.create({
            systemPrompt: `You are a Chrome Tab Manager AI. Analyze browser tabs and create logical groups.
CRITICAL: Respond ONLY with valid JSON. No markdown, no explanations outside JSON.
Format: {"groups": {"Group Name": [1,2,3]}, "explanation": "Brief explanation"}
Rules: Tab IDs must be numbers, every tab in exactly one group, use clear names`,
          });
          setAiStatus("ready");
          addMessage("🤖 AI ready! Ask me to organize tabs or type 'help'.", "system");
        } else {
          setAiStatus("unavailable");
          addMessage("ℹ️ AI unavailable. Manual commands work perfectly!", "system");
        }
      } else {
        setAiStatus("unavailable");
        addMessage("ℹ️ Manual commands available. Type 'help' to see options!", "system");
      }
    } catch (err) {
      setAiStatus("error");
      addMessage("ℹ️ AI unavailable. Try: 'group all as Work' or 'help'", "system");
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
    return tabs
      .filter((tab) => {
        const url = tab.url || "";
        return (
          !url.startsWith("chrome://") &&
          !url.startsWith("chrome-extension://") &&
          !url.startsWith("edge://") &&
          !url.startsWith("about:")
        );
      })
      .map((tab) => ({ id: tab.id, title: tab.title, url: tab.url }));
  };

  const detectCommand = (text) => {
    const lower = text.toLowerCase();
    if (lower === "help" || lower === "commands") return { type: "help" };
    if (lower.includes("list group") || lower.includes("show group") || lower === "groups")
      return { type: "listGroups" };
    if (lower.includes("rename") && (lower.includes("to") || lower.includes("as"))) {
      const match = lower.match(/rename\s+(?:group\s+)?["']?(.+?)["']?\s+(?:to|as)\s+["']?(.+?)["']?$/);
      if (match) return { type: "rename", oldTitle: match[1].trim(), newTitle: match[2].trim() };
    }
    if (lower.includes("ungroup") || lower.includes("remove group")) {
      const match = lower.match(/(?:ungroup|remove group)\s+["']?(.+?)["']?$/);
      if (match) return { type: "ungroup", title: match[1].trim() };
    }
    if ((lower.includes("group all") || lower.includes("group everything")) && lower.includes("as")) {
      const match = lower.match(/(?:group all|group everything)\s+(?:as|under)\s+["']?(.+?)["']?$/);
      if (match) return { type: "groupAll", title: match[1].trim() };
    }
    if (
      lower.includes("group") ||
      lower.includes("organize") ||
      lower.includes("categorize") ||
      lower.includes("sort") ||
      lower.includes("arrange")
    )
      return { type: "organize" };
    return { type: "chat" };
  };

  const askAIToGroupTabs = async (tabs, userRequest) => {
    if (!sessionRef.current) throw new Error("AI session not available");
    const tabsList = tabs
      .map(
        (tab) => `Tab ${tab.id}: "${tab.title}" - ${new URL(tab.url).hostname}`
      )
      .join("\n");
    const response = await sessionRef.current.prompt(`Analyze ${tabs.length} tabs and group them logically.
Tabs: ${tabsList}
User wants: "${userRequest}"
Respond with ONLY JSON: {"groups": {"Name": [ids]}, "explanation": "text"}
All IDs: ${tabs.map((t) => t.id).join(", ")}`);
    return parseAIResponse(response, tabs);
  };

  const parseAIResponse = (response, tabs) => {
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
      return { groups: normalizedGroups, explanation: data.explanation || "AI-generated", valid: true };
    } catch (err) {
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

      if (command.type === "help") {
        setLoading(false);
        addMessage(
          `📚 Available Commands:

🤖 AI Commands:
• "organize my tabs"
• "group tabs by topic"

🔧 Manual Commands:
• "group all as [name]"
• "rename [old] to [new]"
• "ungroup [name]"
• "list groups"

💡 Examples:
• "group all as Work"
• "list groups"`,
          "bot"
        );
        return;
      }

      if (command.type === "listGroups") {
        const groups = await chrome.tabGroups.query({});
        setLoading(false);
        if (groups.length === 0) {
          addMessage("📋 No groups yet. Create some!", "bot");
        } else {
          const list = await Promise.all(
            groups.map(async (g) => {
              const tabs = await chrome.tabs.query({ groupId: g.id });
              return `📁 ${g.title || "Untitled"} (${tabs.length} tabs)`;
            })
          );
          addMessage(`📋 Current Groups:\n\n${list.join("\n")}`, "bot");
        }
        return;
      }

      if (command.type === "rename") {
        const result = await renameGroup(command.oldTitle, command.newTitle);
        setLoading(false);
        addMessage(
          result.success
            ? `✅ Renamed "${command.oldTitle}" → "${command.newTitle}"`
            : `❌ Group "${command.oldTitle}" not found`,
          "bot"
        );
        return;
      }

      if (command.type === "ungroup") {
        const result = await ungroupTabs(command.title);
        setLoading(false);
        addMessage(
          result.success ? `✅ Ungrouped ${result.count} tabs from "${command.title}"` : `❌ Group "${command.title}" not found`,
          "bot"
        );
        await updateTabCount();
        return;
      }

      if (command.type === "groupAll") {
        const result = await groupExistingTabs(command.title);
        setLoading(false);
        addMessage(
          result.success ? `✅ Grouped ${result.count} tabs under "${command.title}"` : `❌ ${result.error}`,
          "bot"
        );
        await updateTabCount();
        return;
      }

      if (command.type === "organize") {
        const tabs = await getAllTabs();
        if (tabs.length === 0) {
          setLoading(false);
          addMessage("⚠️ No groupable tabs. Open some webpages first!", "bot");
          return;
        }
        if (!sessionRef.current || aiStatus !== "ready") {
          setLoading(false);
          addMessage(`⚠️ AI not available. Try: "group all as [name]"`, "bot");
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
          addMessage(
            `✅ Created ${result.groupsCreated} groups!\n\n${result.groups.map((n) => `• ${n}`).join("\n")}`,
            "bot"
          );
          await updateTabCount();
        } else {
          addMessage(`❌ Error: ${result.error}`, "bot");
        }
        return;
      }

      if (sessionRef.current) {
        const response = await sessionRef.current.prompt(text);
        setLoading(false);
        addMessage(response, "bot");
      } else {
        setLoading(false);
        addMessage("Try: 'group all as Work' or 'help'", "bot");
      }
    } catch (err) {
      setLoading(false);
      addMessage(`❌ Error: ${err.message}`, "bot");
    }
  };

  const quickOrganize = async () => {
    if (aiStatus !== "ready") {
      addMessage("⚠️ AI not ready. Use manual commands!", "bot");
      return;
    }
    setLoading(true);
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
        addMessage(`✅ Organized into ${result.groupsCreated} groups!`, "bot");
        await updateTabCount();
      }
    } catch (err) {
      setLoading(false);
      addMessage(`❌ Error: ${err.message}`, "bot");
    }
  };

  return (
    <div
      className={`w-[400px] h-[600px] ${
        isDark
          ? "bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"
          : "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"
      } font-sans flex flex-col transition-all duration-500`}
    >
      {/* Header */}
      <div
        className={`relative px-6 py-4 ${
          isDark
            ? "bg-gradient-to-r from-purple-900/40 to-indigo-900/40 backdrop-blur-xl border-b border-white/10"
            : "bg-white/60 backdrop-blur-xl border-b border-indigo-200/50"
        }`}
      >
        {/* Decorative gradient orb */}
        <div
          className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full blur-3xl opacity-20 pointer-events-none"
        ></div>

        <div className="relative flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shadow-lg transform hover:scale-105 transition-transform"
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              }}
            >
              🤖
            </div>
            <div>
              <h3
                className={`text-lg font-bold tracking-tight ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                AI Tab Manager
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    aiStatus === "ready"
                      ? "bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/50"
                      : "bg-slate-400"
                  }`}
                ></div>
                <span
                  className={`text-xs font-medium ${
                    isDark ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  {tabCount} tabs • {aiStatus === "ready" ? "AI Active" : "Manual"}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsDark(!isDark)}
            className={`p-2.5 rounded-xl transition-all hover:scale-110 ${
              isDark
                ? "bg-white/10 hover:bg-white/20 text-yellow-300"
                : "bg-slate-200/50 hover:bg-slate-300/50 text-slate-700"
            }`}
            title="Toggle theme"
          >
            {isDark ? "☀️" : "🌙"}
          </button>
        </div>

        {/* Quick Actions */}
        <div className="relative flex gap-2">
          <button
            onClick={() => setPrompt("list groups")}
            disabled={loading}
            className={`flex-1 px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
              isDark
                ? "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                : "bg-white/80 hover:bg-white text-slate-700 border border-indigo-200"
            } ${
              loading ? "opacity-50 cursor-not-allowed" : "hover:shadow-md"
            }`}
          >
            📋 Groups
          </button>
          <button
            onClick={() => setPrompt("help")}
            disabled={loading}
            className={`flex-1 px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
              isDark
                ? "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                : "bg-white/80 hover:bg-white text-slate-700 border border-indigo-200"
            } ${
              loading ? "opacity-50 cursor-not-allowed" : "hover:shadow-md"
            }`}
          >
            ❓ Help
          </button>
          <button
            onClick={quickOrganize}
            disabled={loading || aiStatus !== "ready"}
            className={`flex-1 px-3 py-2 text-xs font-bold rounded-xl transition-all ${
              loading || aiStatus !== "ready"
                ? "bg-slate-400/30 cursor-not-allowed text-slate-500"
                : "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl hover:scale-105"
            }`}
          >
            ⚡ AI Sort
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div
        className={`flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-3 ${
          isDark ? "bg-slate-900/30" : "bg-white/30"
        }`}
      >
        {messages.map((msg, i) => {
          const isUser = msg.sender === "user";
          const isSystem = msg.sender === "system";

          if (isUser) {
            return (
              <div key={i} className="flex justify-end animate-slide-in-right">
                <div
                  className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-md bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg text-sm leading-relaxed"
                  style={{ wordWrap: "break-word" }}
                >
                  {msg.text}
                </div>
              </div>
            );
          }

          if (isSystem) {
            return (
              <div key={i} className="flex justify-center animate-fade-in">
                <div
                  className={`px-4 py-2 rounded-full text-xs font-medium ${
                    isDark
                      ? "bg-indigo-500/20 text-indigo-200 border border-indigo-500/30"
                      : "bg-indigo-100 text-indigo-700 border border-indigo-200"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          }

          return (
            <div key={i} className="flex justify-start animate-slide-in-left">
              <div
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tl-md shadow-md text-sm leading-relaxed ${
                  isDark
                    ? "bg-slate-800/80 text-slate-100 border border-slate-700/50"
                    : "bg-white text-slate-800 border border-slate-200"
                }`}
                style={{ wordWrap: "break-word", whiteSpace: "pre-wrap" }}
              >
                {msg.text}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start animate-pulse">
            <div
              className={`px-4 py-2.5 rounded-2xl rounded-tl-md flex items-center gap-2 text-sm ${
                isDark
                  ? "bg-slate-800/80 text-slate-300 border border-slate-700/50"
                  : "bg-white text-slate-600 border border-slate-200"
              }`}
            >
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-pink-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
              </div>
              <span>Thinking...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div
        className={`px-6 py-4 ${
          isDark
            ? "bg-gradient-to-r from-purple-900/40 to-indigo-900/40 backdrop-blur-xl border-t border-white/10"
            : "bg-white/60 backdrop-blur-xl border-t border-indigo-200/50"
        }`}
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleSend()}
            placeholder="Ask me to organize your tabs..."
            disabled={loading}
            className={`flex-1 px-4 py-3 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 ${
              isDark
                ? "bg-slate-800/50 border border-slate-700 text-white placeholder-slate-400 focus:ring-purple-500/50 focus:border-purple-500/50"
                : "bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:ring-indigo-500/50 focus:border-indigo-500"
            } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
          />
          <button
            onClick={handleSend}
            disabled={loading || !prompt.trim()}
            className={`px-5 py-3 rounded-xl font-semibold transition-all ${
              loading || !prompt.trim()
                ? "bg-slate-400/30 text-slate-500 cursor-not-allowed"
                : "bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl hover:scale-105"
            }`}
            title="Send message"
          >
            <span className="text-lg">✨</span>
          </button>
        </div>
      </div>

      {/* Custom Styles */}
      <style>{`
        @keyframes slide-in-right {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slide-in-left {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
        .animate-slide-in-left {
          animation: slide-in-left 0.3s ease-out;
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        /* Custom Scrollbar */
        .overflow-y-auto::-webkit-scrollbar {
          width: 6px;
        }
        .overflow-y-auto::-webkit-scrollbar-track {
          background: transparent;
        }
        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: ${isDark ? "rgba(139, 92, 246, 0.3)" : "rgba(99, 102, 241, 0.3)"};
          border-radius: 10px;
        }
        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: ${isDark ? "rgba(139, 92, 246, 0.5)" : "rgba(99, 102, 241, 0.5)"};
        }
      `}</style>
    </div>
  );
}
