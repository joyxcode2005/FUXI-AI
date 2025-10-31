export const helpMessageHTML = `
<div class="text-sm" style="color: inherit;">
  <h2 class="text-lg font-bold mb-2 flex items-center gap-2">🚀 AI 标签页管理器帮助</h2>
  <p class="mb-3">我可以查找打开的标签页、智能打开新网站并整理您的工作区。</p>
  <hr class="my-3 border-slate-600/50">

  <h3 class="text-base font-semibold mt-4 mb-2">1. 🔍 可靠的智能搜索（您的主要命令）</h3>
  <p class="mb-2">这是主要的“全能”命令。它通过即时扫描所有打开标签页的<strong class="font-semibold">标题、URL 和全文内容</strong>来提供<strong class="font-semibold text-black-300">可靠的搜索</strong>，以找到最佳匹配。</p>
  <p class="mb-2">如果没有找到打开的标签页，它会智能地为您搜索网页。</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"react dashboard"</strong> (查找您的 \`localhost:3000\` 标签页)</li>
    <li><strong>"find my-jira-ticket-123"</strong></li>
    <li><strong>"open pull request"</strong></li>
  </ul>

  <h3 class="text-base font-semibold mt-4 mb-2">2. 💻 智能打开与快捷方式</h3>
  <p class="font-medium mb-1 mt-1">开发者示例：</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"open github react"</strong> → 打开 \`facebook/react\`</li>
    <li><strong>"open so react query error"</strong> → 在 Stack Overflow 上查找最佳答案</li>
    <li><strong>"open github account"</strong> → 打开您的个人资料</li>
  </ul>
  <p class="font-medium mb-1 mt-2">媒体和内容搜索：</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"i want to see react tutorial on youtube"</strong></li>
    <li><strong>"open oppenheimer review on youtube"</strong></li>
    <li><strong>"find stranger things on netflix"</strong></li>
  </ul>
  <p class="font-medium mb-1 mt-2">快速网站快捷方式：</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"listen to music"</strong> → 打开 Spotify</li>
    <li><strong>"watch reels"</strong> → 打开 Instagram Reels</li>
  </ul>

  <h3 class="text-base font-semibold mt-4 mb-2">3. 📧 Gmail 上下文搜索</h3>
  <p class="mb-2">在您打开的 Gmail 标签页<em>内</em>搜索（这与主搜索分开）。</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"find mail from google"</strong></li>
    <li><strong>"open email about meeting"</strong></li>
  </ul>

  <h3 class="text-base font-semibold mt-4 mb-2">4. 🗂️ 标签页和分组整理</h3>
  <ul class="list-disc list-inside pl-2 space-y-1">
    <li><strong>"organize"</strong> / <strong>"organize my tabs"</strong></li>
    <li><strong>"group all as [name]"</strong> (例如, \`group all as Work\`)</li>
    <li><strong>"list groups"</strong> / <strong>"groups"</strong></li>
    <li><strong>"rename [old] to [new]"</strong></li>
    <li><strong>"ungroup [name]"</strong></li>
    <li><strong>"help"</strong> (显示此消息)</li>
  </ul>
</div>
`;