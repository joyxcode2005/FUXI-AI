export const helpMessageHTML = `
<div class="text-sm" style="color: inherit;">
  <h2 class="text-lg font-bold mb-2 flex items-center gap-2">🚀 Aide du Gestionnaire d'Onglets IA</h2>
  <p class="mb-3">Je peux trouver des onglets ouverts, ouvrir de nouveaux sites intelligemment et organiser votre espace de travail.</p>
  <hr class="my-3 border-slate-600/50">

  <h3 class="text-base font-semibold mt-4 mb-2">1. 🔍 Recherche Intelligente Fiable (Votre Commande Principale)</h3>
  <p class="mb-2">C'est la commande principale "à tout faire". Elle offre une <strong class="font-semibold text-black-300">recherche fiable</strong> en scannant instantanément le <strong class="font-semibold">titre, l'URL et le contenu textuel complet</strong> de tous vos onglets ouverts pour trouver la meilleure correspondance.</p>
  <p class="mb-2">Si aucun onglet ouvert n'est trouvé, il recherche intelligemment sur le web pour vous.</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"react dashboard"</strong> (Trouve votre onglet \`localhost:3000\`)</li>
    <li><strong>"find my-jira-ticket-123"</strong></li>
    <li><strong>"open pull request"</strong></li>
  </ul>

  <h3 class="text-base font-semibold mt-4 mb-2">2. 💻 Ouvreur Intelligent & Raccourcis</h3>
  <p class="font-medium mb-1 mt-1">Exemples pour Développeurs :</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"open github react"</strong> → Ouvre \`facebook/react\`</li>
    <li><strong>"open so react query error"</strong> → Trouve la meilleure réponse sur Stack Overflow</li>
    <li><strong>"open github account"</strong> → Ouvre votre profil</li>
  </ul>
  <p class="font-medium mb-1 mt-2">Recherche Média & Contenu :</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"i want to see react tutorial on youtube"</strong></li>
    <li><strong>"open oppenheimer review on youtube"</strong></li>
    <li><strong>"find stranger things on netflix"</strong></li>
  </ul>
  <p class="font-medium mb-1 mt-2">Raccourcis de Site Rapides :</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"listen to music"</strong> → Ouvre Spotify</li>
    <li><strong>"regarder reels"</strong> → Ouvre Instagram Reels</li>
  </ul>

  <h3 class="text-base font-semibold mt-4 mb-2">3. 📧 Recherche Contextuelle Gmail</h3>
  <p class="mb-2">Recherchez <em>à l'intérieur</em> de vos onglets Gmail ouverts (ceci est distinct de la recherche principale).</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"find mail from google"</strong></li>
    <li><strong>"open email about meeting"</strong></li>
  </ul>

  <h3 class="text-base font-semibold mt-4 mb-2">4. 🗂️ Organisation Onglets & Groupes</h3>
  <ul class="list-disc list-inside pl-2 space-y-1">
    <li><strong>"organize"</strong> / <strong>"organize my tabs"</strong></li>
    <li><strong>"group all as [name]"</strong> (ex., \`group all as Work\`)</li>
    <li><strong>"list groups"</strong> / <strong>"groups"</strong></li>
    <li><strong>"rename [old] to [new]"</strong></li>
    <li><strong>"ungroup [name]"</strong></li>
    <li><strong>"help"</strong> (Affiche ce message)</li>
  </ul>
</div>
`;