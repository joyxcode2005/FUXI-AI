import React, { useState } from "react";

export default function App() {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");

  const addMessage = (text, sender) => {
    setMessages((prev) => [...prev, { text, sender }]);
  };

  const handleSend = async () => {
    const text = prompt.trim();
    if (!text) return;

    addMessage(text, "user");
    setPrompt("");
    setLoading(true);
    try {
      // --- Replace this with your real Gemini Nano / AI API call ---
      // Example placeholder: simulate a short response
      const session = await LanguageModel.create({
        model: "gemini-nano",
      });

      const reply = await session.prompt(text);
      setLoading(false);
      // const reply = await fetch("https://your-api.example.com/generate", {...})
      //   .then(res => res.json())
      //   .then(data => data.reply);

      addMessage(reply, "bot");
    } catch (err) {
      addMessage("Error: " + err.message, "bot");
    }
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
        id="chat"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxHeight: 400,
          overflowY: "auto",
        }}
      >
        {loading ? (
          <div className="px-8 py-10 rounded-2xl items-start bg-white border-1 border-[#ccc]">
            Loading....
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

      <div id="input" style={{ display: "flex", marginTop: 10 }}>
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
