import { useEffect } from "react";
import { useState } from "react";
import { memo } from "react";

const TranslatedText = memo(function TranslatedText({
  msg,
  language,
  translatorSession,
}) {
  const [translated, setTranslated] = useState(msg?.text || "...");

  useEffect(() => {
    if (!msg?.text || !translatorSession) {
      setTranslated(msg.text);
      return;
    }

    if (language.code === "en") {
      setTranslated(msg.text);
      return;
    }

    let isCancelled = false;

    (async () => {
      try {
        const result = await translatorSession.translate(msg.text);
        if (!isCancelled) setTranslated(result);
      } catch (err) {
        console.error("Translation error:", err);
        if (!isCancelled) setTranslated(msg.text);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [msg?.text, language, translatorSession]);

  return <div>{translated}</div>;
});

export default TranslatedText;
