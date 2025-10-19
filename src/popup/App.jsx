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
import { BotMessageSquare } from "lucide-react";
import { Sun } from "lucide-react";
import { Moon } from "lucide-react";
import { Boxes } from "lucide-react";
import Button from "../components/Button";
import { MessageCircleQuestionMark } from "lucide-react";
import { Sparkles } from "lucide-react";
import { SendHorizontal } from "lucide-react";
import { Folder } from "lucide-react";

export default function App() {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [aiStatus, setAiStatus] = useState("Initializing..");
  const [tabCount, setTabCount] = useState(0);
  const [isDark, setIsDark] = useState(true);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [groups, setGroups] = useState([]);
  const [renamingGroup, setRenamingGroup] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const sessionRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    initializeAI();
    updateTabCount();
    const savedTheme = localStorage.getItem("tabManagerTheme");
    if (savedTheme) setIsDark(savedTheme === "dark");
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
            systemPrompt: systemPrompt,
          });
          setAiStatus("ready");
          addMessage(aiReadyMessage, "system");
        } else {
          setAiStatus("unavailable");
          addMessage(aiUnavailableMessage, "system");
        }
      } else {
        setAiStatus("unavailable");
        addMessage(aiUnavailableMessage, "system");
      }
    } catch (err) {
      setAiStatus("error");
      addMessage(aiUnavailableMessage, "system");
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

  const loadGroups = async () => {
    const groupsList = await getAllGroups();
    setGroups(groupsList);
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

  const handleRenameStart = (group) => {
    setRenamingGroup(group.title);
    setNewGroupName(group.title);
  };

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
        await loadGroups();
        setShowGroupManager(true);
      }
    } catch (err) {
      setLoading(false);
      addMessage(`❌ Error: ${err.message}`, "bot");
    }
  };

  return (
    // Main container
    <div
      className={`w-[500px] h-[600px] ${
        isDark
          ? "bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900"
          : "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"
      } font-sans flex flex-col transition-all duration-500`}
    >
      {/* Header  */}
      <div
        className={`sticky top-0 h-40 px-6 py-4 ${
          isDark
            ? "bg-gradient-to-r from-slate-800/40 to-indigo-900/40 backdrop-blur-xl border-b border-white/10"
            : "bg-white/60 backdrop-blur-xl border-b border-indigo-200/50"
        }`}
      >
        {/* Whole top part of the popup header */}
        <div className="relative flex items-start justify-between mb-4">
          {/* Left side of the popup header */}
          <div className="flex flex-col justify-between items-start ">
            {/* Container for the icons and title  */}
            <div className="flex items-center justify-start w-[50vh] gap-4">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shadow-lg transform hover:scale-105 transition-transform
                ${isDark ? "text-white" : "text-black"}
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
            <div>
              <div className="flex items-center ml-13 w-[30vh] gap-2 mt-0.5">
                {/* Ready badge that weather changes based on aiStatus */}
                <div className="flex items-center animate-pulse justify-center gap-2 backdrop-blur-md px-4 py-1 rounded-xl">
                  {aiStatus === "ready" ? (
                    <span
                      className={`${
                        isDark ? "text-emerald-400" : "text-emerald-600"
                      } font-bold`}
                    >
                      Ready
                    </span>
                  ) : (
                    <span
                      className={`${
                        isDark ? "text-slate-400" : "text-black"
                      } font-bold`}
                    >
                      Unavailable
                    </span>
                  )}
                </div>
                <span
                  className={`text-xs font-medium backdrop-blur-md px-4 py-1 rounded-xl not-first: ${
                    isDark ? "text-yellow-300" : "text-yellow-600"
                  }`}
                >
                  {tabCount} Tabs Open
                </span>
              </div>
            </div>
          </div>

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

        {/* Quick Actions */}
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
            onClick={() => setPrompt("help")}
            disabled={loading}
            isDark={isDark}
            icon={MessageCircleQuestionMark}
            text="Help"
          />
          <Button
            onClick={quickOrganize}
            disabled={loading || aiStatus !== "ready"}
            isDark={isDark}
            icon={Sparkles}
            text="Smart Mode"
          />
        </div>
      </div>

      {showGroupManager ? (
        // The group manager view
        <div
          className={`w-[500px] h-[600px] overflow-x-hidden ${
            isDark
              ? "bg-gradient-to-br from-slate-900 via-gray-800 to-slate-900"
              : "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"
          } font-sans flex flex-col transition-all duration-500`}
        >
          {/* Group Manager Header */}
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

          {/* Groups List */}
          <div
            className={`flex-1 overflow-y-auto px-6 py-5 ${
              isDark ? "bg-slate-900/30" : "bg-white/30"
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
                    className={`p-4 rounded-xl transition-all hover:scale-[1.02] ${
                      isDark
                        ? "bg-slate-800/80 border border-slate-700/50 shadow-lg"
                        : "bg-white border border-slate-200 shadow-md"
                    }`}
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
                          className={`flex-1 px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 ${
                            isDark
                              ? "bg-slate-700 border border-slate-600 text-white focus:ring-purple-500/50"
                              : "bg-white border border-slate-300 text-slate-900 focus:ring-indigo-500/50"
                          }`}
                          autoFocus
                        />
                        <button
                          onClick={() => handleRenameSubmit(group.title)}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm font-semibold hover:shadow-lg transition-all"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setRenamingGroup(null)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
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
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-3 h-3 rounded-full ${
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
                            <h4
                              className={`font-bold text-base ${
                                isDark ? "text-white" : "text-slate-900"
                              }`}
                            >
                              {group.title}
                            </h4>
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              isDark
                                ? "bg-slate-700 text-slate-300"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {group.tabCount} tabs
                          </span>
                        </div>
                              
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRenameStart(group)}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-105 ${
                              isDark
                                ? "bg-indigo-600/80 hover:bg-indigo-600 text-white"
                                : "bg-indigo-500 hover:bg-indigo-600 text-white"
                            }`}
                          >
                            Rename
                          </button>
                          <button
                            onClick={() => handleUngroup(group.title)}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-105 ${
                              isDark
                                ? "bg-red-600/80 hover:bg-red-600 text-white"
                                : "bg-red-500 hover:bg-red-600 text-white"
                            }`}
                          >
                            🗑️ Ungroup
                          </button>
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
                  <div
                    key={i}
                    className="flex justify-end animate-slide-in-right"
                  >
                    <div
                      className="max-w-[15rem] px-4 py-2.5 rounded-2xl rounded-tr-md bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg text-sm leading-relaxed"
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
                    className={`max-w-[85%] px-2 py-1 rounded-2xl rounded-tl-md shadow-md text-sm leading-relaxed ${
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
