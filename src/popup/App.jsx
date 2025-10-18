import React, { useState, useRef } from "react";
import {
  smartMatchTabs,
  extractGroupsFromAI,
  suggestCategories,
} from "../utils/tabMatcher";

export default function App() {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const sessionRef = useRef(null);

  const addMessage = (text, sender) => {
    setMessages((prev) => [...prev, { text, sender }]);
  };

  const buildContextPrompt = (userMessage, conversationHistory) => {
    let context = "";
    const recentMessages = conversationHistory.slice(-6);

    if (recentMessages.length > 0) {
      context = "Previous conversation:\n";
      recentMessages.forEach((msg) => {
        const role = msg.sender === "user" ? "User" : "Assistant";
        context += `${role}: ${msg.text}\n`;
      });
      context += "\n";
    }

    return context + `User: ${userMessage}\nAssistant:`;
  };

  // Check if user is asking to create/organize tab groups
  const isTabGroupingRequest = (text) => {
    const keywords = [
      "group",
      "organize",
      "categorize",
      "sort tabs",
      "create group",
      "organize tabs",
      "group tabs",
      "organize my tabs",
      "sort my tabs",
      "arrange tabs",
    ];
    const lowerText = text.toLowerCase();
    return keywords.some((keyword) => lowerText.includes(keyword));
  };

  // Get all current tabs (excluding special Chrome pages)
  const getAllTabs = async () => {
    return new Promise((resolve) => {
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        // Filter out chrome:// and other special URLs that can't be grouped
        const groupableTabs = tabs.filter((tab) => {
          const url = tab.url || "";
          return (
            !url.startsWith("chrome://") &&
            !url.startsWith("chrome-extension://") &&
            !url.startsWith("edge://") &&
            !url.startsWith("about:")
          );
        });

        const tabInfo = groupableTabs.map((tab) => ({
          id: tab.id,
          title: tab.title,
          url: tab.url,
        }));
        resolve(tabInfo);
      });
    });
  };

  // Execute tab grouping
  const executeTabGrouping = async (groupedTabs) => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: "createMultipleGroups", groupedTabs },
        (response) => {
          resolve(response);
        }
      );
    });
  };

  const handleSend = async () => {
    const text = prompt.trim();
    if (!text) return;

    addMessage(text, "user");
    setPrompt("");
    setLoading(true);

    try {
      // Create session once if it doesn't exist
      if (!sessionRef.current) {
        sessionRef.current = await LanguageModel.create({
          model: "gemini-nano",
        });
      }

      // Check if this is a tab grouping request
      if (isTabGroupingRequest(text)) {
        const tabs = await getAllTabs();

        if (tabs.length === 0) {
          setLoading(false);
          addMessage(
            "⚠️ No groupable tabs found. Chrome system pages (chrome://, chrome-extension://) cannot be grouped.\n\nPlease open some regular webpages first!",
            "bot"
          );
          return;
        }

        // Create special prompt for tab organization
        const tabList = tabs
          .map((tab, i) => `${i + 1}. ${tab.title} (${new URL(tab.url).hostname})`)
          .join("\n");

        const specialPrompt = `I have ${tabs.length} browser tabs open:
${tabList}

User request: ${text}

Analyze these tabs and create logical groups. For each group:
1. Give it a clear category name (like "Social Media", "Work", "Shopping", "Development")
2. List 2-3 keywords that describe tabs in that group

Keep your response concise. Format:
**Group Name**
keywords: keyword1, keyword2, keyword3`;

        const reply = await sessionRef.current.prompt(specialPrompt);
        setLoading(false);
        addMessage(reply, "bot");

        // Parse AI response and execute grouping
        const aiGroups = extractGroupsFromAI(reply);

        if (aiGroups.length > 0) {
          // Use smart matching combining AI and domain patterns
          const { groupedTabs, unmatchedTabs } = smartMatchTabs(tabs, aiGroups);

          // Filter out empty groups
          const finalGroups = Object.fromEntries(
            Object.entries(groupedTabs).filter(([_, tabIds]) => tabIds.length > 0)
          );

          if (Object.keys(finalGroups).length > 0) {
            // Execute grouping
            const result = await executeTabGrouping(finalGroups);

            if (result.success) {
              const summary = Object.entries(finalGroups)
                .map(([name, ids]) => `• ${name}: ${ids.length} tabs`)
                .join("\n");

              addMessage(
                `✓ Successfully organized tabs!\n\n${summary}${
                  unmatchedTabs.length > 0
                    ? `\n\n(${unmatchedTabs.length} tabs left ungrouped)`
                    : ""
                }`,
                "bot"
              );
            } else {
              addMessage(`Failed to create groups: ${result.error}`, "bot");
            }
          } else {
            addMessage(
              "Could not find any matching tabs for the suggested groups.",
              "bot"
            );
          }
        } else {
          // Fallback: Auto-suggest categories
          const autoGroups = suggestCategories(tabs);
          if (Object.keys(autoGroups).length > 0) {
            const result = await executeTabGrouping(autoGroups);
            if (result.success) {
              addMessage(
                `✓ Auto-organized tabs into ${result.groupsCreated} categories!`,
                "bot"
              );
            }
          } else {
            addMessage("Could not determine how to group these tabs.", "bot");
          }
        }
      } else {
        // Normal conversation
        const contextPrompt = buildContextPrompt(text, messages);
        const reply = await sessionRef.current.prompt(contextPrompt);
        setLoading(false);
        addMessage(reply, "bot");
      }
    } catch (err) {
      setLoading(false);
      addMessage("Error: " + err.message, "bot");
    }
  };

  const handleReset = () => {
    setMessages([]);
    sessionRef.current = null;
  };

  const quickOrganize = async () => {
    setLoading(true);
    try {
      const tabs = await getAllTabs();

      if (tabs.length === 0) {
        addMessage(
          "⚠️ No groupable tabs found. Please open some regular webpages first!",
          "bot"
        );
        setLoading(false);
        return;
      }

      const autoGroups = suggestCategories(tabs);

      if (Object.keys(autoGroups).length > 0) {
        const result = await executeTabGrouping(autoGroups);
        if (result.success) {
          addMessage(
            `✓ Quick organized ${tabs.length} tabs into ${result.groupsCreated} groups!`,
            "bot"
          );
        } else {
          addMessage(`Error: ${result.error}`, "bot");
        }
      } else {
        addMessage("No recognizable tab categories found for quick organize.", "bot");
      }
    } catch (err) {
      addMessage("Error: " + err.message, "bot");
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        width: 350,
        height: 500,
        padding: 12,
        background: "#f5f5f5",
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 8,
          gap: 4,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14, color: "#666", flex: 1 }}>
          🤖 AI Tab Manager
        </h3>
        <button
          onClick={quickOrganize}
          disabled={loading}
          style={{
            padding: "4px 8px",
            fontSize: 11,
            border: "1px solid #007aff",
            background: "#fff",
            color: "#007aff",
            borderRadius: 4,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          ⚡ Quick
        </button>
        <button
          onClick={handleReset}
          style={{
            padding: "4px 8px",
            fontSize: 11,
            border: "1px solid #ccc",
            background: "#fff",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Clear
        </button>
      </div>

      <div
        style={{
          fontSize: 11,
          color: "#888",
          marginBottom: 8,
          padding: "4px 8px",
          background: "#e8f4f8",
          borderRadius: 4,
        }}
      >
        💡 Try: "Organize my tabs" • "Group into work and personal" • Or use
        Quick!
      </div>

      <div
        id="chat"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          flex: 1,
          overflowY: "auto",
          marginBottom: 10,
          padding: 4,
        }}
      >
        {loading && (
          <div
            style={{
              color: "#666",
              fontSize: 13,
              padding: 12,
              textAlign: "center",
              background: "#fff",
              borderRadius: 8,
            }}
          >
            🔄 Analyzing tabs...
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              maxWidth: "85%",
              alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
              background: msg.sender === "user" ? "#007aff" : "#fff",
              color: msg.sender === "user" ? "#fff" : "#000",
              border:
                msg.sender === "bot" ? "1px solid #e0e0e0" : "none",
              fontSize: 13,
              lineHeight: 1.4,
              whiteSpace: "pre-wrap",
            }}
          >
            {msg.text}
          </div>
        ))}
      </div>

      <div id="input" style={{ display: "flex", gap: 6 }}>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && handleSend()}
          placeholder="Ask me to organize your tabs..."
          disabled={loading}
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 6,
            border: "1px solid #ccc",
            fontSize: 13,
          }}
        />
        <button
          onClick={handleSend}
          disabled={loading}
          style={{
            padding: "8px 12px",
            border: "none",
            background: loading ? "#ccc" : "#007aff",
            color: "white",
            borderRadius: 6,
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}