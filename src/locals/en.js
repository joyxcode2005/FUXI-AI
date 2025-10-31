export const helpMessageHTML = `
<div class="text-sm" style="color: inherit;">
  <h2 class="text-lg font-bold mb-2 flex items-center gap-2">🚀 AI Tab Manager Help</h2>
  <p class="mb-3">I can find open tabs, open new sites intelligently, and organize your workspace.</p>
  <hr class="my-3 border-slate-600/50">

  <h3 class="text-base font-semibold mt-4 mb-2">1. 🔍 Reliable Smart Search (Your Main Command)</h3>
  <p class="mb-2">This is the main "do-it-all" command. It provides <strong class="font-semibold text-black-300">reliable search</strong> by instantly scanning the <strong class="font-semibold">title, URL, and full text content</strong> of all your open tabs to find the best match.</p>
  <p class="mb-2">If no open tab is found, it intelligently searches the web for you.</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"react dashboard"</strong> (Finds your \`localhost:3000\` tab)</li>
    <li><strong>"find my-jira-ticket-123"</strong></li>
    <li><strong>"open pull request"</strong></li>
  </ul>

  <h3 class="text-base font-semibold mt-4 mb-2">2. 💻 Smart Opener & Shortcuts</h3>
  <p class="font-medium mb-1 mt-1">Developer Examples:</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"open github react"</strong> → Opens \`facebook/react\`</li>
    <li><strong>"open so react query error"</strong> → Finds top answer on Stack Overflow</li>
    <li><strong>"open github account"</strong> → Opens your profile</li>
  </ul>
  <p class="font-medium mb-1 mt-2">Media & Content Search:</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"i want to see react tutorial on youtube"</strong></li>
    <li><strong>"open oppenheimer review on youtube"</strong></li>
    <li><strong>"find stranger things on netflix"</strong></li>
  </ul>
  <p class="font-medium mb-1 mt-2">Quick Site Shortcuts:</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"listen to music"</strong> → Opens Spotify</li>
    <li><strong>"watch reels"</strong> → Opens Instagram Reels</li>
  </ul>

  <h3 class="text-base font-semibold mt-4 mb-2">3. 📧 Gmail Context Search</h3>
  <p class="mb-2">Search <em>inside</em> your open Gmail tabs (this is separate from the main search).</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"find mail from google"</strong></li>
    <li><strong>"open email about meeting"</strong></li>
  </ul>

  <h3 class="text-base font-semibold mt-4 mb-2">4. 🗂️ Tab & Group Organization</h3>
  <ul class="list-disc list-inside pl-2 space-y-1">
    <li><strong>"organize"</strong> / <strong>"organize my tabs"</strong></li>
    <li><strong>"group all as [name]"</strong> (e.g., \`group all as Work\`)</li>
    <li><strong>"list groups"</strong> / <strong>"groups"</strong></li>
    <li><strong>"rename [old] to [new]"</strong></li>
    <li><strong>"ungroup [name]"</strong></li>
    <li><strong>"help"</strong> (Shows this message)</li>
  </ul>
</div>
`;