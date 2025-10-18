import React, { useState, useRef } from "react";

export default function App() {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const sessionRef = useRef(null);

  const addMessage = (text, sender) => {
    setMessages((prev) => [...prev, { text, sender }]);
  };

  const buildContextPrompt = (userMessage, conversationHistory) => {
    // Build a context string from previous messages
    let context = "";

    // Include the last few messages for context (adjust number as needed)
    const recentMessages = conversationHistory.slice(-6); // Last 6 messages (3 exchanges)

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

  const groupExistingTabs = async (groupTitle) => {
    // Query all tabs in the current window
    const tabs = await chrome.tabs.query({ currentWindow: true });

    // Extract their IDs
    const tabIds = tabs.map((tab) => tab.id);

    // Send message to background script
    chrome.runtime.sendMessage(
      { action: "groupExistingTabs", groupTitle, tabIds },
      (response) => {
        if (response.success) {
          alert(`Grouped ${tabIds.length} tabs into "${groupTitle}"!`);
        } else {
          alert(`Error: ${response.error}`);
        }
      }
    );
  };

  // Example call
  // groupExistingTabs("Work Tabs");

  const handleSend = async () => {
    const text = prompt.trim();
    if (!text) return;

    addMessage(text, "user");
    const currentMessages = [...messages, { text, sender: "user" }];
    setPrompt("");
    setLoading(true);

    try {
      // Create session once if it doesn't exist
      if (!sessionRef.current) {
        sessionRef.current = await LanguageModel.create({
          model: "gemini-nano",
        });
      }

      // Build prompt with conversation context
      const contextPrompt = buildContextPrompt(text, messages);

      const reply = await sessionRef.current.prompt(contextPrompt);

      setLoading(false);
      addMessage(reply, "bot");
    } catch (err) {
      setLoading(false);
      addMessage("Error: " + err.message, "bot");
    }
  };

  const handleReset = () => {
    setMessages([]);
    sessionRef.current = null;
  };

  return (
    <div
      style={{
        width: 320,
        padding: 12,
        background: "#f5f5f5",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14, color: "#666" }}>AI Chat</h3>
        <button
          onClick={handleReset}
          style={{
            padding: "4px 8px",
            fontSize: 12,
            border: "1px solid #ccc",
            background: "#fff",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Clear Chat
        </button>
        <button
          onClick={() => groupExistingTabs("Social Media")}
          style={{
            padding: "4px 8px",
            fontSize: 12,
            border: "1px solid #ccc",
            background: "#fff",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Create Group
        </button>
      </div>

      <div
        id="chat"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxHeight: 400,
          overflowY: "auto",
          marginBottom: 10,
        }}
      >
        {loading ? (
          <div style={{ color: "#666", fontSize: 14, padding: 8 }}>
            loading...
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`msg ${msg.sender}`}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                maxWidth: "80%",
                alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
                background: msg.sender === "user" ? "#007aff" : "#fff",
                color: msg.sender === "user" ? "#fff" : "#000",
                border:
                  msg.sender === "bot"
                    ? "1px solid #ccc"
                    : "1px solid transparent",
              }}
            >
              {msg.text}
            </div>
          ))
        )}
      </div>

      <div id="input" style={{ display: "flex" }}>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask something..."
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 6,
            border: "1px solid #ccc",
          }}
        />
        <button
          onClick={handleSend}
          style={{
            marginLeft: 6,
            padding: "8px 10px",
            border: "none",
            background: "#007aff",
            color: "white",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
