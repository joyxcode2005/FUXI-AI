// src/popup/App.jsx - OPTIMIZED VERSION
import { useState, useRef, useEffect, useCallback } from "react";
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
import { SendHorizontal } from "lucide-react";
import { Folder } from "lucide-react";
import { Pencil } from "lucide-react";
import { Trash2 } from "lucide-react";
import ToggleButton from "../components/ToggleButton";
import LanguageDropdown from "../components/DropdownButton";
import { memo } from "react";
import { Ungroup } from "lucide-react";

const TranslatedText = memo(function TranslatedText({
  msg,
  language,
  translatorSession,
}) {
  const [translated, setTranslated] = useState(msg?.text || "...");

  useEffect(() => {
    if (!msg?.text || !translatorSession) {
      setTranslated(msg.text);
      return;
    }

    if (language.code === "en") {
      setTranslated(msg.text);
      return;
    }

    let isCancelled = false;

    (async () => {
      try {
        const result = await translatorSession.translate(msg.text);
        if (!isCancelled) setTranslated(result);
      } catch (err) {
        console.error("Translation error:", err);
        if (!isCancelled) setTranslated(msg.text);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [msg?.text, language, translatorSession]);

  return <div>{translated}</div>;
});

export default function App() {
  const [title, setTitle] = useState("AI TABS");
  const [active, setActive] = useState("Auto-Active");
  const [tabsText, setTabsText] = useState("Tabs Open");
  const [group, setGroup] = useState("Groups");
  const [help, setHelp] = useState("Help");
  const [organise, setOrganise] = useState("Organise Now");
  const [clear, setClear] = useState("Clear Chat");

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
  const [language, setLanguage] = useState({ name: "English", code: "en" });
  const [enabled, setEnabled] = useState(true);

  const sessionRef = useRef(null);
  const chatEndRef = useRef(null);
  const proofreaderRef = useRef(null);
  const [languageSession, setLanguageSession] = useState(null);

  useEffect(() => {
    chrome.storage.local.get("autoGroupingEnabled", (data) => {
      setEnabled(data.autoGroupingEnabled ?? true);
    });
  }, []);

  useEffect(() => {
    chrome.storage.local.get("chatMessages", (data) => {
      if (data.chatMessages && Array.isArray(data.chatMessages)) {
        setMessages(data.chatMessages);
      } else {
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

    chrome.storage.local.get("tabManagerTheme", (data) => {
      if (data.tabManagerTheme) {
        setIsDark(data.tabManagerTheme === "dark");
      }
    });

    checkBackgroundAIStatus();
    chrome.storage.local.get("autoGroupingEnabled", (data) => {
      setEnabled(data.autoGroupingEnabled ?? true);
    });
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    chrome.storage.local.set({ tabManagerTheme: isDark ? "dark" : "light" });
  }, [isDark]);

  useEffect(() => {
    if (prompt === "help") handleSend();
  }, [prompt]);

  const onChangeLanguage = async (lang) => {
    const prevLangCode = language?.code ?? "en";

    setLanguage(lang);

    if (lang.code === "en") {
      setLanguageSession(null);

      setTitle("AI TAB MANAGER");
      setActive("Auto-Active");
      setTabsText("Tabs Open");
      setGroup("Groups");
      setHelp("Help");
      setOrganise("Organise Now");
      setClear("Clear Chat");
      return;
    }

    const newLanguageSession = await initializeLanguageChangeAI(
      lang,
      prevLangCode
    );

    console.log("Selected Language:", lang);
    console.log("Previous Language Code (used as source):", prevLangCode);
    console.log("Language Session:", newLanguageSession);

    try {
      if (newLanguageSession) {
        const [
          newTitle,
          newActive,
          newTabsText,
          newGroup,
          newHelp,
          newOrganise,
          newClear,
        ] = await Promise.all([
          newLanguageSession.translate("AI TAB MANAGER"),
          newLanguageSession.translate("Auto-Active"),
          newLanguageSession.translate("Tabs Open"),
          newLanguageSession.translate("Groups"),
          newLanguageSession.translate("Help"),
          newLanguageSession.translate("Organise Now"),
          newLanguageSession.translate("Clear Chat"),
        ]);

        setTitle(newTitle);
        setActive(newActive);
        setTabsText(newTabsText);
        setGroup(newGroup);
        setHelp(newHelp);
        setOrganise(newOrganise);
        setClear(newClear);
      }
    } catch (error) {
      console.error("Language change failed:", error);
    }
  };

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

  const initializeAI = async () => {
    try {
      if (typeof LanguageModel !== "undefined") {
        const availability = await LanguageModel.availability();
        if (availability === "available") {
          sessionRef.current = await LanguageModel.create({
            initialPrompts:[{role:"system",content:systemPrompt}]
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

  const initializeProofreaderAI = async () => {
    try {
      if (typeof Proofreader !== "undefined") {
        proofreaderRef.current = await Proofreader.create({
          expectedInputLanguages: ["en"],
        });
        console.log("✅ Proofreader AI initialized");
      }
    } catch (error) {
      console.error("❌ Proofreader AI initialization failed:", error);
    }
  };

  const initializeLanguageChangeAI = async (
    targetLanguage,
    sourceLanguage = "en"
  ) => {
    try {
      if (typeof Translator !== "undefined") {
        const session = await Translator.create({
          sourceLanguage: sourceLanguage,
          targetLanguage: targetLanguage.code,
        });
        console.log(
          "✅ Language Change AI initialized (",
          sourceLanguage,
          "→",
          targetLanguage.code,
          ")"
        );
        setLanguageSession(session);
        return session;
      }
      return null;
    } catch (error) {
      console.error("❌ Language Change AI initialization failed:", error);
      setLanguageSession(null);
      return null;
    }
  };

  const updateTabCount = useCallback(async () => {
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
  }, []);

  const loadGroups = useCallback(async () => {
    const groupsList = await getAllGroups();
    setGroups(groupsList);
  }, []);

  const addMessage = useCallback((text, sender) => {
    setMessages((prev) => {
      const newMessages = [...prev, { text, sender, timestamp: Date.now() }];
      chrome.storage.local.set({ chatMessages: newMessages });
      return newMessages;
    });
  }, []);

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
        windowId: tab.windowId,
      }));
  };

  const detectCommand = (text) => {
    const lower = text.toLowerCase().trim();
    if (lower === "help" || lower === "commands") return { type: "help" };

    const gmailPatterns = [
      /^(open|show|find|search)\s+(mail|email|gmail)\s+(?:from|about|with|by|regarding|to)?\s*(.+)/i,
      /^(mail|email|gmail)\s+(?:from|about|with|by|regarding|to)?\s*(.+)/i,
      /^(open|show|find|search)\s+(.+)\s+(mail|email|gmail)$/i
    ];
    
    for (const pattern of gmailPatterns) {
      const match = text.match(pattern);
      if (match) {
        const emailContext = match[match.length - 1];
        return { 
          type: "emailSearch",
          query: emailContext.trim(),
          originalText: text 
        };
      }
    }

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
      const match = text.match(
        /rename\s+(?:group\s+)?["']?(.+?)["']?\s+(?:to|as)\s+["']?(.+?)["']?$/i
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

    return { type: "dynamicSearchOrOpen", query: text };
  };

  async function searchGmailTabs(emailContext) {
    try {
      console.log(`📧 Searching Gmail tabs for: "${emailContext}"`);
      
      const tabs = await chrome.tabs.query({});
      const gmailTabs = tabs.filter(tab => {
        const url = tab.url || "";
        return url.includes("mail.google.com") && !url.includes("chrome://");
      });

      if (gmailTabs.length === 0) {
        return { found: false, error: "No Gmail tabs open" };
      }
      console.log(`Found ${gmailTabs.length} Gmail tabs`);

      const candidates = await queryFuse(emailContext, 20);
      const gmailCandidates = candidates.filter(c => 
        c.url && c.url.includes("mail.google.com")
      );

      if (gmailCandidates.length > 0) {
        console.log(`[App.jsx] Found ${gmailCandidates.length} Gmail candidates via Fuse`);
        let selectedTab = gmailCandidates[0];
        
        if (sessionRef.current && aiStatus === "ready" && gmailCandidates.length > 1) {
          try {
            const ranking = await rankWithAI(emailContext, gmailCandidates, 5, sessionRef);
            if (ranking.confidence === "high" || ranking.confidence === "medium") {
              selectedTab = gmailCandidates[ranking.chosenIndex];
            }
          } catch (err) {
            console.error("AI ranking failed:", err);
          }
        }

        await chrome.tabs.update(selectedTab.id, { active: true });
        await chrome.windows.update(selectedTab.windowId, { focused: true });
        
        return { 
          found: true, 
          title: selectedTab.title, 
          url: selectedTab.url,
          matchCount: gmailCandidates.length 
        };
      }

      console.warn("[App.jsx] Fuse found no Gmail matches. Manually searching snippets...");
      const contextLower = emailContext.toLowerCase();
      const allCandidates = await queryFuse("", 1000);

      let manualMatch = null;
      for (const tab of gmailTabs) {
        const indexedData = allCandidates.find(c => c.id === tab.id);
        if (!indexedData) continue;

        const title = (indexedData.title || "").toLowerCase();
        const snippet = (indexedData.snippet || "").toLowerCase();

        if (title.includes(contextLower) || snippet.includes(contextLower)) {
          console.log(`[App.jsx] Manual fallback found match in Tab ${tab.id} (snippet: ${snippet.length} chars)`);
          manualMatch = indexedData;
          break;
        }
      }

      if (manualMatch) {
        await chrome.tabs.update(manualMatch.id, { active: true });
        await chrome.windows.update(manualMatch.windowId, { focused: true });
        return { 
          found: true, 
          title: manualMatch.title, 
          url: manualMatch.url,
          matchCount: 1,
          method: "snippet-fallback"
        };
      }

      return { found: false, error: "No matching Gmail found", gmailCount: gmailTabs.length };
    } catch (err) {
      console.error("Gmail search error:", err);
      return { found: false, error: err.message };
    }
  }

  async function checkExistingTab(query) {
    try {
      const tabs = await chrome.tabs.query({});
      const lowerQuery = query.toLowerCase();
      
      const exactMatch = tabs.find(tab => {
        const url = tab.url || "";
        try {
          const hostname = new URL(url).hostname.replace(/^www\./, "");
          return hostname === lowerQuery || 
                 hostname === `${lowerQuery}.com` ||
                 url.includes(lowerQuery);
        } catch {
          return false;
        }
      });

      if (exactMatch) {
        await chrome.tabs.update(exactMatch.id, { active: true });
        await chrome.windows.update(exactMatch.windowId, { focused: true });
        return { 
          found: true, 
          title: exactMatch.title, 
          url: exactMatch.url,
          action: "switched"
        };
      }

      return { found: false };
    } catch (err) {
      console.error("Check existing tab error:", err);
      return { found: false };
    }
  }

  async function performWebSearchAndOpen(query) {
    try {
      addMessage(`🔍 Searching the web for "${query}"...`, "system");
      
      const response = await chrome.runtime.sendMessage({
        action: "webSearch",
        query: query
      });

      if (response && response.success && response.url) {
        await chrome.tabs.create({ url: response.url, active: true });
        return {
          success: true,
          action: "web-search",
          url: response.url,
          title: response.title,
          source: response.source,
          isFirstResult: response.isFirstResult
        };
      } else {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        await chrome.tabs.create({ url: searchUrl, active: true });
        return {
          success: true,
          action: "web-search",
          url: searchUrl,
          title: `Search: ${query}`,
          isFirstResult: false
        };
      }
    } catch (err) {
      console.error("performWebSearchAndOpen error:", err);
      return { success: false, error: err.message };
    }
  }

  async function smartOpenSite(siteName, originalText = "", checkExisting = false) {
    try {
      console.log(`🚀 SmartOpen: "${siteName}" (checkExisting: ${checkExisting})`);
      
      if (checkExisting) {
        const existing = await checkExistingTab(siteName);
        if (existing.found) {
          return {
            success: true,
            action: "switched",
            url: existing.url,
            title: existing.title,
            message: "Switched to existing tab"
          };
        }
      }

      const response = await chrome.runtime.sendMessage({
        action: "webSearch",
        query: originalText || siteName
      });

      if (response && response.success && response.url) {
        await chrome.tabs.create({ url: response.url, active: true });
        return {
          success: true,
          action: "opened",
          url: response.url,
          title: response.title,
          source: response.source,
          isFirstResult: response.isFirstResult
        };
      } else {
        return { success: false, error: response?.error || "Background script failed" };
      }
    } catch (err) {
      console.error("smartOpenSite error:", err);
      return { success: false, error: err.message };
    }
  }

  async function queryFuse(query, limit = 10) {
    if (!query || query.trim() === "") return [];
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: "fuseSearch", query, limit },
        (resp) => {
          if (chrome.runtime.lastError) {
            console.error("Fuse query error:", chrome.runtime.lastError);
            resolve([]);
            return;
          }
          if (!resp || !resp.results) {
            resolve([]);
            return;
          }
          resolve(resp.results);
        }
      );
    });
  }

  async function rankWithAI(query, candidates = [], maxCandidates = 8, sessionRefLocal) {
    if (!sessionRefLocal?.current || candidates.length === 0) {
      return { chosenIndex: 0, reason: "no ai available", confidence: "none" };
    }

    const top = candidates.slice(0, maxCandidates);
    
    const candidateText = top.map((c, i) => {
      const title = (c.title || "Untitled").slice(0, 100);
      const url = c.url || "";
      const snippet = (c.snippet || "").slice(0, 300);
      let domain = "";
      try {
        domain = new URL(url).hostname.replace(/^www\./, "");
      } catch {}
      
      return `${i + 1}. "${title}"
   URL: ${url}
   Domain: ${domain}
   Preview: ${snippet || "No content available"}`;
    }).join("\n\n");

    const promptText = `You are a precise tab-matching assistant. Match the user's query to the best tab.

User query: "${query}"

Available tabs:
${candidateText}

MATCHING RULES:
1. Prioritize exact keyword matches in title or domain
2. Consider semantic meaning and context from preview text
3. Domain relevance matters (e.g., github.com for code, stackoverflow.com for errors)
4. Confidence levels:
   - HIGH: Clear, unambiguous match with multiple signals
   - MEDIUM: Good match but some uncertainty
   - LOW: Weak match, might not be what user wants

Respond with ONLY this JSON (no markdown):
{
  "matchIndex": <number 1-${top.length}>,
  "confidence": "high|medium|low",
  "reason": "<one sentence explanation>",
  "signals": ["<key matching factors>"]
}`;

    try {
      const raw = await sessionRefLocal.current.prompt(promptText);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { chosenIndex: 0, reason: "AI response parse error", confidence: "low" };
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      const idx = Math.max(0, Math.min((parsed.matchIndex || 1) - 1, top.length - 1));
      
      const validConfidences = ["high", "medium", "low"];
      const confidence = validConfidences.includes(parsed.confidence) 
        ? parsed.confidence 
        : "medium";
      
      return {
        chosenIndex: idx,
        confidence,
        reason: parsed.reason || "AI matched this tab",
        signals: parsed.signals || []
      };
    } catch (err) {
      console.error("AI ranking error:", err);
      return { chosenIndex: 0, reason: "AI error", confidence: "low" };
    }
  }

  async function searchAndOpen(query, options = {}) {
    const { 
      silent = false, 
      context = null 
    } = options;

    let searchQuery = query;
    if (proofreaderRef.current) {
      try {
        const proof = await proofreaderRef.current.proofread(query);
        searchQuery = proof.correctedInput || query;
        if (searchQuery !== query && !silent) {
          console.log(`🔤 Corrected: "${query}" → "${searchQuery}"`);
        }
      } catch (err) {
        if (!silent) console.warn("Proofreader failed:", err);
      }
    }

    const candidates = await queryFuse(searchQuery, 15);

    if (!candidates || candidates.length === 0) {
      if (!silent) console.log("🔍 No Fuse results, trying direct search...");
      
      const q = searchQuery.toLowerCase();
      const all = await chrome.tabs.query({ currentWindow: true });
      const matches = all.filter(t => {
        const title = (t.title || "").toLowerCase();
        const url = (t.url || "").toLowerCase();
        return title.includes(q) || url.includes(q);
      });

      if (matches.length > 0) {
        matches.sort((a, b) => {
          const aTitle = (a.title || "").toLowerCase();
          const bTitle = (b.title || "").toLowerCase();
          const aTitleMatch = aTitle.includes(q);
          const bTitleMatch = bTitle.includes(q);
          if (aTitleMatch && !bTitleMatch) return -1;
          if (!aTitleMatch && bTitleMatch) return 1;
          return 0;
        });

        const match = matches[0];
        try {
          await chrome.tabs.update(match.id, { active: true });
          await chrome.windows.update(match.windowId, { focused: true });
          return { 
            opened: true, 
            method: "direct-search", 
            title: match.title, 
            url: match.url,
            matchCount: matches.length
          };
        } catch (err) {
          console.error("Tab activation error:", err);
        }
      }
      
      return { 
        opened: false, 
        error: "No tabs found", 
        shouldTryWeb: true, 
        query: searchQuery 
      };
    }

    if (!silent) console.log(`🔍 Found ${candidates.length} candidates`);

    let selectedTab = candidates[0];
    let method = "fuse";
    let rankingInfo = {};

    if (sessionRef.current && aiStatus === "ready" && candidates.length > 1) {
      try {
        const ranking = await rankWithAI(searchQuery, candidates, 10, sessionRef);
        
        if (ranking.confidence === "low") {
          if (!silent) console.log(`⚠️ AI confidence low, falling back to web.`);
          return { 
            opened: false, 
            error: "No good match found", 
            shouldTryWeb: true, 
            query: searchQuery 
          };
        }

        if (ranking.confidence === "high" || ranking.confidence === "medium") {
          selectedTab = candidates[ranking.chosenIndex];
          method = "ai";
          rankingInfo = {
            confidence: ranking.confidence,
            reason: ranking.reason,
            signals: ranking.signals
          };
          if (!silent) {
            console.log(`🤖 AI selected (${ranking.confidence}): ${selectedTab.title}`);
          }
        } else {
          if (!silent) console.log(`⚠️ AI confidence unknown, using top Fuse result`);
        }
      } catch (err) {
        console.error("AI ranking failed:", err);
      }
    }

    if (selectedTab && selectedTab.id) {
      try {
        await chrome.tabs.update(selectedTab.id, { active: true });
        await chrome.windows.update(selectedTab.windowId, { focused: true });
        return { 
          opened: true, 
          method, 
          title: selectedTab.title, 
          url: selectedTab.url,
          ...rankingInfo,
          candidateCount: candidates.length
        };
      } catch (err) {
        console.error("Tab activation error:", err);
        return { opened: false, error: "Tab no longer exists" };
      }
    }

    return { opened: false, error: "No valid tabs found", shouldTryWeb: true, query: searchQuery };
  }

  const askAIToGroupTabs = async (tabs, userRequest) => {
    if (!sessionRef.current) throw new Error("AI session not available");

    const allIndexedTabs = await queryFuse("", 1000);
    const indexedTabMap = new Map();
    allIndexedTabs.forEach(t => indexedTabMap.set(t.id, t));

    const tabsList = tabs.map((tab) => {
      const indexedData = indexedTabMap.get(tab.id);
      const title = indexedData?.title || tab.title || "Untitled";
      const snippet = indexedData?.snippet || "";
      let domain = "unknown.com";
      try {
        domain = new URL(tab.url).hostname.replace(/^www\./, "");
      } catch {}

      return `Tab ${tab.id}: "${title}"
   Domain: ${domain}
   Content: ${snippet.slice(0, 300) || "No content snippet available"}`;
    }).join("\n---\n");

    const aiPrompt = `Analyze ${tabs.length} tabs and group them logically. Use the Title, Domain, and Content to find topics.
      
Tabs:
${tabsList}

User request: "${userRequest}"

Respond with ONLY JSON: {"groups": {"Name": [ids]}, "explanation": "text"}
All IDs: ${tabs.map((t) => t.id).join(", ")}`;

    const response = await sessionRef.current.prompt(aiPrompt);
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
    let text = prompt.trim();
    if (!text || loading) return;
    
    addMessage(text, "user");
    setPrompt("");
    setLoading(true);

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

      if (command.type === "dynamicSearchOrOpen") {
        const searchResult = await searchAndOpen(command.query);

        if (searchResult.opened) {
          setLoading(false);
          let msg = `✅ Switched to: "${searchResult.title}"`;
          
          if (searchResult.candidateCount > 1) {
            msg += `\n\n📊 Found ${searchResult.candidateCount} matches`;
          }
          if (searchResult.confidence) {
            const emoji = { high: "🎯", medium: "👍", low: "🤔" };
            msg += `\n${emoji[searchResult.confidence] || '🤔'} Confidence: ${searchResult.confidence}`;
          }
          if (searchResult.reason) {
            msg += `\n💡 ${searchResult.reason}`;
          }
          
          addMessage(msg, "bot");
          return;
        } 
        
        if (searchResult.shouldTryWeb) {
          addMessage(`ℹ️ No tabs found. Searching the web...`, "system");
          
          const openQuery = searchResult.query || command.query;
          const openResult = await smartOpenSite(
            openQuery,
            openQuery,
            false
          );
          
          setLoading(false);
          if (openResult.success) {
            let msg = `🌐 Opened: "${openResult.title || openResult.url}"`;
            if (openResult.isFirstResult) msg += "\n\n✨ Top result";
            if (openResult.source) msg += `\n🔍 Source: ${openResult.source}`;
            addMessage(msg, "bot");
            await updateTabCount();
          } else {
            addMessage(`❌ Could not open or find "${command.query}"`, "bot");
          }
          return;
        }
        
        setLoading(false);
        addMessage(`❌ ${searchResult.error || "Could not find tab"}.`, "bot");
        return;
      }

      if (command.type === "emailSearch") {
        const result = await searchGmailTabs(command.query);
        setLoading(false);
        
        if (result.found) {
          let msg = `✅ Opened Gmail: "${result.title}"`;
          if (result.matchCount > 1) {
            msg += `\n\n📊 Found ${result.matchCount} Gmail tabs`;
          }
          addMessage(msg, "bot");
        } else {
          addMessage(`❌ ${result.error}. ${result.gmailCount ? `Found ${result.gmailCount} Gmail tabs but none matched "${command.query}"` : 'Try opening Gmail first.'}`, "bot");
        }
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
        await quickOrganize();
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
      const errorMessage = err?.message || String(err) || "An unknown error occurred in handleSend";
      console.error("Error in handleSend:", err);
      addMessage(`❌ Error: ${errorMessage}`, "bot");
    }
  };

  const quickOrganize = async () => {
    setLoading(true);
    addMessage("🤖 AI analyzing tabs...", "system");
    try {
      const response = await chrome.runtime.sendMessage({
        action: "organizeNow",
      });
      
      setLoading(false);
      if (response && response.success) {
        let message = "";
        if (response.groupsCreated > 0 && response.tabsAddedToExisting > 0) {
          message = `✅ Created ${response.groupsCreated} new group(s) and added ${response.tabsAddedToExisting} tab(s) to existing groups!`;
        } else if (response.groupsCreated > 0) {
          message = `✅ Created ${response.groupsCreated} new group(s)!`;
        } else if (response.tabsAddedToExisting > 0) {
          message = `✅ Added ${response.tabsAddedToExisting} tab(s) to existing groups!`;
        } else {
          message = response.message || "✅ Organization complete!";
        }
        
        addMessage(message, "bot");
        setTimeout(async () => {
          await updateTabCount();
          await loadGroups();
          setShowGroupManager(true);
        }, 1500); 
      } else {
        const errorMsg = response?.error || "Could not trigger background organization";
        addMessage(`❌ ${errorMsg}`, "bot");
      }
    } catch (err) {
      setLoading(false);
      const errorMsg = err?.message || String(err) || "A critical error occurred.";
      addMessage(`❌ Error: ${errorMsg}`, "bot");
    }
  };

  const handleHelp = () => {
    setPrompt("help");
  };

  const clearChat = () => {
    setMessages([]);
    chrome.storage.local.remove("chatMessages");
  };

  return (
    <div
      className={`w-[500px] h-[600px] ${isDark
          ? "bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900"
          : "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"
        } font-sans flex flex-col transition-all duration-500`}
    >
      <div
        className={`sticky top-0 h-40 px-6 py-4 ${isDark
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
                className={`text-lg font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"
                  }`}
              >
                {title}
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
                    className={`${isDark ? "text-emerald-400" : "text-emerald-600"
                      } font-bold`}
                  >
                    {active}
                  </span>
                ) : (
                  <span
                    className={`${isDark ? "text-slate-400" : "text-black"
                      } font-bold`}
                  >
                    {aiStatus}
                  </span>
                )}
              </div>
              <span
                className={`text-xs font-bold px-4 py-1 rounded-xl not-first:  
                    ${isDark
                    ? "bg-transparent text-yellow-500"
                    : "bg-gray-200 text-red-400"
                  }
                    backdrop-blur-xl
                    `}
              >
                {tabCount} {tabsText}
              </span>
            </div>
          </div>

          <div className="w-72 flex items-center gap-3">
            <ToggleButton
              enabled={enabled}
              onChange={toggleFeature}
              isDark={isDark}
            />

            <LanguageDropdown
              isDark={isDark}
              onChange={(language) => {
                onChangeLanguage(language);
              }}
            />
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-2 rounded-xl transition-all hover:scale-110 cursor-pointer ${isDark ? "text-yellow-300" : "text-slate-700"
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
              text={"chat"}
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
              text={group}
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
            text={help}
          />
          <Button
            onClick={async () => quickOrganize()}
            disabled={loading}
            isDark={isDark}
            icon={BotMessageSquare}
            text={organise}
          />
          <Button
            onClick={clearChat}
            disabled={loading}
            isDark={isDark}
            icon={Trash2}
            text={clear}
          />
        </div>
      </div>

      {showGroupManager ? (
        <div
          className={`w-[500px] h-[600px] overflow-x-hidden ${isDark
              ? "bg-gradient-to-br from-gray-900 via-cyan-900 to-black"
              : "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"
            } font-sans flex flex-col transition-all duration-500`}
        >
          <div
            className={`relative flex justify-between items-center px-6 py-4 border-b border-slate-300/20 `}
          >
            <h3
              className={`text-xl uppercase font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"
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
            className={`flex-1 overflow-y-auto px-6 py-5 ${isDark ? "" : "bg-white/30"
              }`}
          >
            {groups.length === 0 ? (
              <div className="flex flex-col gap-2 items-center justify-center h-full">
                <Folder
                  className={` ${isDark ? "text-white" : "text-black"}`}
                />
                <p
                  className={`text-center text-lg font-bold mono ${isDark ? "text-slate-300" : "text-slate-600"
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
                          className={`flex-1 px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${isDark
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
                          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${isDark
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
                          className={`flex justify-between items-center p-4 rounded-2xl shadow-sm border transition-all ${isDark
                              ? "bg-slate-800 border-slate-700 hover:border-slate-600"
                              : "bg-white border-slate-200 hover:border-slate-300"
                            }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-3 h-3 mt-1 rounded-full ${group.color === "blue"
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
                                className={`font-semibold text-base leading-tight ${isDark ? "text-white" : "text-slate-900"
                                  }`}
                              >
                                {group.title}
                              </h4>
                              <span
                                className={`text-xs mt-1 px-2 py-0.5 rounded-md w-fit ${isDark
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
                              className={`p-2 rounded-lg transition-all hover:scale-110 cursor-pointer ${isDark
                                  ? "bg-green-600/80 hover:bg-green-600 text-white"
                                  : "bg-green-500 hover:bg-green-600 text-white"
                                }`}
                            >
                              <Pencil size={16} />
                            </button>

                            <button
                              onClick={() => handleUngroup(group.title)}
                              className={`p-2 rounded-lg transition-all hover:scale-110 cursor-pointer ${isDark
                                  ? "bg-orange-600/80 hover:bg-orange-600 text-white"
                                  : "bg-orange-500 hover:bg-orange-600 text-white"
                                }`}
                            >
                              <Ungroup  size={16} />
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
            className={`flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-3 ${isDark
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
                        ${isDark
                          ? "bg-gradient-to-bl from-green-600 to-cyan-800 text-white border border-purple-500/30"
                          : "bg-gradient-to-bl from-white to-cyan-100 text-slate-900 border border-indigo-200"
                        }
                        `}
                      style={{ wordWrap: "break-word" }}
                    >
                      {
                        <TranslatedText
                          msg={msg}
                          language={language}
                          translatorSession={languageSession}
                        />
                      }
                    </div>
                  </div>
                );
              }
              if (isSystem) {
                return (
                  <div key={i} className="flex justify-center animate-fade-in">
                    <div
                      className={`px-4 py-2 rounded-full text-xs font-medium ${isDark
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
                    className={`max-w-[90%] px-4 py-2 rounded-2xl rounded-tl-md shadow-md text-sm ${isDark
                        ? "bg-slate-800/80 text-slate-100 border border-slate-700/50"
                        : "bg-white text-slate-800 border border-slate-200"
                      }`}
                    style={{
                      wordWrap: "break-word",
                      whiteSpace: "preserve-breaks",
                    }}
                  >
                    {
                      <TranslatedText
                        msg={msg}
                        language={language}
                        translatorSession={languageSession}
                      />
                    }
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex justify-start animate-pulse">
                <div
                  className={`px-4 py-2.5 rounded-2xl rounded-tl-md flex items-center gap-2 text-sm ${isDark
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
            className={`px-6 py-4 ${isDark
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
                placeholder="Search tabs, open sites, or organize..."
                disabled={loading}
                className={`flex-1 px-4 py-3 rounded-xl text-sm transition-all outline-none focus:ring-2 focus:ring-cyan-500 ${isDark
                    ? "bg-slate-800/50 border border-slate-700 text-white placeholder-slate-400 "
                    : "bg-white border border-slate-300 text-slate-900 placeholder-slate-400 "
                  } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
              />
              <button
                onClick={handleSend}
                disabled={loading || !prompt.trim()}
                className={`px-5 py-3 rounded-xl font-semibold transition-all  ${loading || !prompt.trim()
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