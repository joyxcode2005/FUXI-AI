import { useState, useRef, useEffect } from "react";
import {
  aiReadyMessage,
  aiUnavailableMessage,
  createMultipleGroups,
  getAllGroups,
  groupExistingTabs,
  helpMessage,
  parseAIResponse,
  renameGroup,
  systemPrompt,
  ungroupTabs,
} from "../utils";
import ReactMarkdown from "react-markdown";
import { BotMessageSquare } from "lucide-react";
import { Sun } from "lucide-react";
import { Moon } from "lucide-react";
import { Boxes } from "lucide-react";
import Button from "../components/Button";
import { MessageCircleQuestionMark } from "lucide-react";
import { SendHorizontal } from "lucide-react";
import { Folder } from "lucide-react";
import { Pencil } from "lucide-react";
import { Trash2 } from "lucide-react";
import ToggleButton from "../components/ToggleButton";

export default function App() {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [aiStatus, setAiStatus] = useState("Checking...");
  const [tabCount, setTabCount] = useState(0);
  const [isDark, setIsDark] = useState(true);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [groups, setGroups] = useState([]);
  const [renamingGroup, setRenamingGroup] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const sessionRef = useRef(null);
  const chatEndRef = useRef(null);
  const proofreaderRef = useRef(null);

  useEffect(() => {
    chrome.storage.local.get("autoGroupingEnabled", (data) => {
      setEnabled(data.autoGroupingEnabled ?? true);
    });
  }, []);

  // User effect to trigger on component mount
  useEffect(() => {
    // Load persisted messages from Chrome storage
    chrome.storage.local.get("chatMessages", (data) => {
      if (data.chatMessages && Array.isArray(data.chatMessages)) {
        setMessages(data.chatMessages);
      } else {
        // Only add welcome message if no chat history exists
        setMessages([
          {
            text: "👋 Welcome to AI Tab Manager! Type 'help' to see what I can do.",
            sender: "system",
            timestamp: Date.now(),
          },
        ]);
      }
    });

    initializeAI();
    initializeProofreaderAI();
    updateTabCount();
    const savedTheme = localStorage.getItem("tabManagerTheme");
    if (savedTheme) setIsDark(savedTheme === "dark");

    checkBackgroundAIStatus();
    chrome.storage.local.get("autoGroupingEnabled", (data) => {
      setEnabled(data.autoGroupingEnabled ?? true); // default ON
    });
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save theme preference
  useEffect(() => {
    localStorage.setItem("tabManagerTheme", isDark ? "dark" : "light");
  }, [isDark]);

  // Auto-handle help prompt
  useEffect(() => {
    if (prompt === "help") handleSend();
  }, [prompt]);

  // Toggle auto-grouping feature
  const toggleFeature = () => {
    const newValue = !enabled;
    setEnabled(newValue);
    chrome.storage.local.set({ autoGroupingEnabled: newValue });
  };

  const checkBackgroundAIStatus = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "getAIStatus",
      });
      if (response && response.status === "ready") {
        setAiStatus("ready");
      }
    } catch (err) {
      console.log("Background check failed:", err);
    }
  };

  // Initialize AI session
  const initializeAI = async () => {
    try {
      if (typeof LanguageModel !== "undefined") {
        const availability = await LanguageModel.availability();
        if (availability === "available") {
          sessionRef.current = await LanguageModel.create({
            systemPrompt: systemPrompt,
          });
          setAiStatus("ready");
        } else {
          setAiStatus("unavailable");
        }
      } else {
        setAiStatus("unavailable");
      }
    } catch (err) {
      setAiStatus("error");
      addMessage(aiUnavailableMessage, "system");
    }
  };

  // Initialize Proofreader AI
  const initializeProofreaderAI = async () => {
    try {
      if (typeof Proofreader !== "undefined") {
        proofreaderRef.current = await Proofreader.create({
          expectedInputLanguages: ["en"],
        });
        console.log("✅ Proofreader AI initialized");
      }
    } catch (error) {
      console.error("❌ Proofreader AI initialization failed:", err);
    }
  };

  // Update tab count excluding special tabs
  const updateTabCount = async () => {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const validTabs = tabs.filter((tab) => {
        const url = tab.url || "";
        return (
          !url.startsWith("chrome://") &&
          !url.startsWith("chrome-extension://") &&
          !url.startsWith("edge://") &&
          !url.startsWith("about:")
        );
      });
      setTabCount(validTabs.length);
    } catch (err) {
      console.error("Failed to count tabs:", err);
    }
  };

  // Load groups from storage
  const loadGroups = async () => {
    const groupsList = await getAllGroups();
    setGroups(groupsList);
  };

  // Add message to chat
  const addMessage = (text, sender) => {
    setMessages((prev) => {
      const newMessages = [...prev, { text, sender, timestamp: Date.now() }];
      // Save messages to Chrome storage for persistence
      chrome.storage.local.set({ chatMessages: newMessages });
      return newMessages;
    });
  };

  // Get all tabs with filtering options
  const getAllTabs = async (includeGrouped = false) => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    return tabs
      .filter((tab) => {
        const url = tab.url || "";
        const ok =
          !url.startsWith("chrome://") &&
          !url.startsWith("chrome-extension://") &&
          !url.startsWith("edge://") &&
          !url.startsWith("about:");
        if (!ok) return false;
        if (
          !includeGrouped &&
          tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE
        )
          return false;
        return true;
      })
      .map((tab) => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        groupId: tab.groupId,
      }));
  };

  // Detect command from user input
  const detectCommand = (text) => {
    const lower = text.toLowerCase();
    if (lower === "help" || lower === "commands") return { type: "help" };
    if (
      lower.includes("list group") ||
      lower.includes("show group") ||
      lower === "groups"
    )
      return { type: "listGroups" };
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
    )
      return { type: "organize" };
    return { type: "chat" };
  };

  // Ask AI to group tabs based on user request
  const askAIToGroupTabs = async (tabs, userRequest) => {
    if (!sessionRef.current) throw new Error("AI session not available");
    const tabsList = tabs
      .map(
        (tab) => `Tab ${tab.id}: "${tab.title}" - ${new URL(tab.url).hostname}`
      )
      .join("\n");
    const response = await sessionRef.current.prompt(`Analyze ${
      tabs.length
    } tabs and group them logically.
      Tabs: ${tabsList}
      User wants: "${userRequest}"
      Respond with ONLY JSON: {"groups": {"Name": [ids]}, "explanation": "text"}
      All IDs: ${tabs.map((t) => t.id).join(", ")}`);
    return parseAIResponse(response, tabs);
  };

  // Handle ungrouping of tabs
  const handleUngroup = async (groupTitle) => {
    const result = await ungroupTabs(groupTitle);
    if (result.success) {
      addMessage(
        `✅ Ungrouped ${result.count} tabs from "${groupTitle}"`,
        "bot"
      );
      await loadGroups();
      await updateTabCount();
    } else {
      addMessage(`❌ Failed to ungroup "${groupTitle}"`, "bot");
    }
  };

  // Handle renaming of group
  const handleRenameStart = (group) => {
    setRenamingGroup(group.title);
    setNewGroupName(group.title);
  };

  // Submit rename group request
  const handleRenameSubmit = async (oldTitle) => {
    if (!newGroupName.trim() || newGroupName === oldTitle) {
      setRenamingGroup(null);
      return;
    }
    const result = await renameGroup(oldTitle, newGroupName);
    if (result.success) {
      addMessage(`✅ Renamed "${oldTitle}" → "${newGroupName}"`, "bot");
      await loadGroups();
    } else {
      addMessage(`❌ Failed to rename group`, "bot");
    }
    setRenamingGroup(null);
    setNewGroupName("");
  };

  // Handle sending user prompt
  const handleSend = async () => {
    let text = prompt.trim();
    if (!text || loading) return;
    addMessage(text, "user");
    setPrompt("");
    setLoading(true);

    // Using proofreader api to correct input
    try {
      if (proofreaderRef.current) {
        try {
          const result = await proofreaderRef.current.proofread(text);
          text = result.correctedInput;
        } catch (err) {
          console.warn("Proofreader failed:", err);
        }
      }

      const command = detectCommand(text);

      if (command.type === "help") {
        setLoading(false);
        addMessage(helpMessage, "bot");
        return;
      }

      if (command.type === "listGroups") {
        await loadGroups();
        setLoading(false);
        setShowGroupManager(true);
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
          result.success
            ? `✅ Ungrouped ${result.count} tabs from "${command.title}"`
            : `❌ Group "${command.title}" not found`,
          "bot"
        );
        await updateTabCount();
        return;
      }

      if (command.type === "groupAll") {
        const result = await groupExistingTabs(command.title);
        setLoading(false);
        addMessage(
          result.success
            ? `✅ Grouped ${result.count} tabs under "${command.title}"`
            : `❌ ${result.error}`,
          "bot"
        );
        await updateTabCount();
        await loadGroups();
        setShowGroupManager(true);
        return;
      }

      if (command.type === "organize") {
        const tabs = await getAllTabs(false);
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
            `✅ Created ${result.groupsCreated} groups!\n\n${result.groups
              .map((n) => `• ${n}`)
              .join("\n")}`,
            "bot"
          );
          await updateTabCount();
          await loadGroups();
          setShowGroupManager(true);
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
    try {
      const response = await chrome.runtime.sendMessage({
        action: "organizeNow",
      });
      if (response && response.success) {
        addMessage("✅ Background service is organizing your tabs!", "bot");
        setTimeout(async () => {
          await updateTabCount();
          await loadGroups();
        }, 2000);
      } else {
        addMessage("⚠️ Could not trigger background organization", "bot");
      }
    } catch (err) {
      addMessage(`❌ Error: ${err.message}`, "bot");
    }
  };

  // Handle help command
  const handleHelp = () => {
    setPrompt("help");
  };

  // Clear chat history
  const clearChat = () => {
    setMessages([]);
    chrome.storage.local.remove("chatMessages");
  };

  return (
    <div
      className={`w-[500px] h-[600px] ${
        isDark
          ? "bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900"
          : "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"
      } font-sans flex flex-col transition-all duration-500`}
    >
      <div
        className={`sticky top-0 h-40 px-6 py-4 ${
          isDark
            ? "bg-gradient-to-tl from-gray-900/40 to-cyan-700/40 backdrop-blur-xl border-b border-white/10"
            : "bg-white/60 backdrop-blur-xl border-b border-indigo-200/50"
        }`}
      >
        <div className="relative flex items-center justify-between mb-4">
          <div className="flex flex-col justify-between items-start ">
            <div className="flex items-center justify-start w-[50vh] gap-4">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shadow-lg transform hover:scale-105 transition-transform text-black bg-gradient-to-bl from-amber-400 via-yellow-500 to-orange-600
                `}
              >
                <BotMessageSquare />
              </div>
              <h3
                className={`text-lg font-bold tracking-tight ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                AI TAB MANAGER
              </h3>
            </div>
            <div className="flex items-center ml-13 w-[40vh] gap-2 mt-0.5">
              <div
                className={`flex items-center justify-center gap-2 backdrop-blur-md px-4 py-1 rounded-xl
                ${isDark ? "bg-transparent text-yell" : "bg-gray-200"}
                    backdrop-blur-xl
                `}
              >
                {aiStatus === "ready" ? (
                  <span
                    className={`${
                      isDark ? "text-emerald-400" : "text-emerald-600"
                    } font-bold`}
                  >
                    Auto-Active
                  </span>
                ) : (
                  <span
                    className={`${
                      isDark ? "text-slate-400" : "text-black"
                    } font-bold`}
                  >
                    {aiStatus}
                  </span>
                )}
              </div>
              <span
                className={`text-xs font-bold px-4 py-1 rounded-xl not-first:  
                    ${
                      isDark
                        ? "bg-transparent text-yellow-500"
                        : "bg-gray-200 text-red-400"
                    }
                    backdrop-blur-xl
                    `}
              >
                {tabCount} Tabs Open
              </span>
            </div>
          </div>
          <div className="w-35 flex items-center gap-5">
            <ToggleButton
              enabled={enabled}
              onChange={toggleFeature}
              isDark={isDark}
            />
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-2 rounded-xl transition-all hover:scale-110 cursor-pointer ${
                isDark ? "text-yellow-300" : "text-slate-700"
              }`}
              title="Toggle theme"
            >
              {isDark ? <Sun /> : <Moon />}
            </button>
          </div>
        </div>

        <div className="relative flex gap-2">
          {showGroupManager ? (
            <Button
              onClick={() => setShowGroupManager(false)}
              disabled={loading}
              isDark={isDark}
              icon={BotMessageSquare}
              text={"Chat"}
            />
          ) : (
            <Button
              onClick={async () => {
                await loadGroups();
                setShowGroupManager(true);
              }}
              disabled={loading}
              isDark={isDark}
              icon={Boxes}
              text="Groups"
            />
          )}

          <Button
            onClick={() => {
              setShowGroupManager(false);
              handleHelp();
              setTimeout(() => {
                chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
              }, 50);
            }}
            disabled={loading}
            isDark={isDark}
            icon={MessageCircleQuestionMark}
            text="Help"
          />
          <Button
            onClick={async () => quickOrganize()}
            disabled={loading}
            isDark={isDark}
            icon={BotMessageSquare}
            text="Organize Now"
          />
          <Button
            onClick={clearChat}
            disabled={loading}
            isDark={isDark}
            icon={Trash2}
            text="Clear Chat"
          />
        </div>
      </div>

      {showGroupManager ? (
        <div
          className={`w-[500px] h-[600px] overflow-x-hidden ${
            isDark
              ? "bg-gradient-to-br from-gray-900 via-cyan-900 to-black"
              : "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"
          } font-sans flex flex-col transition-all duration-500`}
        >
          <div
            className={`flex justify-between items-center px-6 py-4 border-b border-slate-300/20 `}
          >
            <h3
              className={`text-xl uppercase font-bold tracking-tight ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Tab Groups
            </h3>
            <span
              className={`text-xs font-medium backdrop-blur-2xl bg-yellow-500 animate-pulse text-white px-4 py-1 rounded-xl `}
            >
              {groups.length > 1
                ? `${groups.length} groups`
                : `${groups.length} group`}
            </span>
          </div>

          <div
            className={`flex-1 overflow-y-auto px-6 py-5 ${
              isDark ? "" : "bg-white/30"
            }`}
          >
            {groups.length === 0 ? (
              <div className="flex flex-col gap-2 items-center justify-center h-full">
                <Folder
                  className={` ${isDark ? "text-white" : "text-black"}`}
                />
                <p
                  className={`text-center text-lg font-bold mono ${
                    isDark ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  No groups yet. Create some!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className="rounded-xl transition-all hover:scale-[1.02]"
                  >
                    {renamingGroup === group.title ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              handleRenameSubmit(group.title);
                            if (e.key === "Escape") setRenamingGroup(null);
                          }}
                          className={`flex-1 px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${
                            isDark
                              ? "bg-slate-700 border border-slate-600 text-white "
                              : "bg-white border border-slate-300 text-slate-900"
                          }`}
                          autoFocus
                        />
                        <button
                          onClick={() => handleRenameSubmit(group.title)}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-lime-500 to-green-500 text-white text-sm font-semibold hover:shadow-lg transition-all hover:bg-lime-200 cursor-pointer"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setRenamingGroup(null)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                            isDark
                              ? "bg-slate-700 text-white hover:bg-slate-600"
                              : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                          }`}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <div
                          className={`flex justify-between items-center p-4 rounded-2xl shadow-sm border transition-all ${
                            isDark
                              ? "bg-slate-800 border-slate-700 hover:border-slate-600"
                              : "bg-white border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-3 h-3 mt-1 rounded-full ${
                                group.color === "blue"
                                  ? "bg-blue-500"
                                  : group.color === "red"
                                  ? "bg-red-500"
                                  : group.color === "yellow"
                                  ? "bg-yellow-500"
                                  : group.color === "green"
                                  ? "bg-green-500"
                                  : group.color === "pink"
                                  ? "bg-pink-500"
                                  : group.color === "purple"
                                  ? "bg-purple-500"
                                  : group.color === "cyan"
                                  ? "bg-cyan-500"
                                  : "bg-orange-500"
                              }`}
                            ></div>

                            <div className="flex flex-col">
                              <h4
                                className={`font-semibold text-base leading-tight ${
                                  isDark ? "text-white" : "text-slate-900"
                                }`}
                              >
                                {group.title}
                              </h4>
                              <span
                                className={`text-xs mt-1 px-2 py-0.5 rounded-md w-fit ${
                                  isDark
                                    ? "bg-slate-700 text-slate-300"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {group.tabCount}{" "}
                                {group.tabCount === 1 ? "tab" : "tabs"}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRenameStart(group)}
                              className={`p-2 rounded-lg transition-all hover:scale-110 cursor-pointer ${
                                isDark
                                  ? "bg-green-600/80 hover:bg-green-600 text-white"
                                  : "bg-green-500 hover:bg-green-600 text-white"
                              }`}
                            >
                              <Pencil size={16} />
                            </button>

                            <button
                              onClick={() => handleUngroup(group.title)}
                              className={`p-2 rounded-lg transition-all hover:scale-110 cursor-pointer ${
                                isDark
                                  ? "bg-red-600/80 hover:bg-red-600 text-white"
                                  : "bg-red-500 hover:bg-red-600 text-white"
                              }`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div
            className={`flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-3 ${
              isDark
                ? "bg-gradient-to-br from-gray-900 via-cyan-900 to-black"
                : "bg-white/30"
            }`}
          >
            {messages.map((msg, i) => {
              const isUser = msg.sender === "user";
              const isSystem = msg.sender === "system";

              if (isUser) {
                return (
                  <div
                    key={i}
                    className="flex justify-end animate-slide-in-right"
                  >
                    <div
                      className={`max-w-[15rem] px-4 py-2.5 rounded-2xl rounded-tr-md shadow-lg text-sm leading-relaxed font-semibold
                        ${
                          isDark
                            ? "bg-gradient-to-bl from-green-600 to-cyan-800 text-white border border-purple-500/30"
                            : "bg-gradient-to-bl from-white to-cyan-100 text-slate-900 border border-indigo-200"
                        }
                        `}
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
                <div
                  key={i}
                  className="flex justify-start animate-slide-in-left"
                >
                  <div
                    className={`max-w-[90%] px-4 py-2 rounded-2xl rounded-tl-md shadow-md text-sm ${
                      isDark
                        ? "bg-slate-800/80 text-slate-100 border border-slate-700/50"
                        : "bg-white text-slate-800 border border-slate-200"
                    }`}
                    style={{
                      wordWrap: "break-word",
                      whiteSpace: "preserve-breaks",
                    }}
                  >
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
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

          <div
            className={`px-6 py-4 ${
              isDark
                ? "bg-gradient-to-tl from-gray-900/40 to-cyan-700/40 backdrop-blur-xl border-b border-white/10"
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
                className={`flex-1 px-4 py-3 rounded-xl text-sm transition-all outline-none focus:ring-2 focus:ring-cyan-500 ${
                  isDark
                    ? "bg-slate-800/50 border border-slate-700 text-white placeholder-slate-400 "
                    : "bg-white border border-slate-300 text-slate-900 placeholder-slate-400 "
                } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
              />
              <button
                onClick={handleSend}
                disabled={loading || !prompt.trim()}
                className={`px-5 py-3 rounded-xl font-semibold transition-all  ${
                  loading || !prompt.trim()
                    ? "bg-slate-400/30 text-slate-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-green-500 to-green-600 cursor-pointer text-white hover:shadow-lg hover:scale-105"
                }`}
                title="Send message"
              >
                <span className="text-lg">
                  <SendHorizontal />
                </span>
              </button>
            </div>
          </div>
        </>
      )}

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

        .overflow-y-auto::-webkit-scrollbar {
          width: 6px;
        }
        .overflow-y-auto::-webkit-scrollbar-track {
          background: transparent;
        }
        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: ${
            isDark ? "rgba(139, 92, 246, 0.3)" : "rgba(99, 102, 241, 0.3)"
          };
          border-radius: 10px;
        }
        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: ${
            isDark ? "rgba(139, 92, 246, 0.5)" : "rgba(99, 102, 241, 0.5)"
          };
        }
      `}</style>
    </div>
  );
}
