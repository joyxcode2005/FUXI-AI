// src/content/extractPageText.js
(function () {
  let hasInitialized = false;
  let hasSentInitialSnippet = false;

  function extract() {
    try {
      // Extract meaningful content
      const h1 = document.querySelector("h1")?.innerText?.trim() || "";
      const h2Elements = Array.from(document.querySelectorAll("h2"))
        .slice(0, 3)
        .map(el => el.innerText?.trim())
        .filter(Boolean)
        .join(" ");
      
      const metaDesc = document.querySelector('meta[name="description"]')?.content?.trim() || "";
      const metaKeywords = document.querySelector('meta[name="keywords"]')?.content?.trim() || "";
      
      // Special handling for Gmail and email apps
      let emailSubject = "";
      let emailContent = "";
      
      // Gmail selectors - enhanced
      const gmailSubject = document.querySelector('[data-message-id] h2')?.innerText || 
                          document.querySelector('.hP')?.innerText ||
                          document.querySelector('h2.hP')?.innerText || "";
      const gmailBody = document.querySelector('[data-message-id] .a3s')?.innerText ||
                       document.querySelector('.ii.gt')?.innerText ||
                       document.querySelector('div[data-message-id] div.a3s')?.innerText || "";
      
      if (gmailSubject || gmailBody) {
        emailSubject = gmailSubject;
        emailContent = gmailBody.slice(0, 1500);
      }
      
      // Get main content - prioritize article, main, or body
      let mainContent = "";
      
      if (emailSubject || emailContent) {
        // For emails, prioritize email content
        mainContent = `${emailSubject} ${emailContent}`;
      } else {
        const article = document.querySelector("article");
        const main = document.querySelector("main");
        const contentDiv = document.querySelector('[role="main"]');
        
        if (article) {
          mainContent = article.innerText || "";
        } else if (main) {
          mainContent = main.innerText || "";
        } else if (contentDiv) {
          mainContent = contentDiv.innerText || "";
        } else {
          mainContent = document.body?.innerText || "";
        }
      }
      
      // Clean and truncate
      mainContent = mainContent
        .replace(/\s+/g, " ")
        .replace(/[^\w\s.,!?@#-]/g, "")
        .trim()
        .slice(0, 3500);
      
      // Combine all content with email priority
      const snippet = emailSubject 
        ? [emailSubject, emailContent, h1, metaDesc, mainContent]
            .filter(Boolean)
            .join(" — ")
        : [h1, h2Elements, metaDesc, metaKeywords, mainContent]
            .filter(Boolean)
            .join(" — ");
      
      return snippet.slice(0, 4000);
    } catch (err) {
      console.error("Extract error:", err);
      return "";
    }
  }

  function sendSnippet() {
    const snippet = extract();
    if (!snippet || snippet.length < 50) {
      console.log("Content too short, skipping");
      return;
    }

    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage(
        {
          action: "pageSnippet",
          snippetText: snippet,
          url: window.location.href,
          title: document.title
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.log("Send content error:", chrome.runtime.lastError.message);
          } else {
            console.log("✅ Page content indexed successfully");
            hasSentInitialSnippet = true;
          }
        }
      );
    }
  }

  // Initialize
  hasInitialized = true;
  console.log("📄 Auto content indexing active");

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.action) return;

    if (msg.action === "sendPageSnippet") {
      const snippet = extract();
      if (!snippet || snippet.length < 50) {
        sendResponse({ ok: false, error: "no snippet" });
        return;
      }
      
      chrome.runtime.sendMessage(
        {
          action: "pageSnippet",
          snippetText: snippet,
          url: window.location.href,
          title: document.title
        },
        (bgResp) => {
          sendResponse({ ok: !!(bgResp && bgResp.ok), bgResp });
        }
      );
      return true;
    }

    if (msg.action === "ping") {
      sendResponse({ ok: true, from: "content-script" });
      return true;
    }
  });

  // Auto-send on page load complete
  if (document.readyState === "complete") {
    setTimeout(sendSnippet, 1500);
  } else {
    document.addEventListener("readystatechange", () => {
      if (document.readyState === "complete" && !hasSentInitialSnippet) {
        setTimeout(sendSnippet, 1500);
      }
    });
  }

  // Auto-send when page becomes visible (tab switching)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && hasInitialized) {
      setTimeout(sendSnippet, 800);
    }
  });

  // Backup: send after delay if nothing sent yet
  setTimeout(() => {
    if (hasInitialized && !hasSentInitialSnippet && document.readyState === "complete") {
      sendSnippet();
    }
  }, 3000);

  // For dynamic content (SPAs like Gmail), watch for changes
  if (window.location.href.includes("mail.google.com")) {
    let lastContent = "";
    const observer = new MutationObserver(() => {
      const currentContent = extract();
      if (currentContent && currentContent !== lastContent && currentContent.length > 100) {
        lastContent = currentContent;
        setTimeout(sendSnippet, 1000);
      }
    });
    
    setTimeout(() => {
      const targetNode = document.querySelector('[role="main"]') || document.body;
      observer.observe(targetNode, { 
        childList: true, 
        subtree: true 
      });
      console.log("📧 Gmail content observer active");
    }, 2000);
  }
})();