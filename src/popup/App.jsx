// src/popup/App.jsx - REFINED UI VERSION 2 (Chat Area)
import { useState, useRef, useEffect, useCallback } from "react";

import { Sun } from "lucide-react";
import { Moon } from "lucide-react";
import { Boxes } from "lucide-react";
import { Folder } from "lucide-react";
import { Pencil } from "lucide-react";
import { Trash2 } from "lucide-react";
import { Ungroup } from "lucide-react";
import { SendHorizontal } from "lucide-react";
import { BotMessageSquare } from "lucide-react";
import { MessageCircleQuestionMark } from "lucide-react";

import {
  aiUnavailableMessage,
  closeGroupTabs,
  completerSystemPrompt,
  getAllGroups,
  groupExistingTabs,
  helpMessage,
  helpMessageHTML,
  parseAIResponse,
  renameGroup,
  systemPrompt,
  ungroupTabs,
} from "../utils";

import Button from "../components/Button";
import ToggleButton from "../components/ToggleButton";
import LanguageDropdown from "../components/DropdownButton";
import TranslatedText from "../components/TranslatedText";



export default function App() {
  const [title, setTitle] = useState("FUXI AI");
  const [active, setActive] = useState("Auto-Active");
  const [tabsText, setTabsText] = useState("Tabs Open");
  const [group, setGroup] = useState("Groups");
  const [help, setHelp] = useState("Help");
  const [organise, setOrganise] = useState("Organise Now");
  const [clear, setClear] = useState("Clear Chat");
  const [chatText, setChatText] = useState("Chat");
  const [tabGroupText, setTabGroupText] = useState("Tab Groups");
  const [groupText, setGroupText] = useState("Group");
  const [groupsText, setGroupsText] = useState("Groups");

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
  const [awaitingUsername, setAwaitingUsername] = useState(false);
  const [inlineSuggestion, setInlineSuggestion] = useState("");

  const sessionRef = useRef(null);
  const chatEndRef = useRef(null);
  const proofreaderRef = useRef(null);
  const completerSessionRef = useRef(null);
  const textInputRef = useRef(null); // <-- ADD THIS REF
  const [languageSession, setLanguageSession] = useState(null);

  const promptRef = useRef(prompt);
  const loadingRef = useRef(loading);
  const showGroupManagerRef = useRef(showGroupManager);

  // ADD THIS useEffect to keep refs in sync
  useEffect(() => {
    promptRef.current = prompt;
    loadingRef.current = loading;
    showGroupManagerRef.current = showGroupManager;
  }, [prompt, loading, showGroupManager]);

  useEffect(() => {
    // Debounce suggestions
    const handler = setTimeout(async () => {
      // <--- Note the 'async'
      // Read from refs to get the latest state
      const currentPrompt = promptRef.current;
      const isLoading = loadingRef.current;
      const isShowingGroups = showGroupManagerRef.current;

      if (
        isLoading ||
        isShowingGroups ||
        !currentPrompt ||
        currentPrompt.length < 2 || // Don't trigger for just one letter
        !completerSessionRef.current
      ) {
        // Don't trigger if AI isn't ready
        setInlineSuggestion(""); // Clear inline suggestion
        return;
      } // --- Always clear button suggestions per user request "not on the top" ---

      try {
        const response = await completerSessionRef.current.prompt(
          currentPrompt
        );

        if (
          response &&
          response !== "NO_MATCH" &&
          response.length > currentPrompt.length &&
          response.toLowerCase().startsWith(currentPrompt.toLowerCase())
        ) {
          // We have a valid completion
          // We must preserve the user's original casing
          const completion = response.substring(currentPrompt.length);
          setInlineSuggestion(currentPrompt + completion);
        } else {
          // AI returned "NO_MATCH" or an invalid/shorter response
          setInlineSuggestion("");
        }
      } catch (err) {
        console.error("AI Autocomplete error:", err);
        setInlineSuggestion("");
      }
    }, 300); // 300ms debounce, giving the on-device AI a bit more time

    return () => {
      clearTimeout(handler);
    };
  }, [prompt]); // Re-run whenever prompt text changes // Re-run whenever prompt text changes

  // REPLACE BOTH of your initial useEffect hooks with THIS ONE
  useEffect(() => {
    chrome.storage.local.get(
      [
        "chatMessages",
        "tabManagerTheme",
        "autoGroupingEnabled",
        "selectedLanguage", // Load the saved language
        "awaitingUsername",
      ],
      (data) => {
        // Load Chat Messages
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

        // Load Theme
        if (data.tabManagerTheme) {
          setIsDark(data.tabManagerTheme === "dark");
        }

        // Load Toggle State (from your first hook)
        setEnabled(data.autoGroupingEnabled ?? true);

        // Load awaiting username state
        if (data.awaitingUsername === true) {
          setAwaitingUsername(true);
        }

        // Load and apply saved language
        const savedLanguage = data.selectedLanguage;
        if (savedLanguage && savedLanguage.code !== "en") {
          // If we have a saved, non-English language,
          // set it and trigger the translation process.
          setLanguage(savedLanguage);
          onChangeLanguage(savedLanguage, true); // Pass 'true' to skip re-saving
        }
        // If language is English or not set, the defaults from useState() are used.
      }
    );

    // Call all your init functions
    initializeAI();
    initializeProofreaderAI();
    initializeAICompleter();
    updateTabCount();
    checkBackgroundAIStatus();

    // --- ADD THIS BLOCK TO FOCUS INPUT ---
    // Focus the text input on popup open, but only if we're in chat view
    if (textInputRef.current && !showGroupManagerRef.current) {
      textInputRef.current.focus();
    }
    // --- END OF ADDED BLOCK ---
  }, []); // This should only run once on mount

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    chrome.storage.local.set({ tabManagerTheme: isDark ? "dark" : "light" });
  }, [isDark]);

  useEffect(() => {
    if (prompt === "help") handleSend();
  }, [prompt]);

  const onChangeLanguage = async (lang, skipSave = false) => {
    // 1. Persist the new language choice (unless we're just loading)
    if (!skipSave) {
      chrome.storage.local.set({ selectedLanguage: lang });
    }

    // Get the previous language code for the translator source
    const prevLangCode = language?.code ?? "en";

    // 2. Update React state
    setLanguage(lang);

    // 3. Handle English case (no translation needed)
    if (lang.code === "en") {
      setLanguageSession(null);

      // Reset all UI text to English defaults
      setTitle("FUXI AI");
      setActive("Auto-Active");
      setTabsText("Tabs Open");
      setGroup("Groups");
      setHelp("Help");
      setOrganise("Organise Now");
      setClear("Clear Chat");
      setChatText("Chat");
      setTabGroupText("Tab Groups");
      setGroupText("Group");
      setGroupsText("Groups");
      return;
    }

    // 4. Initialize the AI translator
    const newLanguageSession = await initializeLanguageChangeAI(
      lang,
      prevLangCode
    );

    console.log("Selected Language:", lang);
    console.log("Previous Language Code (used as source):", prevLangCode);
    console.log("Language Session:", newLanguageSession);

    // 5. Translate all UI text in parallel
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
          newChat,
          newTabGroup,
          newGroupText,
          newGroupsText,
        ] = await Promise.all([
          newLanguageSession.translate("FUXI AI"),
          newLanguageSession.translate("Auto-Active"),
          newLanguageSession.translate("Tabs Open"),
          newLanguageSession.translate("Groups"),
          newLanguageSession.translate("Help"),
          newLanguageSession.translate("Organise Now"),
          newLanguageSession.translate("Clear Chat"),
          newLanguageSession.translate("Chat"),
          newLanguageSession.translate("Tab Groups"),
          newLanguageSession.translate("Group"),
          newLanguageSession.translate("Groups"),
        ]);

        // 6. Apply all translated text at once
        setTitle(newTitle);
        setActive(newActive);
        setTabsText(newTabsText);
        setGroup(newGroup);
        setHelp(newHelp);
        setOrganise(newOrganise);
        setClear(newClear);
        setChatText(newChat);
        setTabGroupText(newTabGroup);
        setGroupText(newGroupText);
        setGroupsText(newGroupsText);
      }
    } catch (error) {
      console.error("Language change failed:", error);
      // If translation fails, you might want to fall back to English
      // or just let the previous (or default) text remain.
    }
  };

  const initializeAICompleter = async () => {
    // ⬇️ ADD THIS LINE ⬇️
    console.log(
      "Initializing AI Completer with prompt:",
      completerSystemPrompt
    );
    try {
      if (typeof LanguageModel !== "undefined") {
        const availability = await LanguageModel.availability();
        if (availability === "available") {
          completerSessionRef.current = await LanguageModel.create({
            initialPrompts: [
              { role: "system", content: completerSystemPrompt },
            ],
          });
          console.log("✅ AI Autocompleter initialized");
        }
      }
    } catch (err) {
      console.error("❌ AI Autocompleter initialization failed:", err);
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
            initialPrompts: [{ role: "system", content: systemPrompt }],
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

  const detectCommand = (text) => {
    const lower = text.toLowerCase().trim();
    if (lower === "help" || lower === "commands") return { type: "help" };

    const gmailPatterns = [
      /^(open|show|find|search)\s+(mail|email|gmail)\s+(?:from|about|with|by|regarding|to)?\s*(.+)/i,
      /^(mail|email|gmail)\s+(?:from|about|with|by|regarding|to)?\s*(.+)/i,
      /^(open|show|find|search)\s+(.+)\s+(mail|email|gmail)$/i,
    ];

    for (const pattern of gmailPatterns) {
      const match = text.match(pattern);
      if (match) {
        const emailContext = match[match.length - 1];
        return {
          type: "emailSearch",
          query: emailContext.trim(),
          originalText: text,
        };
      }

      // Handle "so [query]"
      const soMatch = text.match(/^so\s+(.+)/i);
      if (soMatch) {
        const query = soMatch[1];
        return {
          type: "smartOpen",
          query: `${query} stackoverflow`, // Pass the full query to smartOpen
        };
      }

      // Handles "[query] website" and "watch [query] on [site]"
      const siteMatch = text.match(
        /(.+)\s+(?:website|on\s+hotstar|on\s+netflix|on\s+prime|on\s+crunchyroll|on\s+youtube|on\s+hulu|on\s+disney\+)/i
      );
      if (siteMatch) {
        // The full text is the best query for smartOpenSite
        return {
          type: "smartOpen",
          query: text,
        };
      }
    }

    // to check if the user is wanting to open github account
    if (
      lower.includes("github") &&
      (lower.includes("account") || lower.includes("my profile"))
    ) {
      return { type: "openGithub" };
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
      const gmailTabs = tabs.filter((tab) => {
        const url = tab.url || "";
        return url.includes("mail.google.com") && !url.includes("chrome://");
      });

      if (gmailTabs.length === 0) {
        return { found: false, error: "No Gmail tabs open" };
      }
      console.log(`Found ${gmailTabs.length} Gmail tabs`);

      const candidates = await queryFuse(emailContext, 20);
      const gmailCandidates = candidates.filter(
        (c) => c.url && c.url.includes("mail.google.com")
      );

      if (gmailCandidates.length > 0) {
        console.log(
          `[App.jsx] Found ${gmailCandidates.length} Gmail candidates via Fuse`
        );
        let selectedTab = gmailCandidates[0];

        if (
          sessionRef.current &&
          aiStatus === "ready" &&
          gmailCandidates.length > 1
        ) {
          try {
            const ranking = await rankWithAI(
              emailContext,
              gmailCandidates,
              5,
              sessionRef
            );
            if (
              ranking.confidence === "high" ||
              ranking.confidence === "medium"
            ) {
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
          matchCount: gmailCandidates.length,
        };
      }

      console.warn(
        "[App.jsx] Fuse found no Gmail matches. Manually searching snippets..."
      );
      const contextLower = emailContext.toLowerCase();
      const allCandidates = await queryFuse("", 1000);

      let manualMatch = null;
      for (const tab of gmailTabs) {
        const indexedData = allCandidates.find((c) => c.id === tab.id);
        if (!indexedData) continue;

        const title = (indexedData.title || "").toLowerCase();
        const snippet = (indexedData.snippet || "").toLowerCase();

        if (title.includes(contextLower) || snippet.includes(contextLower)) {
          console.log(
            `[App.jsx] Manual fallback found match in Tab ${tab.id} (snippet: ${snippet.length} chars)`
          );
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
          method: "snippet-fallback",
        };
      }

      return {
        found: false,
        error: "No matching Gmail found",
        gmailCount: gmailTabs.length,
      };
    } catch (err) {
      console.error("Gmail search error:", err);
      return { found: false, error: err.message };
    }
  }

  async function checkExistingTab(query) {
    try {
      const tabs = await chrome.tabs.query({});
      const lowerQuery = query.toLowerCase();

      const exactMatch = tabs.find((tab) => {
        const url = tab.url || "";
        try {
          const hostname = new URL(url).hostname.replace(/^www\./, "");
          return (
            hostname === lowerQuery ||
            hostname === `${lowerQuery}.com` ||
            url.includes(lowerQuery)
          );
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
          action: "switched",
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
        query: query,
      });

      if (response && response.success && response.url) {
        await chrome.tabs.create({ url: response.url, active: true });
        return {
          success: true,
          action: "web-search",
          url: response.url,
          title: response.title,
          source: response.source,
          isFirstResult: response.isFirstResult,
        };
      } else {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
          query
        )}`;
        await chrome.tabs.create({ url: searchUrl, active: true });
        return {
          success: true,
          action: "web-search",
          url: searchUrl,
          title: `Search: ${query}`,
          isFirstResult: false,
        };
      }
    } catch (err) {
      console.error("performWebSearchAndOpen error:", err);
      return { success: false, error: err.message };
    }
  }

  async function smartOpenSite(
    siteName,
    originalText = "",
    checkExisting = false
  ) {
    try {
      console.log(
        `🚀 SmartOpen: "${siteName}" (checkExisting: ${checkExisting})`
      );

      if (checkExisting) {
        const existing = await checkExistingTab(siteName);
        if (existing.found) {
          return {
            success: true,
            action: "switched",
            url: existing.url,
            title: existing.title,
            message: "Switched to existing tab",
          };
        }
      }

      const response = await chrome.runtime.sendMessage({
        action: "webSearch",
        query: originalText || siteName,
      });

      if (response && response.success && response.url) {
        await chrome.tabs.create({ url: response.url, active: true });
        return {
          success: true,
          action: "opened",
          url: response.url,
          title: response.title,
          source: response.source,
          isFirstResult: response.isFirstResult,
        };
      } else {
        return {
          success: false,
          error: response?.error || "Background script failed",
        };
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

  async function rankWithAI(
    query,
    candidates = [],
    maxCandidates = 8,
    sessionRefLocal
  ) {
    if (!sessionRefLocal?.current || candidates.length === 0) {
      return { chosenIndex: 0, reason: "no ai available", confidence: "none" };
    }

    const top = candidates.slice(0, maxCandidates);

    const candidateText = top
      .map((c, i) => {
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
      })
      .join("\n\n");

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
        return {
          chosenIndex: 0,
          reason: "AI response parse error",
          confidence: "low",
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const idx = Math.max(
        0,
        Math.min((parsed.matchIndex || 1) - 1, top.length - 1)
      );

      const validConfidences = ["high", "medium", "low"];
      const confidence = validConfidences.includes(parsed.confidence)
        ? parsed.confidence
        : "medium";

      return {
        chosenIndex: idx,
        confidence,
        reason: parsed.reason || "AI matched this tab",
        signals: parsed.signals || [],
      };
    } catch (err) {
      console.error("AI ranking error:", err);
      return { chosenIndex: 0, reason: "AI error", confidence: "low" };
    }
  }

  async function searchAndOpen(query, options = {}) {
    const { silent = false, context = null } = options;

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
      const matches = all.filter((t) => {
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
            matchCount: matches.length,
          };
        } catch (err) {
          console.error("Tab activation error:", err);
        }
      }

      return {
        opened: false,
        error: "No tabs found",
        shouldTryWeb: true,
        query: searchQuery,
      };
    }

    if (!silent) console.log(`🔍 Found ${candidates.length} candidates`);

    let selectedTab = candidates[0];
    let method = "fuse";
    let rankingInfo = {};

    if (sessionRef.current && aiStatus === "ready" && candidates.length > 1) {
      try {
        const ranking = await rankWithAI(
          searchQuery,
          candidates,
          10,
          sessionRef
        );

        if (ranking.confidence === "low") {
          if (!silent)
            console.log(`⚠️ AI confidence low, falling back to web.`);
          return {
            opened: false,
            error: "No good match found",
            shouldTryWeb: true,
            query: searchQuery,
          };
        }

        if (ranking.confidence === "high" || ranking.confidence === "medium") {
          selectedTab = candidates[ranking.chosenIndex];
          method = "ai";
          rankingInfo = {
            confidence: ranking.confidence,
            reason: ranking.reason,
            signals: ranking.signals,
          };
          if (!silent) {
            console.log(
              `🤖 AI selected (${ranking.confidence}): ${selectedTab.title}`
            );
          }
        } else {
          if (!silent)
            console.log(`⚠️ AI confidence unknown, using top Fuse result`);
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
          candidateCount: candidates.length,
        };
      } catch (err) {
        console.error("Tab activation error:", err);
        return { opened: false, error: "Tab no longer exists" };
      }
    }

    return {
      opened: false,
      error: "No valid tabs found",
      shouldTryWeb: true,
      query: searchQuery,
    };
  }

  const askAIToGroupTabs = async (tabs, userRequest) => {
    if (!sessionRef.current) throw new Error("AI session not available");

    const allIndexedTabs = await queryFuse("", 1000);
    const indexedTabMap = new Map();
    allIndexedTabs.forEach((t) => indexedTabMap.set(t.id, t));

    const tabsList = tabs
      .map((tab) => {
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
      })
      .join("\n---\n");

    const aiPrompt = `Analyze ${
      tabs.length
    } tabs and group them logically. Use the Title, Domain, and Content to find topics.
      
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

  const handleDeleteGroup = async (group) => {
    const { title, tabCount } = group;
    // This is a destructive action, so a confirmation is a good idea.
    if (window.confirm(`Are you sure you want to delete the group "${title}" and close all ${tabCount} tabs?`)) {
      const result = await closeGroupTabs(title); // The util function just needs the title
      if (result.success) {
        addMessage(
          `✅ Deleted group "${title}" and closed ${result.count} tabs`,
          "bot"
        );
        await loadGroups(); // Refresh the group list
        await updateTabCount(); // Refresh the tab count
      } else {
        addMessage(`❌ Failed to delete group "${title}": ${result.error}`, "bot");
      }
    }
  };


  const handleSend = async () => {
    let text = prompt.trim();
    if (!text || loading) return;

    addMessage(text, "user");
    setPrompt("");
    setLoading(true);

    if (awaitingUsername) {
      const username = text.trim();
      setAwaitingUsername(false); // Reset the state
      await chrome.storage.local.set({ githubUsername: username }); // Save username
      await chrome.storage.local.remove("awaitingUsername"); // <--- ADD THIS to clear the flag

      const url = `https://github.com/${username}`;
      await chrome.tabs.create({ url: url, active: true });

      addMessage(`✅ Saved and opened your GitHub profile: ${url}`, "bot");
      setLoading(false);
      return; // Stop here, we're done
    }

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
            msg += `\n${emoji[searchResult.confidence] || "🤔"} Confidence: ${
              searchResult.confidence
            }`;
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
          const openResult = await smartOpenSite(openQuery, openQuery, false);

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
          addMessage(
            `❌ ${result.error}. ${
              result.gmailCount
                ? `Found ${result.gmailCount} Gmail tabs but none matched "${command.query}"`
                : "Try opening Gmail first."
            }`,
            "bot"
          );
        }
        return;
      }

      if (command.type === "smartOpen") {
        addMessage(`ℹ️ Opening website for "${command.query}"...`, "system");
        const openResult = await smartOpenSite(
          command.query,
          command.query,
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
      // END OF NEW BLOCK

      if (command.type === "openGithub") {
        chrome.storage.local.get("githubUsername", (data) => {
          if (data.githubUsername) {
            // We found a saved username
            const url = `https://github.com/${data.githubUsername}`;
            chrome.tabs.create({ url: url, active: true });
            addMessage(`✅ Opening your saved GitHub profile: ${url}`, "bot");
            setLoading(false);
          } else {
            // No username found, so ask for it
            addMessage(
              "🤔 I don't know your GitHub username. What is it?",
              "bot"
            );
            setAwaitingUsername(true); // Set the flag
            chrome.storage.local.set({ awaitingUsername: true }); // <--- ADD THIS to save the flag
            setLoading(false);
          }
        });
        return; // We must return here because the logic is async
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
      const errorMessage =
        err?.message ||
        String(err) ||
        "An unknown error occurred in handleSend";
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
        const errorMsg =
          response?.error || "Could not trigger background organization";
        addMessage(`❌ ${errorMsg}`, "bot");
      }
    } catch (err) {
      setLoading(false);
      const errorMsg =
        err?.message || String(err) || "A critical error occurred.";
      addMessage(`❌ Error: ${errorMsg}`, "bot");
    }
  };

  const handleKeyDown = (e) => {
    // Autocomplete on Tab or ArrowRight
    if ((e.key === "Tab" || e.key === "ArrowRight") && inlineSuggestion) {
      // Only autocomplete if the cursor is at the end of the input
      if (e.target.selectionStart === prompt.length) {
        e.preventDefault(); // Stop Tab from changing focus
        setPrompt(inlineSuggestion);
        setInlineSuggestion("");
      }
    } // Handle Enter key

    if (e.key === "Enter" && !loading) {
      e.preventDefault(); // Prevent newlines in case it was a textarea
      handleSend();
    }
  };

  const handleSuggestionClick = async (suggestion) => {
    if (loading) return;

    const label = suggestion.label;
    const action = suggestion.action;
    const query = suggestion.query;

    // 1. Add to chat & clear input
    addMessage(label, "user"); // Use the suggestion label as the user message
    setPrompt("");
    setLoading(true);

    // 2. Execute action
    try {
      if (action === "smartOpen") {
        addMessage(`ℹ️ Opening website for "${query}"...`, "system");
        const openResult = await smartOpenSite(query, query, false);

        setLoading(false);
        if (openResult.success) {
          let msg = `🌐 Opened: "${openResult.title || openResult.url}"`;
          if (openResult.isFirstResult) msg += "\n\n✨ Top result";
          if (openResult.source) msg += `\n🔍 Source: ${openResult.source}`;
          addMessage(msg, "bot");
          await updateTabCount();
        } else {
          addMessage(`❌ Could not open or find "${query}"`, "bot");
        }
        return;
      }

      if (action === "searchTabs") {
        const searchResult = await searchAndOpen(query);

        if (searchResult.opened) {
          setLoading(false);
          let msg = `✅ Switched to: "${searchResult.title}"`;
          if (searchResult.candidateCount > 1) {
            msg += `\n\n📊 Found ${searchResult.candidateCount} matches`;
          }
          if (searchResult.confidence) {
            const emoji = { high: "🎯", medium: "👍", low: "🤔" };
            msg += `\n${emoji[searchResult.confidence] || "🤔"} Confidence: ${
              searchResult.confidence
            }`;
          }
          addMessage(msg, "bot");
        } else {
          // If tab search fails, fall back to web search
          addMessage(
            `ℹ️ No tabs found for "${query}". Searching web...`,
            "system"
          );
          const openResult = await smartOpenSite(query, query, false);
          setLoading(false);
          if (openResult.success) {
            let msg = `🌐 Opened: "${openResult.title || openResult.url}"`;
            addMessage(msg, "bot");
          } else {
            addMessage(`❌ Could not find tab or open "${query}"`, "bot");
          }
        }
        return;
      }
    } catch (err) {
      setLoading(false);
      const errorMessage =
        err?.message || String(err) || "An unknown error occurred";
      console.error("Error in handleSuggestionClick:", err);
      addMessage(`❌ Error: ${errorMessage}`, "bot");
    }
  };

  const handleHelp = () => {
    setPrompt("help");
  };

  const clearChat = () => {
    setMessages([]);
    chrome.storage.local.remove("chatMessages");
  };

  // JSX for the Group Manager content
  const groupManagerContent = (
    <>
      <div
        className={`relative flex justify-between items-center pb-4 mb-4 ${
          isDark ? "border-b border-slate-700/50" : "border-b border-gray-200"
        }`}
      >
        <h3
          className={`text-lg uppercase font-bold tracking-tight ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          {tabGroupText}
        </h3>
        <span
          className={`text-xs font-medium px-3 py-1 rounded-full ${
            isDark
              ? "bg-cyan-500/20 text-cyan-300"
              : "bg-cyan-100 text-cyan-700"
          }`}
        >
          {groups.length} {groups.length === 1 ? groupText : groupsText}
        </span>
      </div>

      <div className="flex-1">
        {groups.length === 0 ? (
          <div className="flex flex-col gap-3 items-center justify-center h-full pt-16">
            <Folder
              className={` ${isDark ? "text-slate-700" : "text-gray-300"}`}
              size={48}
            />
            <p
              className={`text-center text-sm font-medium ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              No groups yet.
              <br />
              Try 'Organise Now' or 'group all as Work'.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.id} className="rounded-xl transition-all">
                {renamingGroup === group.title ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameSubmit(group.title);
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
                      className={`flex justify-between items-center p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isDark
                          ? "bg-slate-800 border-slate-700/50 hover:bg-slate-700/60"
                          : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      <div
                        className="flex items-center gap-3 cursor-pointer"
                      >
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

                        <div className="flex flex-col">
                          <h4
                            className={`font-semibold text-base leading-tight ${
                              isDark ? "text-white" : "text-slate-900"
                            }`}
                          >
                            <TranslatedText
                              msg={{ text: group.title }}
                              language={language}
                              translatorSession={languageSession}
                            />
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

                      <div className="flex gap-1">
                        <button
                          onClick={() => handleRenameStart(group)}
                          title="Rename group"
                          className={`p-2 rounded-lg transition-all hover:scale-110 cursor-pointer ${
                            isDark
                              ? "text-slate-400 hover:bg-slate-700 hover:text-green-400"
                              : "text-slate-500 hover:bg-gray-200 hover:text-green-600"
                          }`}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          onClick={() => handleUngroup(group.title)}
                          title="Ungroup (move tabs out)"
                          className={`p-2 rounded-lg transition-all hover:scale-110 cursor-pointer ${
                            isDark
                              ? "text-slate-400 hover:bg-slate-700 hover:text-orange-400"
                              : "text-slate-500 hover:bg-gray-200 hover:text-orange-600"
                          }`}
                        >
                          <Ungroup size={16} />
                        </button>

                        {/* --- ADDED THIS BUTTON --- */}
                        <button
                          onClick={() => handleDeleteGroup(group)}
                          title="Delete group (closes all tabs)"
                          className={`p-2 rounded-lg transition-all hover:scale-110 cursor-pointer ${
                            isDark
                              ? "text-slate-400 hover:bg-slate-700 hover:text-red-400"
                              : "text-slate-500 hover:bg-gray-200 hover:text-red-600"
                          }`}
                        >
                          <Trash2 size={16} />
                        </button>
                        {/* --- END OF ADDED BUTTON --- */}
                      </div>
                      </div>                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  // JSX for the Chat Messages content
  const chatMessagesContent = (
    <div className="flex flex-col gap-3.5">
      {messages.map((msg, i) => {
        const isUser = msg.sender === "user";
        const isSystem = msg.sender === "system";

        if (isUser) {
          return (
            <div key={i} className="flex justify-end animate-slide-in-right">
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-lg shadow-lg text-sm leading-relaxed text-white
                  ${
                    isDark
                      ? "bg-gradient-to-br from-cyan-600 to-indigo-700"
                      : "bg-gradient-to-br from-cyan-500 to-indigo-600"
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
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  isDark
                    ? "bg-slate-800 text-slate-500 border border-slate-700/50"
                    : "bg-gray-100 text-slate-500 border border-gray-200"
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
              className={`max-w-[90%] px-4 py-2.5 rounded-2xl rounded-tl-lg shadow-md text-sm leading-relaxed ${
                isDark
                  ? "bg-slate-800 text-slate-100"
                  : "bg-gray-100 text-slate-800"
              }`}
              style={{
                wordWrap: "break-word",
              }}
            >
              {msg.text === helpMessage ? (
                <div
                  dangerouslySetInnerHTML={{ __html: helpMessageHTML }}
                />
              ) : (
                <TranslatedText
                  msg={msg}
                  language={language}
                  translatorSession={languageSession}
                />
              )}
            </div>
          </div>
        );
      })}

      {loading && (
        <div className="flex justify-start animate-pulse">
          <div
            className={`px-4 py-2.5 rounded-2xl rounded-tl-lg flex items-center gap-2 text-sm ${
              isDark
                ? "bg-slate-800 text-slate-300"
                : "bg-gray-100 text-slate-600"
            }`}
          >
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
              <div
                className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.1s" }}
              ></div>
              <div
                className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce"
                style={{ animationDelay: "0.2s" }}
              ></div>
            </div>
            <span>Thinking...</span>
          </div>
        </div>
      )}

      <div ref={chatEndRef} />
    </div>
  );

  return (
    <div
      className={`w-[500px] h-[600px] font-sans flex flex-col transition-all duration-300 ${
        isDark ? "bg-slate-950 text-slate-100" : "bg-gray-100 text-slate-900"
      }`}
    >
      {/* --- HEADER --- */}
      <div
        className={`sticky top-0 px-5 py-4 z-10 ${
          isDark
            ? "bg-slate-900/80 border-b border-slate-700/50"
            : "bg-white/80 border-b border-gray-200/70"
        } backdrop-blur-lg`}
      >
        {/* Row 1: Title & Controls */}
        <div className="relative flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="logo" className="w-8 h-8" />
            <h3
              className={`text-lg font-bold tracking-tight ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {title}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <LanguageDropdown
              isDark={isDark}
              value={language}
              onChange={(language) => {
                onChangeLanguage(language);
              }}
            />
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-2 rounded-lg transition-all hover:scale-110 cursor-pointer ${
                isDark
                  ? "text-yellow-300 hover:bg-slate-800"
                  : "text-slate-600 hover:bg-gray-200"
              }`}
              title="Toggle theme"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        {/* Row 2: Status & Toggles */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center gap-1.5 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium
                ${
                  isDark
                    ? "bg-slate-800 border border-slate-700/50"
                    : "bg-gray-200 border border-gray-300/50"
                }
              `}
            >
              {aiStatus === "ready" ? (
                <>
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                  <span
                    className={`${
                      isDark ? "text-emerald-400" : "text-emerald-600"
                    }`}
                  >
                    {active}
                  </span>
                </>
              ) : (
                <span
                  className={`${isDark ? "text-slate-400" : "text-slate-600"}`}
                >
                  {aiStatus}
                </span>
              )}
            </div>
            <span
              className={`text-xs font-medium px-3 py-1 rounded-full
                ${
                  isDark
                    ? "bg-slate-800 border border-slate-700/50 text-cyan-300"
                    : "bg-gray-200 border border-gray-300/50 text-cyan-700"
                }
              `}
            >
              {tabCount} {tabsText}
            </span>
          </div>
          <ToggleButton
            enabled={enabled}
            onChange={toggleFeature}
            isDark={isDark}
          />
        </div>

        {/* Row 3: Action Buttons */}
        <div className="relative flex gap-2">
          {showGroupManager ? (
            <Button
              onClick={() => setShowGroupManager(false)}
              disabled={loading}
              isDark={isDark}
              icon={BotMessageSquare}
              text={chatText}
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

      {/* --- MAIN CONTENT AREA (CHAT OR GROUPS) --- */}
      <div
        className={`flex-1 overflow-y-auto px-5 py-4 ${
          isDark ? "bg-slate-900" : "bg-white"
        }`}
      >
        {showGroupManager ? groupManagerContent : chatMessagesContent}
      </div>

      {/* --- CHAT INPUT BAR (Conditional) --- */}
      {!showGroupManager && (
        <div
          className={`px-5 py-3 ${
            isDark
              ? "bg-slate-900/80 border-t border-slate-700/50"
              : "bg-white/80 border-t border-gray-200/70"
          } backdrop-blur-lg`}
        >
          {/* --- SUGGESTION AREA --- */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={inlineSuggestion}
                readOnly
                disabled
                className={`absolute inset-0 px-4 py-3 rounded-xl text-sm outline-none border-transparent ${
                  isDark ? "text-slate-600" : "text-slate-400"
                }
${isDark ? "bg-slate-800" : "bg-white"}
                  ${/* This is the magic */ ""}
bg-transparent
`}
              />
              <input
                ref={textInputRef} // <-- ADD THE REF HERE
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search tabs, open sites, or organize..."
                disabled={loading}
                className={`relative w-full px-4 py-3 rounded-xl text-sm transition-all outline-none focus:ring-2 focus:ring-cyan-500 
                  ${/* This is the magic: transparent bg */ ""}
bg-transparent
${
  isDark
    ? "border border-slate-700 text-white placeholder-slate-400 "
    : "bg-white border border-slate-300 text-slate-900 placeholder-slate-400 "
} ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
              />{" "}
            </div>
            <button
              onClick={handleSend}
              disabled={loading || !prompt.trim()}
              className={`px-4 py-3 rounded-xl font-semibold transition-all flex items-center justify-center ${
                loading || !prompt.trim()
                  ? "bg-slate-400/30 text-slate-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-green-500 to-green-600 cursor-pointer text-white hover:shadow-lg hover:scale-105"
              }`}
              title="Send message"
            >
              <SendHorizontal size={18} />
            </button>{" "}
          </div>
        </div>
      )}

      {/* --- GLOBAL STYLES --- */}
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
            isDark ? "rgba(100, 116, 139, 0.3)" : "rgba(148, 163, 184, 0.4)"
          };
          border-radius: 10px;
        }
        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: ${
            isDark ? "rgba(100, 116, 139, 0.5)" : "rgba(148, 163, 184, 0.6)"
          };
        }
      `}</style>
    </div>
  );
}
