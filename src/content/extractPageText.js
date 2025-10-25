// src/content/extractPageText.js - FINAL VERSION (Unchanged)
(function () {
  let hasInitialized = false;
  let hasSentInitialSnippet = false;
  let debounceTimeout = null; // For debouncing DOM changes

  function extract() {
    try {
      // Prioritize specific content elements
      const mainContentSelectors = [
        'article',
        'main',
        '[role="main"]',
        '.content', // Common class names
        '.main-content',
        '#content', // Common IDs
        '#main'
      ];
      let mainContentEl = null;
      for (const selector of mainContentSelectors) {
          mainContentEl = document.querySelector(selector);
          if (mainContentEl) break;
      }

      // Extract Headers
      const h1 = document.querySelector("h1")?.innerText?.trim() || "";
      // Get first few H2s within the main content if found, otherwise from body
      const scope = mainContentEl || document.body;
      const h2Elements = Array.from(scope.querySelectorAll("h2"))
        .slice(0, 4) // Get a few more H2s
        .map(el => el.innerText?.trim())
        .filter(Boolean)
        .join(" | "); // Use a separator

      // Meta tags
      const metaDesc = document.querySelector('meta[name="description"]')?.content?.trim() || "";
      const metaKeywords = document.querySelector('meta[name="keywords"]')?.content?.trim() || "";
      
      // --- REVISED GMAIL + MAIN CONTENT LOGIC ---
      let textContent = "";

      if (window.location.hostname === "mail.google.com") {
          // *** NEW GMAIL STRATEGY: Grab all text from the main pane ***
          // This will get inbox list (senders, subjects, previews) OR the open email
          // Gmail's main content area is almost always [role="main"]
          const gmailPane = document.querySelector('[role="main"]') || document.body;
          
          // Clone and remove junk, but be less aggressive than before
          const clone = gmailPane.cloneNode(true);
          // Remove things that are definitely not useful content
          clone.querySelectorAll('nav, header, script, style, button, form, [role="navigation"], [role="banner"], [aria-hidden="true"]').forEach(el => el.remove());
          textContent = clone.innerText || "";
          
          // If we're on the inbox, the H1 is "Inbox", which is useless.
          // The title "Inbox (123) - user@gmail.com" is much better.
          if (h1.toLowerCase().includes("inbox")) {
             textContent = `${document.title} ${textContent}`;
          }

      } else if (mainContentEl) {
          // Original logic for other sites
          const clone = mainContentEl.cloneNode(true);
          clone.querySelectorAll('nav, header, footer, aside, script, style, button, form, [role="navigation"], [role="banner"], [role="contentinfo"], [aria-hidden="true"]').forEach(el => el.remove());
          textContent = clone.innerText || "";
      } else {
          // Original fallback to body
          const bodyClone = document.body.cloneNode(true);
           bodyClone.querySelectorAll('nav, header, footer, aside, script, style, button, form, [role="navigation"], [role="banner"], [role="contentinfo"], [aria-hidden="true"], .sidebar, .menu, #sidebar, #menu').forEach(el => el.remove());
          textContent = bodyClone.innerText || document.body?.innerText || "";
      }
      // --- END REVISED LOGIC ---


      // Clean and truncate main text content
      textContent = textContent
        .replace(/(\r\n|\n|\r){3,}/g, "\n\n") // Reduce multiple newlines
        .replace(/\s{2,}/g, " ") // Reduce multiple spaces
        .replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, '') // Remove weird characters, keep punctuation/spaces
        .trim()
        .slice(0, 3000); // Main content limit

      // Combine relevant parts, giving priority based on availability
      // We removed the specific email vars because textContent now includes everything
      const parts = [
          h1,
          h2Elements,
          metaDesc,
          textContent, // Main cleaned text
          metaKeywords // Keywords last, lower priority
        ].filter(Boolean); // Remove empty parts

      const snippet = parts.join(" — ").slice(0, 4000); // Combine and apply final length limit

      return snippet;
    } catch (err) {
      console.error("Content script extract error:", err);
      return ""; // Return empty string on error
    }
  }

  function sendSnippet() {
    // Avoid sending if a send is already queued by debounce
    if (debounceTimeout) return;

    const snippet = extract();

    // --- DEBUGGING: Log the snippet ---
    // This will show up in the Gmail tab's developer console
    console.log(`[AI Tab Mgr] Extracted Snippet (${snippet.length} chars):`, snippet.slice(0, 500) + "...");
    // --- END DEBUGGING ---

    // Use a slightly higher minimum length to avoid sending very sparse pages
    if (!snippet || snippet.length < 150) {
      console.log("[AI Tab Mgr] Content too short (<150 chars) or empty, skipping send.");
      return;
    }

    if (!chrome.runtime?.id) {
        // console.log("Runtime disconnected, cannot send snippet.");
        return; // Avoid errors if extension context is lost
    }

    // console.log(`Sending snippet (${snippet.length} chars)...`); // Debug log
    chrome.runtime.sendMessage(
      {
        action: "pageSnippet",
        snippetText: snippet,
        url: window.location.href, // Use current location
        title: document.title // Use current title
      },
      (response) => {
        if (chrome.runtime.lastError) {
          // Don't log common connection errors excessively
          if (!chrome.runtime.lastError.message?.includes("Receiving end does not exist")) {
            console.warn("Error sending content snippet:", chrome.runtime.lastError.message);
          }
        } else if (response?.ok) {
          // console.log("✅ Snippet received by background."); // Confirmation log
          hasSentInitialSnippet = true; // Mark as sent only on success
        } else {
           console.warn("Background script reported issue with snippet:", response?.error);
        }
      }
    );
  }

  // Debounced version of sendSnippet for mutation observer
  function debouncedSendSnippet(delay) {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
          debounceTimeout = null; // Clear timeout ID after execution
          sendSnippet();
      }, delay);
  }


  // --- Initialization and Event Listeners ---
  if (!hasInitialized && window === top) { // Run only in top frame
      hasInitialized = true;
      console.log("📄 AI Tab Manager: Content script active in top frame.");

      // Listener for direct requests from background/popup
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg?.action === "sendPageSnippet") {
          // console.log("Received direct request to send page snippet.");
          sendSnippet(); // Send immediately on request
          sendResponse({ ok: true, message: "Snippet send initiated." }); // Respond quickly
          return false; // Indicate sync response handled (though send is async)
        }
        if (msg?.action === "ping") {
          sendResponse({ ok: true, from: "content-script" });
          return false;
        }
        return false; // No async response for other messages
      });

      // --- Triggering Logic ---
      const trySendSnippet = (delay) => {
          // Only schedule if not already sent and document is reasonably loaded
          if (!hasSentInitialSnippet && (document.readyState === "interactive" || document.readyState === "complete")) {
              // Use debounced send to avoid multiple rapid triggers
              debouncedSendSnippet(delay);
          }
      };

      // Send after initial load events
      if (document.readyState === "complete") {
        trySendSnippet(1500);
      } else {
        window.addEventListener("load", () => trySendSnippet(1500));
      }

      // Send when tab becomes visible (catches switching)
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
           hasSentInitialSnippet = false; // Allow resending when tab becomes visible again
          trySendSnippet(800);
        }
      });

      // Backup send after a longer delay (useful for slow SPAs)
      setTimeout(() => {
          if (!hasSentInitialSnippet && document.readyState === "complete") {
              // console.log("Backup trigger: Sending snippet.");
              sendSnippet(); // Use non-debounced here
          }
      }, 7000); // Longer backup delay

      // --- Mutation Observer for SPAs ---
      // More robust observer targeting body, but debounced
      let mutationObserver = null;
      const setupObserver = () => {
           if (mutationObserver) return; // Already set up

           const targetNode = document.body;
           if (!targetNode) return; // Body should exist

           mutationObserver = new MutationObserver((mutationsList) => {
               // Basic check to see if significant changes happened
               let significantChange = false;
               for(const mutation of mutationsList) {
                   if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        // Check if added nodes are substantial (e.g., not just small attrs)
                        if (Array.from(mutation.addedNodes).some(node => node.nodeType === Node.ELEMENT_NODE)) {
                             significantChange = true;
                             break;
                        }
                   } else if (mutation.type === 'characterData') {
                       significantChange = true; // Text changes are often important
                       break;
                   }
               }

               if (significantChange) {
                   // console.log("SPA Change detected, queueing snippet send.");
                   hasSentInitialSnippet = false; // Allow resending after SPA navigation
                   debouncedSendSnippet(2000); // Debounce SPA updates (2 seconds)
               }
           });

           mutationObserver.observe(targetNode, {
               childList: true,
               subtree: true,
               characterData: true // Observe text changes too
           });
           console.log("🔬 Mutation observer active on document body.");
      };

       // Set up observer after initial load settles
       if (document.readyState === 'complete') {
           setTimeout(setupObserver, 2000);
       } else {
            window.addEventListener('load', () => setTimeout(setupObserver, 2000));
       }

  } else if (window !== top) {
      // console.log("📄 AI Tab Manager: Content script inactive in iframe.");
  }

})();