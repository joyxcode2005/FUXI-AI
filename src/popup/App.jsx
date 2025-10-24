// src/popup/App.jsx
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
import { SendHorizontal } from "lucide-react";
import { Folder } from "lucide-react";
import { Pencil } from "lucide-react";
import { Trash2 } from "lucide-react";
import ToggleButton from "../components/ToggleButton";
import LanguageDropdown from "../components/DropdownButton";
import { memo } from "react";

// NEW, MEMOIZED COMPONENT - Place this OUTSIDE (above) your App component
const TranslatedText = memo(function TranslatedText({
  msg,
  language,
  translatorSession,
}) {
  // Default the state to the original English text
  const [translated, setTranslated] = useState(msg?.text || "...");

  useEffect(() => {
    // 1. Skip if no message, or if translator session isn't ready
    if (!msg?.text || !translatorSession) {
      setTranslated(msg.text); // Ensure it shows original text
      return;
    }

    // 2. If target language is English, just use the original text
    if (language.code === "en") {
      setTranslated(msg.text);
      return;
    }

    let isCancelled = false; // Prevent race conditions

    (async () => {
      try {
        // 3. Use the passed 'translatorSession' prop
        const result = await translatorSession.translate(msg.text);
        if (!isCancelled) setTranslated(result);
      } catch (err) {
        console.error("Translation error:", err);
        // 4. Fallback to original text if translation fails
        if (!isCancelled) setTranslated(msg.text);
      }
    })();

    // Cleanup if component unmounts
    return () => {
      isCancelled = true;
    };
    // 5. KEY: Depend on the session object, not a ref
  }, [msg?.text, language, translatorSession]);

  // Render the state, which is guaranteed to be either translated or the original
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

  // UI / feature state
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
  const [enabled, setEnabled] = useState(true); // auto-grouping

  // refs
  const sessionRef = useRef(null);
  const chatEndRef = useRef(null);
  const proofreaderRef = useRef(null);
  const [languageSession, setLanguageSession] = useState(null);

  // Load auto-grouping pref on mount
  useEffect(() => {
    chrome.storage.local.get("autoGroupingEnabled", (data) => {
      setEnabled(data.autoGroupingEnabled ?? true);
    });
  }, []);

  // Load persisted messages, init AIs, counts, theme
  useEffect(() => {
    // messages
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

    // Load theme from chrome.storage.local

    // Load theme
    chrome.storage.local.get("tabManagerTheme", (data) => {
      if (data.tabManagerTheme) {
        setIsDark(data.tabManagerTheme === "dark");
      }
    });

    checkBackgroundAIStatus();
    chrome.storage.local.get("autoGroupingEnabled", (data) => {
      setEnabled(data.autoGroupingEnabled ?? true); // default ON
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save theme preference
  useEffect(() => {
    chrome.storage.local.set({ tabManagerTheme: isDark ? "dark" : "light" });
  }, [isDark]);

  // Auto-handle help prompt
  useEffect(() => {
    if (prompt === "help") handleSend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt]);

  // Handle language change
  const onChangeLanguage = async (lang) => {
    // capture the previous language code BEFORE updating state
    const prevLangCode = language?.code ?? "en";

    setLanguage(lang); // Update the language state

    // --- NEW LOGIC: Handle switching TO English ---
    if (lang.code === "en") {
      setLanguageSession(null); // Clear the translator session

      // Manually reset all UI text to English
      setTitle("AI TAB MANAGER");
      setActive("Auto-Active");
      setTabsText("Tabs Open");
      setGroup("Groups");
      setHelp("Help");
      setOrganise("Organise Now");
      setClear("Clear Chat");
      return; // Stop here. We don't need to create a translator.
    }
    // --- END NEW LOGIC ---

    // If not switching to English, create a new translator using the current source language
    // (use prevLangCode so source language follows what was active before the change)
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
      console.error("❌ Proofreader AI initialization failed:", error);
    }
  };

  // Initialize language change AI — now accepts sourceLanguage
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
        setLanguageSession(session); // <-- Set state to trigger re-render for chat
        return session; // <-- Return session for immediate use
      }
      return null;
    } catch (error) {
      console.error("❌ Language Change AI initialization failed:", error);
      setLanguageSession(null); // Set to null on error
      return null;
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
        windowId: tab.windowId,
      }));
  };

  // Detect command from user input
  const detectCommand = (text) => {
    const lower = text.toLowerCase();
    if (lower === "help" || lower === "commands") return { type: "help" };

    // Detect intent-based "open" commands with AI understanding
    if (
      lower.startsWith("open ") ||
      lower.startsWith("visit ") ||
      lower.startsWith("go to ") ||
      lower.includes("open new tab") ||
      lower.match(/^(launch|start)\s+/) ||
      // Intent-based patterns
      lower.includes("i want to") ||
      lower.includes("take me to") ||
      lower.includes("show me") ||
      lower.match(/^(watch|play|listen|read|buy|shop|search for)/i)
    ) {
      const site = text
        .replace(/^(open|visit|go to|launch|start|open new tab|open new tab for|open new tab with)\s+/i, "")
        .replace(/^(i want to|take me to|show me)\s+/i, "")
        .trim();
      return { type: "openSite", site, originalText: text };
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
    // Enhanced search detection - match any natural language query
    if (
      lower.startsWith("search ") ||
      lower.startsWith("find ") ||
      lower.startsWith("switch to ") ||
      lower.includes("where is") ||
      lower.includes("looking for") ||
      lower.match(/^find (my|the)\s+/i) ||
      lower.match(/^show (my|the)\s+/i) ||
      // Question patterns
      lower.match(/^(what|which|where).*(tab|page|site|email|mail)/i) ||
      // Email-specific searches
      lower.match(/^(email|mail)\s+(from|about|with|regarding)/i) ||
      // Direct queries without keywords
      (!lower.includes("group") && !lower.includes("organize") &&
        !lower.includes("categorize") && !lower.includes("sort") &&
        !lower.includes("open") && !lower.includes("visit") &&
        !lower.includes("i want") && !lower.includes("watch") &&
        !lower.includes("play") && !lower.includes("listen") &&
        text.split(" ").length <= 5 && text.length > 3)
    ) {
      const query = text
        .replace(/^(search|find|switch to|where is|looking for)\s+/i, "")
        .replace(/^(what|which|where).*?(tab|page|site|email|mail)\s+/i, "")
        .replace(/^(show|find)\s+(my|the)\s+/i, "")
        .trim();
      return { type: "search", query: query || text };
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

  // ---------------- SITE OPENING HELPER ----------------
  async function openNewSite(siteName, originalText = "") {
    try {
      // Use AI to intelligently convert site name/intent to URL
      if (sessionRef.current) {
        const aiPrompt = `You are a smart URL resolver. Convert the user's intent or site name to the correct URL.

User said: "${originalText || siteName}"

RULES:
1. Understand user INTENT, not just literal text
2. For activity-based requests, open the right platform:
   - "watch reels" → Instagram Reels
   - "watch shorts" → YouTube Shorts
   - "watch videos" → YouTube
   - "listen to music" → Spotify or YouTube Music
   - "read news" → News site
   - "shop" → Amazon
   - "buy something" → Amazon
   - "search for X" → Google search for X

3. For site names, return the main URL:
   - "google" → https://www.google.com
   - "youtube" → https://www.youtube.com
   - "github" → https://github.com
   - "stackoverflow" → https://stackoverflow.com
   - "instagram" → https://www.instagram.com
   - "facebook" → https://www.facebook.com
   - "twitter" or "x" → https://twitter.com
   - "reddit" → https://www.reddit.com
   - "linkedin" → https://www.linkedin.com
   - "amazon" → https://www.amazon.com
   - "netflix" → https://www.netflix.com
   - "spotify" → https://www.spotify.com
   - "gmail" → https://mail.google.com
   - "outlook" → https://outlook.live.com
   - "docs" → https://docs.google.com
   - "drive" → https://drive.google.com
   - "maps" → https://maps.google.com
   - "translate" → https://translate.google.com
   - "wikipedia" → https://www.wikipedia.org

4. For specific platform features:
   - "instagram reels" → https://www.instagram.com/reels/
   - "youtube shorts" → https://www.youtube.com/shorts
   - "twitter trending" → https://twitter.com/explore
   - "reddit popular" → https://www.reddit.com/r/popular

5. Always use https://
6. If already a URL, return as-is
7. For ambiguous searches, use Google: https://www.google.com/search?q=QUERY

Return ONLY the URL, nothing else.`;

        const aiResponse = await sessionRef.current.prompt(aiPrompt);
        let url = aiResponse.trim().replace(/["\n]/g, "");

        // Fallback URL construction if AI fails or returns invalid
        if (!url.startsWith("http")) {
          url = constructURLFromIntent(originalText || siteName);
        }

        // Open the new tab
        await chrome.tabs.create({ url, active: true });
        return { success: true, url };
      } else {
        // Fallback without AI
        const url = constructURLFromIntent(originalText || siteName);
        await chrome.tabs.create({ url, active: true });
        return { success: true, url };
      }
    } catch (err) {
      console.error("Error opening site:", err);
      return { success: false, error: err.message };
    }
  }

  // Enhanced fallback URL construction with intent understanding
  function constructURLFromIntent(text) {
    const lower = text.toLowerCase().trim();

    // Already a URL
    if (lower.startsWith("http://") || lower.startsWith("https://")) {
      return text;
    }

    // Intent-based mapping
    const intentMap = {
      // Video/Entertainment
      "watch reels": "https://www.instagram.com/reels/",
      "watch shorts": "https://www.youtube.com/shorts",
      "watch videos": "https://www.youtube.com",
      "watch youtube": "https://www.youtube.com",
      "watch movies": "https://www.netflix.com",
      "watch netflix": "https://www.netflix.com",

      // Music
      "listen to music": "https://www.spotify.com",
      "listen music": "https://www.spotify.com",
      "play music": "https://www.spotify.com",
      "play songs": "https://www.spotify.com",

      // Social Media
      "check instagram": "https://www.instagram.com",
      "check facebook": "https://www.facebook.com",
      "check twitter": "https://twitter.com",
      "check reddit": "https://www.reddit.com",

      // Shopping
      "shop": "https://www.amazon.com",
      "buy something": "https://www.amazon.com",
      "shopping": "https://www.amazon.com",

      // Reading
      "read news": "https://news.google.com",
      "read articles": "https://news.google.com",

      // Work
      "check email": "https://mail.google.com",
      "check gmail": "https://mail.google.com",
      "check mail": "https://mail.google.com",
      "write email": "https://mail.google.com",
    };

    // Check intent matches
    for (const [intent, url] of Object.entries(intentMap)) {
      if (lower.includes(intent)) {
        return url;
      }
    }

    // Common sites mapping
    const commonSites = {
      "google": "https://www.google.com",
      "youtube": "https://www.youtube.com",
      "facebook": "https://www.facebook.com",
      "twitter": "https://twitter.com",
      "x": "https://x.com",
      "instagram": "https://www.instagram.com",
      "linkedin": "https://www.linkedin.com",
      "github": "https://github.com",
      "reddit": "https://www.reddit.com",
      "amazon": "https://www.amazon.com",
      "netflix": "https://www.netflix.com",
      "spotify": "https://www.spotify.com",
      "gmail": "https://mail.google.com",
      "outlook": "https://outlook.live.com",
      "yahoo": "https://www.yahoo.com",
      "stackoverflow": "https://stackoverflow.com",
      "stack overflow": "https://stackoverflow.com",
      "wikipedia": "https://www.wikipedia.org",
      "docs": "https://docs.google.com",
      "drive": "https://drive.google.com",
      "maps": "https://maps.google.com",
      "news": "https://news.google.com",
      "translate": "https://translate.google.com",
      "reels": "https://www.instagram.com/reels/",
      "shorts": "https://www.youtube.com/shorts",
    };

    // Extract key site name from text
    for (const [key, url] of Object.entries(commonSites)) {
      if (lower.includes(key)) {
        return url;
      }
    }

    // If it looks like a domain (contains dot)
    if (lower.includes(".")) {
      return `https://${lower}`;
    }

    // Otherwise, Google search
    return `https://www.google.com/search?q=${encodeURIComponent(text)}`;
  }

  // ---------------- FUSE + AI helpers ----------------
  // queryFuse: asks background to run fuseSearch
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

  // rankWithAI: ask Gemini Nano to pick best candidate among top N
  async function rankWithAI(query, candidates = [], maxCandidates = 8, sessionRefLocal) {
    if (!sessionRefLocal?.current) {
      return { chosenIndex: 0, reason: "no ai session" };
    }

    const top = candidates.slice(0, maxCandidates);
    if (top.length === 0) {
      return { chosenIndex: -1, reason: "no candidates" };
    }

    // Build detailed candidate list emphasizing content differences
    const candidateText = top.map((c, i) => {
      const title = c.title || "";
      const url = c.url || "";
      const snippet = (c.snippet || "").slice(0, 500);

      // Extract domain for context
      let domain = "";
      try {
        domain = new URL(url).hostname.replace(/^www\./, "");
      } catch { }

      return `${i + 1}) "${title}"
   Domain: ${domain}
   Content: ${snippet || "No content available"}`;
    }).join("\n\n");

    const promptText = `You are a smart tab-ranking assistant. The user wants to find a specific tab.

User query: "${query}"

Available tabs:
${candidateText}

INSTRUCTIONS:
- Analyze the query to understand what the user is looking for
- Match based on: topic relevance, keywords, content meaning (not just title similarity)
- For ambiguous queries, prefer the most recently active or most relevant tab
- Consider the full content snippet, not just the title

Return ONLY this JSON:
{ "matchIndex": <1-based index>, "confidence": "low|medium|high", "reason": "<brief explanation>" }`;

    try {
      const raw = await sessionRefLocal.current.prompt(promptText);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { chosenIndex: 0, reason: "no JSON in AI response", raw };
      }
      const parsed = JSON.parse(jsonMatch[0]);
      const idx = (parsed.matchIndex || 1) - 1;
      return {
        chosenIndex: Math.max(0, Math.min(idx, top.length - 1)),
        confidence: parsed.confidence,
        reason: parsed.reason || ""
      };
    } catch (err) {
      console.error("AI rank error:", err);
      return { chosenIndex: 0, reason: "ai error" };
    }
  }

  // searchAndOpen: full flow used by the UI when user searches
  async function searchAndOpen(query) {
    // Proofread first if available
    if (proofreaderRef.current) {
      try {
        const proof = await proofreaderRef.current.proofread(query);
        query = proof.correctedInput || query;
      } catch (err) {
        console.warn("Proofreader failed:", err);
      }
    }

    // 1) Get Fuse candidates
    const candidates = await queryFuse(query, 12);

    if (!candidates || candidates.length === 0) {
      // Fallback: basic keyword search in all tabs
      console.log("🔎 No Fuse results, trying fallback...");
      const q = query.toLowerCase();
      const all = await chrome.tabs.query({ currentWindow: true });
      const match = all.find(t => {
        const title = (t.title || "").toLowerCase();
        const url = (t.url || "").toLowerCase();
        return title.includes(q) || url.includes(q);
      });

      if (match) {
        try {
          await chrome.tabs.update(match.id, { active: true });
          await chrome.windows.update(match.windowId, { focused: true });
          return { opened: true, method: "fallback", title: match.title, url: match.url };
        } catch (err) {
          console.error("Tab activation error:", err);
          return { opened: false, error: "Could not switch to tab" };
        }
      }
      return { opened: false, error: "No matching tabs found" };
    }

    console.log(`🔎 Found ${candidates.length} candidates from Fuse`);

    // 2) If AI available and multiple candidates, use it to rank
    if (sessionRef.current && aiStatus === "ready" && candidates.length > 1) {
      try {
        const { chosenIndex, confidence, reason } = await rankWithAI(query, candidates, 8, sessionRef);
        const chosen = candidates[Math.max(0, Math.min(chosenIndex, candidates.length - 1))];

        if (chosen && chosen.id) {
          console.log(`🤖 AI selected: ${chosen.title} (confidence: ${confidence})`);
          console.log(`   Reason: ${reason}`);
          try {
            await chrome.tabs.update(chosen.id, { active: true });
            await chrome.windows.update(chosen.windowId, { focused: true });
            return { opened: true, method: "ai", title: chosen.title, url: chosen.url, confidence, reason };
          } catch (err) {
            console.error("Tab activation error:", err);
            return { opened: false, error: "Tab no longer exists" };
          }
        }
      } catch (err) {
        console.error("AI ranking failed:", err);
        // Continue to fallback below
      }
    }

    // 3) Fallback: open top Fuse result
    const top = candidates[0];
    if (top && top.id) {
      try {
        await chrome.tabs.update(top.id, { active: true });
        await chrome.windows.update(top.windowId, { focused: true });
        return { opened: true, method: "fuse", title: top.title, url: top.url };
      } catch (err) {
        console.error("Tab activation error:", err);
        return { opened: false, error: "Tab no longer exists" };
      }
    }

    return { opened: false, error: "No valid tabs found" };
  }

  // ---------------- Existing grouping-related helpers (original logic) ----------------
  const askAIToGroupTabs = async (tabs, userRequest) => {
    if (!sessionRef.current) throw new Error("AI session not available");
    const tabsList = tabs
      .map(
        (tab) => `Tab ${tab.id}: "${tab.title}" - ${new URL(tab.url).hostname}`
      )
      .join("\n");
    const response = await sessionRef.current.prompt(`Analyze ${tabs.length
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

  // ---------------- handleSend (main user input dispatcher) ----------------
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

      // NEW: Handle opening sites
      if (command.type === "openSite") {
        const result = await openNewSite(command.site);
        setLoading(false);
        if (result.success) {
          addMessage(
            `✅ Opened new tab: ${result.url}`,
            "bot"
          );
          await updateTabCount();
        } else {
          addMessage(`❌ Could not open "${command.site}": ${result.error}`, "bot");
        }
        return;
      }

      if (command.type === "search") {
        const result = await searchAndOpen(command.query);
        setLoading(false);
        if (result.opened) {
          let msg = `✅ Opened: "${result.title}"`;
          if (result.confidence) {
            msg += `\n\n🎯 Match confidence: ${result.confidence}`;
          }
          if (result.reason) {
            msg += `\n💡 ${result.reason}`;
          }
          addMessage(msg, "bot");
        } else {
          addMessage(`❌ No match found for "${command.query}"`, "bot");
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
          let message = "";
          if (result.groupsCreated > 0 && result.tabsAddedToExisting > 0) {
            message = `✅ Created ${
              result.groupsCreated
            } new group(s) and added ${
              result.tabsAddedToExisting
            } tab(s) to existing groups!\n\n${result.groups
              .map((n) => `• ${n}`)
              .join("\n")}`;
          } else if (result.groupsCreated > 0) {
            message = `✅ Created ${
              result.groupsCreated
            } groups!\n\n${result.groups.map((n) => `• ${n}`).join("\n")}`;
          } else if (result.tabsAddedToExisting > 0) {
            message = `✅ Added ${result.tabsAddedToExisting} tab(s) to existing groups!`;
          }
          addMessage(message, "bot");
          await updateTabCount();
          await loadGroups();
          setShowGroupManager(true);
        } else {
          addMessage(`❌ Error: ${result.error}`, "bot");
        }
        return;
      }

      // Generic chat fallback
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

  // ---------------------- UI Render ----------------------
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

          {/* Header controls: Auto-group toggle, language, theme */}
          <div className="w-72 flex items-center gap-3">
            {/* Auto-group toggle */}
            <ToggleButton
              enabled={enabled}
              onChange={toggleFeature}
              isDark={isDark}
            />

            {/* Language and theme */}
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
