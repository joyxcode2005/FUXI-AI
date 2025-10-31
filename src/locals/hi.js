export const helpMessageHTML = `
<div class="text-sm" style="color: inherit;">
  <h2 class="text-lg font-bold mb-2 flex items-center gap-2">🚀 एआई टैब मैनेजर सहायता</h2>
  <p class="mb-3">मैं खुले टैब ढूंढ सकता हूं, समझदारी से नई साइटें खोल सकता हूं, और आपके कार्यक्षेत्र को व्यवस्थित कर सकता हूं।</p>
  <hr class="my-3 border-slate-600/50">

  <h3 class="text-base font-semibold mt-4 mb-2">1. 🔍 विश्वसनीय स्मार्ट खोज (आपका मुख्य कमांड)</h3>
  <p class="mb-2">यह मुख्य "सब-कुछ-करने-वाला" कमांड है। यह आपके सभी खुले टैब के <strong class="font-semibold">शीर्षक, यूआरएल और पूरे टेक्स्ट को</strong> तुरंत स्कैन करके <strong class="font-semibold text-black-300">विश्वसनीय खोज</strong> प्रदान करता है ताकि सबसे अच्छा मेल मिल सके।</p>
  <p class="mb-2">यदि कोई खुला टैब नहीं मिलता है, तो यह आपके लिए वेब पर समझदारी से खोज करता है।</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"react dashboard"</strong> (आपका \`localhost:3000\` टैब ढूँढता है)</li>
    <li><strong>"find my-jira-ticket-123"</strong></li>
    <li><strong>"open pull request"</strong></li>
  </ul>

  <h3 class="text-base font-semibold mt-4 mb-2">2. 💻 स्मार्ट ओपनर और शॉर्टकट</h3>
  <p class="font-medium mb-1 mt-1">डेवलपर उदाहरण:</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"open github react"</strong> → \`facebook/react\` खोलता है</li>
    <li><strong>"open so react query error"</strong> → Stack Overflow पर शीर्ष उत्तर ढूँढता है</li>
    <li><strong>"open github account"</strong> → आपकी प्रोफ़ाइल खोलता है</li>
  </ul>
  <p class="font-medium mb-1 mt-2">मीडिया और सामग्री खोज:</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"i want to see react tutorial on youtube"</strong></li>
    <li><strong>"open oppenheimer review on youtube"</strong></li>
    <li><strong>"find stranger things on netflix"</strong></li>
  </ul>
  <p class="font-medium mb-1 mt-2">त्वरित साइट शॉर्टकट:</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"listen to music"</strong> → Spotify खोलता है</li>
    <li><strong>"watch reels"</strong> → Instagram Reels खोलता है</li>
  </ul>

  <h3 class="text-base font-semibold mt-4 mb-2">3. 📧 जीमेल प्रसंग खोज</h3>
  <p class="mb-2">अपने खुले जीमेल टैब <em>के अंदर</em> खोजें (यह मुख्य खोज से अलग है)।</p>
  <ul class="list-disc list-inside pl-2 space-y-1 mb-2">
    <li><strong>"find mail from google"</strong></li>
    <li><strong>"open email about meeting"</strong></li>
  </ul>

  <h3 class="text-base font-semibold mt-4 mb-2">4. 🗂️ टैब और समूह संगठन</h3>
  <ul class="list-disc list-inside pl-2 space-y-1">
    <li><strong>"organize"</strong> / <strong>"organize my tabs"</strong></li>
    <li><strong>"group all as [name]"</strong> (उदा., \`group all as Work\`)</li>
    <li><strong>"list groups"</strong> / <strong>"groups"</strong></li>
    <li><strong>"rename [old] to [new]"</strong></li>
    <li><strong>"ungroup [name]"</strong></li>
    <li><strong>"help"</strong> (यह संदेश दिखाता है)</li>
  </ul>
</div>
`;