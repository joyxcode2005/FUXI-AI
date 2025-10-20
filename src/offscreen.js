// src/offscreen.js
import { systemPrompt } from "./utils";

console.log("🧠 Offscreen AI handler ready");

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type !== "AI_GROUP_TABS") return;

  try {
    const result = await handleAIGrouping(msg.tabs);
    sendResponse(result);
  } catch (err) {
    sendResponse({ error: err.message });
  }
  return true;
});

async function handleAIGrouping(tabs) {
  const model = await window.ai.languageModel.create({ systemPrompt });

  const tabsList = tabs
    .map((t) => `Tab ${t.id}: "${t.title}" - ${new URL(t.url).hostname}`)
    .join("\n");

  const prompt = `
You are a Chrome tab organizer AI.
Group the following tabs logically.
Return valid JSON only:
{
  "groups": { "GroupName": [tabIds...] },
  "explanation": "short summary"
}

Tabs:
${tabsList}
`;

  const response = await model.prompt(prompt);
  const cleaned = response.trim().replace(/```json|```/g, "");
  return JSON.parse(cleaned);
}
