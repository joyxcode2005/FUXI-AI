export const helpMessageHTML = `
<div class="text-sm" style="color: inherit;">
  <h2 class="text-lg font-bold mb-2 flex items-center gap-2">🚀 Ayuda del Administrador de Pestañas IA</h2>
  <p class="mb-3">Puedo encontrar pestañas abiertas, abrir nuevos sitios de forma inteligente y organizar tu espacio de trabajo.</p>
  <hr class="my-3 border-slate-600/50">

  <h3 class="text-base font-semibold mt-4 mb-2">1. 🔍 Búsqueda Inteligente Fiable (Tu Comando Principal)</h3>
  <p class="mb-2">Este es el comando principal "todo en uno". Proporciona <strong class="font-semibold text-black-300">búsqueda fiable</strong> escaneando instantáneamente el <strong class="font-semibold">título, URL y contenido de texto completo</strong> de todas tus pestañas abiertas para encontrar la mejor coincidencia.</p>
  <p class="mb-2">Si no se encuentra ninguna pestaña abierta, busca inteligentemente en la web por ti.</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"react dashboard"</strong> (Encuentra tu pestaña \`localhost:3000\`)</li>
    <li><strong>"find my-jira-ticket-123"</strong></li>
    <li><strong>"open pull request"</strong></li>
  </ul>

  <h3 class="text-base font-semibold mt-4 mb-2">2. 💻 Apertura Inteligente y Atajos</h3>
  <p class="font-medium mb-1 mt-1">Ejemplos para Desarrolladores:</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"open github react"</strong> → Abre \`facebook/react\`</li>
    <li><strong>"open so react query error"</strong> → Encuentra la mejor respuesta en Stack Overflow</li>
    <li><strong>"open github account"</strong> → Abre tu perfil</li>
  </ul>
  <p class="font-medium mb-1 mt-2">Búsqueda de Medios y Contenido:</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"i want to see react tutorial on youtube"</strong></li>
    <li><strong>"open oppenheimer review on youtube"</strong></li>
    <li><strong>"find stranger things on netflix"</strong></li>
  </ul>
  <p class="font-medium mb-1 mt-2">Atajos Rápidos de Sitios:</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"listen to music"</strong> → Abre Spotify</li>
    <li><strong>"watch reels"</strong> → Abre Instagram Reels</li>
  </ul>

  <h3 class="text-base font-semibold mt-4 mb-2">3. 📧 Búsqueda en Contexto de Gmail</h3>
  <p class="mb-2">Busca <em>dentro</em> de tus pestañas de Gmail abiertas (esto es independiente de la búsqueda principal).</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"find mail from google"</strong></li>
    <li><strong>"open email about meeting"</strong></li>
  </ul>

  <h3 class="text-base font-semibold mt-4 mb-2">4. 🗂️ Organización de Pestañas y Grupos</h3>
  <ul class="list-disc list-inside pl-2 space-y-1">
    <li><strong>"organize"</strong> / <strong>"organize my tabs"</strong></li>
    <li><strong>"group all as [name]"</strong> (ej., \`group all as Work\`)</li>
    <li><strong>"list groups"</strong> / <strong>"groups"</strong></li>
    <li><strong>"rename [old] to [new]"</strong></li>
    <li><strong>"ungroup [name]"</strong></li>
    <li><strong>"help"</strong> (Muestra este mensaje)</li>
  </ul>
</div>
`;