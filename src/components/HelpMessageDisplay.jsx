import React from "react";
// 1. Import the single object from your locales folder
import { helpMessages } from "../locals";
/**
 * A component that displays the pre-translated help message
 * based on the provided language.
 *
 * @param {object} props
 * @param {object} props.language - The current language object, e.g., { code: 'en' }
 */
function HelpMessageDisplay({ language }) {
  // 2. Get the language code (e.g., 'en', 'es', 'ar').
  //    Default to 'en' if the language isn't set.
  const langCode = language?.code || "en";

  // 3. Select the correct HTML string from our imports.
  //    If the code isn't found (e.g., 'it'), it will fall back to English.
  const htmlToShow = helpMessages[langCode] || helpMessages["en"];

  // 4. Check if the language is Right-to-Left (RTL)
  const isRTL = langCode === "ar";

  // 5. Render the HTML.
  //    We add the `dir="rtl"` attribute ONLY for Arabic.
  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      dangerouslySetInnerHTML={{ __html: htmlToShow }}
    />
  );
}

// Use memo to prevent re-rendering if the language prop hasn't changed
export default React.memo(HelpMessageDisplay);
