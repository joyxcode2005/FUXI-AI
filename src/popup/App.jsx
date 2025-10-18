import { useState, useRef } from "react";

// 🧩 1. Group all existing tabs under a given title
async function groupExistingTabs(title) {
  const tabs = await chrome.tabs.query({});
  const tabIds = tabs.map((t) => t.id);
  const groupId = await chrome.tabs.group({ tabIds });
  await chrome.tabGroups.update(groupId, { title, color: "blue" });
  console.log(`✅ Grouped all tabs under: ${title}`);
}

// 🧩 2. Rename a group by its current title
async function renameGroup(oldTitle, newTitle) {
  const groups = await chrome.tabGroups.query({});
  const targetGroup = groups.find(
    (g) => g.title.toLowerCase() === oldTitle.toLowerCase()
  );
  if (targetGroup) {
    await chrome.tabGroups.update(targetGroup.id, { title: newTitle });
    console.log(`✏️ Renamed group "${oldTitle}" to "${newTitle}"`);
  } else {
    console.warn(`No group found with title: ${oldTitle}`);
  }
}

// 🧩 3. Ungroup tabs from a specific group title
async function ungroupTabs(title) {
  const groups = await chrome.tabGroups.query({});
  const targetGroup = groups.find(
    (g) => g.title.toLowerCase() === title.toLowerCase()
  );
  if (targetGroup) {
    const tabs = await chrome.tabs.query({ groupId: targetGroup.id });
    const tabIds = tabs.map((t) => t.id);
    await chrome.tabs.ungroup(tabIds);
    console.log(`🚪 Ungrouped tabs from "${title}"`);
  } else {
    console.warn(`No group found with title: ${title}`);
  }
}

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

    // 👇 Add system instruction to make Gemini output JSON when needed
    const systemInstruction = `
You are a Chrome Extension Assistant. 
When the user asks to group tabs, respond ONLY in JSON as:
{"action":"group_tabs","title":"<group name>"}

If no name is given, suggest a fitting one.

Otherwise, respond normally in plain text.
`;

    return (
      systemInstruction + "\n" + context + `User: ${userMessage}\nAssistant:`
    );
  };

  const handleSend = async () => {
    const text = prompt.trim();
    if (!text) return;

    addMessage(text, "user");
    const currentMessages = [...messages, { text, sender: "user" }];
    setPrompt("");
    setLoading(true);

    try {
      if (!sessionRef.current) {
        sessionRef.current = await LanguageModel.create({
          model: "gemini-nano",
        });
      }

      const contextPrompt = buildContextPrompt(text, messages);
      const reply = await sessionRef.current.prompt(contextPrompt);

      setLoading(false);

      // 👇 Try to parse JSON — if it’s an action, execute it
      let parsed;
      try {
        parsed = JSON.parse(reply);
      } catch (_) {
        parsed = null;
      }

      if (parsed && parsed.action === "group_tabs" && parsed.title) {
        addMessage(`✅ Grouping tabs under: ${parsed.title}`, "bot");
        await groupExistingTabs(parsed.title);
      } else {
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
          Clear
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
