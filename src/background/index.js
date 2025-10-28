// src/background/index.js - OPTIMIZED VERSION
import Fuse from "fuse.js";
import { systemPrompt, parseAIResponse } from "../utils";

let aiSession = null;
let aiStatus = "initializing";
let isProcessing = false;
let autoGroupingEnabled = true;
let organizeDebounceTimer = null;

let fuse = null;
let indexDocs = [];
let isIndexing = false; // Prevent concurrent index builds
let snippetRequestCache = new Set(); // Track pending snippet requests
let lastIndexBuild = 0; // Timestamp of last index build
const INDEX_BUILD_COOLDOWN = 2000; // Minimum 2s between index builds

const FUSE_OPTIONS = {
  keys: [
    { name: "title", weight: 0.40 },
    { name: "snippet", weight: 0.45 },
    { name: "url", weight: 0.15 },
  ],
  threshold: 0.8,
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 1,
  useExtendedSearch: false,
  distance: 200,
  shouldSort: true,
};

const SNIPPETS_STORAGE_KEY = "_tabSnippets_v1";

// Enhanced caching with TTL
const githubCache = new Map();
const stackCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

// Cleanup old cache entries
function cleanupCache(cache) {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
}

setInterval(() => {
  cleanupCache(githubCache);
  cleanupCache(stackCache);
}, 60000); // Cleanup every minute

async function loadPersistedSnippets() {
  try {
    const data = await chrome.storage.local.get(SNIPPETS_STORAGE_KEY);
    return data[SNIPPETS_STORAGE_KEY] || {};
  } catch (err) {
    console.error("loadPersistedSnippets error:", err);
    return {};
  }
}

async function savePersistedSnippetsMap(map) {
  try {
    await chrome.storage.local.set({ [SNIPPETS_STORAGE_KEY]: map });
  } catch (err) {
    console.error("savePersistedSnippetsMap error:", err);
  }
}

async function savePersistedSnippet(key, value) {
  try {
    const map = await loadPersistedSnippets();
    map[key] = value;
    await savePersistedSnippetsMap(map);
  } catch (err) {
    console.error("savePersistedSnippet error:", err);
  }
}

chrome.storage.local.get("autoGroupingEnabled", (data) => {
  autoGroupingEnabled = data.autoGroupingEnabled ?? true;
  console.log("🧠 Auto-grouping setting:", autoGroupingEnabled);
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.autoGroupingEnabled) {
    autoGroupingEnabled = changes.autoGroupingEnabled.newValue;
    console.log("🔄 Auto-grouping toggled:", autoGroupingEnabled);
  }
});

// OPTIMIZED: Build index with cooldown and deduplication
async function buildFuseIndex() {
  const now = Date.now();
  
  // Prevent concurrent builds
  if (isIndexing) {
    console.log("📚 [BG] Index build already in progress, skipping");
    return false;
  }
  
  // Enforce cooldown
  if (now - lastIndexBuild < INDEX_BUILD_COOLDOWN) {
    console.log("📚 [BG] Index build on cooldown, skipping");
    return false;
  }
  
  isIndexing = true;
  lastIndexBuild = now;
  
  try {
    const windows = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
    const docs = [];
    const persisted = await loadPersistedSnippets();
    let snippetCount = 0;

    for (const w of windows) {
      if (!w.tabs) continue;
      
      for (const t of w.tabs) {
        if (!t.id || !t.url) continue;
        
        const url = t.url;
        if (
          url.startsWith("chrome://") ||
          url.startsWith("chrome-extension://") ||
          url.startsWith("edge://") ||
          url.startsWith("about:")
        ) continue;

        const keyByTab = String(t.id);
        const keyByUrl = url;
        const persistedItem = persisted[keyByTab] || persisted[keyByUrl] || null;
        const snippet = persistedItem?.snippet || "";
        
        if (snippet) snippetCount++;

        docs.push({
          id: t.id,
          title: t.title || "Untitled",
          url: url,
          windowId: t.windowId,
          groupId: t.groupId ?? chrome.tabGroups.TAB_GROUP_ID_NONE,
          snippet: snippet,
          updatedAt: persistedItem?.updatedAt || null,
        });
      }
    }

    indexDocs = docs;
    if (indexDocs.length > 0) {
      fuse = new Fuse(indexDocs, FUSE_OPTIONS);
      console.log(`📚 [BG] Fuse index: ${indexDocs.length} tabs (${snippetCount} with content)`);
    } else {
      fuse = new Fuse([], FUSE_OPTIONS);
      console.log(`📚 [BG] Fuse index: empty`);
    }
    return true;
  } catch (err) {
    console.error("[BG] Error building Fuse index:", err);
    indexDocs = [];
    fuse = new Fuse([], FUSE_OPTIONS);
    return false;
  } finally {
    isIndexing = false;
  }
}

async function ensureIndex() {
  if (!fuse || indexDocs.length === 0) {
    await buildFuseIndex();
  }
}

async function updateSnippetForTab(tabId, snippetText, tabUrl = null, title = null) {
  const s = snippetText ? String(snippetText).slice(0, 4000) : "";
  const now = Date.now();

  const docIndex = indexDocs.findIndex(d => String(d.id) === String(tabId));
  if (docIndex !== -1) {
    indexDocs[docIndex].snippet = s;
    if (title) indexDocs[docIndex].title = title;
    if (tabUrl) indexDocs[docIndex].url = tabUrl;
    indexDocs[docIndex].updatedAt = now;
  } else {
    indexDocs.push({
      id: Number(tabId),
      title: title || "Untitled",
      url: tabUrl || "",
      windowId: null,
      groupId: chrome.tabGroups.TAB_GROUP_ID_NONE,
      snippet: s,
      updatedAt: now,
    });
  }

  try {
    const persistData = {
      snippet: s,
      title: title || "",
      url: tabUrl || "",
      updatedAt: now
    };

    if (tabId) await savePersistedSnippet(String(tabId), persistData);
    if (tabUrl) await savePersistedSnippet(tabUrl, persistData);
  } catch (e) {
    console.error("[BG] Persist snippet error", e);
  }

  fuse = new Fuse(indexDocs, FUSE_OPTIONS);
  console.log(`✅ [BG] Updated snippet for tab ${tabId} (${s.length} chars)`);
}

async function fetchFirstGoogleResult(query) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  
  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!response.ok) {
      throw new Error(`Google fetch failed: ${response.status}`);
    }

    const html = await response.text();
    
    const patterns = [
      /<a\s+[^>]*?href="\/url\?q=(https?:\/\/[^&"]+)[^"]*"[^>]*>/gi,
      /<div class="[^"]*yuRUbf[^"]*">.*?<a href="(https?:\/\/[^"]+)"[^>]*>/gi,
      /<a[^>]+href="(https?:\/\/(?!google\.com|accounts\.google)[^"]+)"[^>]*data-ved=/gi
    ];

    const unwantedDomains = [
      'google.com/search',
      'accounts.google.com',
      'google.com/maps',
      'support.google.com',
      'policies.google.com',
      'google.com/intl',
      'translate.google.com',
      'webcache.googleusercontent.com'
    ];

    let foundUrl = null;
    let foundTitle = query;

    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      const matches = [...html.matchAll(pattern)];
      
      for (const match of matches) {
        const url = match[1];
        if (!url) continue;

        try {
          const parsedUrl = new URL(url);
          const isUnwanted = unwantedDomains.some(d => parsedUrl.hostname.includes(d));
          
          if (!isUnwanted) {
            foundUrl = url;
            
            const urlPosition = html.indexOf(match[0]);
            const contextStart = Math.max(0, urlPosition - 300);
            const contextEnd = Math.min(html.length, urlPosition + 300);
            const context = html.substring(contextStart, contextEnd);
            
            const titleMatch = context.match(/<h3[^>]*>([^<]+)<\/h3>/);
            if (titleMatch) {
              foundTitle = titleMatch[1]
                .replace(/&/g, '&')
                .replace(/"/g, '"')
                .replace(/'/g, "'")
                .replace(/<[^>]+>/g, '')
                .trim();
            }
            
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (foundUrl) break;
    }

    if (foundUrl) {
      console.log(`✅ [BG] Google scrape: "${foundTitle}" -> ${foundUrl.substring(0, 60)}...`);
      return {
        success: true,
        url: foundUrl,
        title: foundTitle,
        source: "google",
        isFirstResult: true,
        method: 'google-scrape'
      };
    }

    throw new Error('No valid Google result found');

  } catch (err) {
    console.warn("[BG] Google scrape failed:", err.message);
    return {
      success: true,
      url: searchUrl,
      title: `Search: ${query}`,
      source: "google",
      isFirstResult: false,
      method: 'google-fallback'
    };
  }
}

async function fetchFirstGitHubResult(query) {
  const cacheKey = query.toLowerCase().trim();
  const cached = githubCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log("✅ [BG] GitHub cache hit");
    return cached.data;
  }

  try {
    const lowerQuery = query.toLowerCase();
    console.log(`🔍 [BG] GitHub search: "${query}"`);

    const directMatch = query.match(/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/);
    if (directMatch) {
      const repoUrl = `https://github.com/${directMatch[0]}`;
      console.log(`✅ [BG] Direct GitHub repo: ${repoUrl}`);
      const result = {
        success: true,
        url: repoUrl,
        title: `GitHub: ${directMatch[0]}`,
        source: "github",
        isFirstResult: true,
        method: 'direct-match'
      };
      githubCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }

    const knownRepos = {
      'nodejs': 'nodejs/node',
      'node': 'nodejs/node',
      'node.js': 'nodejs/node',
      'npm': 'npm/cli',
      'react': 'facebook/react',
      'reactjs': 'facebook/react',
      'vue': 'vuejs/vue',
      'vuejs': 'vuejs/vue',
      'vue.js': 'vuejs/vue',
      'angular': 'angular/angular',
      'svelte': 'sveltejs/svelte',
      'webpack': 'webpack/webpack',
      'vite': 'vitejs/vite',
      'rollup': 'rollup/rollup',
      'parcel': 'parcel-bundler/parcel',
      'esbuild': 'evanw/esbuild',
      'next': 'vercel/next.js',
      'nextjs': 'vercel/next.js',
      'next.js': 'vercel/next.js',
      'nuxt': 'nuxt/nuxt',
      'nuxtjs': 'nuxt/nuxt',
      'gatsby': 'gatsbyjs/gatsby',
      'remix': 'remix-run/remix',
      'express': 'expressjs/express',
      'expressjs': 'expressjs/express',
      'nest': 'nestjs/nest',
      'nestjs': 'nestjs/nest',
      'fastify': 'fastify/fastify',
      'koa': 'koajs/koa',
      'typescript': 'microsoft/TypeScript',
      'ts': 'microsoft/TypeScript',
      'jest': 'jestjs/jest',
      'vitest': 'vitest-dev/vitest',
      'cypress': 'cypress-io/cypress',
      'playwright': 'microsoft/playwright',
      'redux': 'reduxjs/redux',
      'mobx': 'mobxjs/mobx',
      'zustand': 'pmndrs/zustand',
      'recoil': 'facebookexperimental/Recoil',
      'lodash': 'lodash/lodash',
      'axios': 'axios/axios',
      'moment': 'moment/moment',
      'dayjs': 'iamkun/dayjs',
      'date-fns': 'date-fns/date-fns',
      'jquery': 'jquery/jquery',
      'bootstrap': 'twbs/bootstrap',
      'tailwind': 'tailwindlabs/tailwindcss',
      'tailwindcss': 'tailwindlabs/tailwindcss',
      'material-ui': 'mui/material-ui',
      'mui': 'mui/material-ui',
      'chakra': 'chakra-ui/chakra-ui',
      'antd': 'ant-design/ant-design',
      'prisma': 'prisma/prisma',
      'typeorm': 'typeorm/typeorm',
      'sequelize': 'sequelize/sequelize',
      'mongoose': 'Automattic/mongoose',
      'redis': 'redis/redis',
      'mongodb': 'mongodb/mongo',
      'postgres': 'postgres/postgres',
      'postgresql': 'postgres/postgres',
      'mysql': 'mysql/mysql-server',
      'graphql': 'graphql/graphql-js',
      'apollo': 'apollographql/apollo-client',
      'relay': 'facebook/relay',
      'python': 'python/cpython',
      'django': 'django/django',
      'flask': 'pallets/flask',
      'fastapi': 'tiangolo/fastapi',
      'pytorch': 'pytorch/pytorch',
      'tensorflow': 'tensorflow/tensorflow',
      'numpy': 'numpy/numpy',
      'pandas': 'pandas-dev/pandas',
      'go': 'golang/go',
      'golang': 'golang/go',
      'rust': 'rust-lang/rust',
      'spring': 'spring-projects/spring-framework',
      'hibernate': 'hibernate/hibernate-orm',
      'rails': 'rails/rails',
      'ruby': 'ruby/ruby',
      'laravel': 'laravel/laravel',
      'symfony': 'symfony/symfony',
      'docker': 'docker/docker-ce',
      'kubernetes': 'kubernetes/kubernetes',
      'k8s': 'kubernetes/kubernetes',
      'terraform': 'hashicorp/terraform',
      'ansible': 'ansible/ansible',
      'vscode': 'microsoft/vscode',
      'code': 'microsoft/vscode',
      'vim': 'vim/vim',
      'neovim': 'neovim/neovim',
      'electron': 'electron/electron',
      'tauri': 'tauri-apps/tauri',
      'react-native': 'facebook/react-native',
      'flutter': 'flutter/flutter',
      'deno': 'denoland/deno',
      'bun': 'oven-sh/bun',
      'firebase': 'firebase/firebase-js-sdk',
      'supabase': 'supabase/supabase',
      'strapi': 'strapi/strapi',
      'babel': 'babel/babel',
    };

    const sortedKeys = Object.keys(knownRepos).sort((a, b) => b.length - a.length);

    for (const key of sortedKeys) {
      const regex = new RegExp(`\\b${key}\\b`, 'i');
      if (regex.test(query)) {
        const repoSlug = knownRepos[key];
        const repoUrl = `https://github.com/${repoSlug}`;
        console.log(`✅ [BG] Known GitHub repo: ${repoUrl}`);
        const result = {
          success: true,
          url: repoUrl,
          title: `GitHub: ${repoSlug}`,
          source: "github",
          isFirstResult: true,
          method: 'known-repo'
        };
        githubCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
      }
    }

    const cleanQuery = query
      .replace(/github|repo|repository|how to|tutorial|example|docs|documentation/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanQuery) {
      throw new Error('Query empty after cleaning');
    }

    console.log(`[BG] GitHub API search: "${cleanQuery}"`);

    const searchStrategies = [
      `${cleanQuery} in:name`,
      `${cleanQuery} stars:>1000`,
      cleanQuery
    ];

    for (const searchQuery of searchStrategies) {
      const apiUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=stars&order=desc&per_page=10`;

      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Chrome-Extension'
        }
      });

      if (!response.ok) {
        console.warn(`[BG] GitHub API failed for: ${searchQuery}`);
        continue;
      }

      const data = await response.json();

      if (data.items && data.items.length > 0) {
        let bestMatch = null;
        const lowerCleanQuery = cleanQuery.toLowerCase();

        bestMatch = data.items.find(repo =>
          repo.full_name.toLowerCase() === lowerCleanQuery
        );

        if (!bestMatch) {
          bestMatch = data.items.find(repo =>
            repo.name.toLowerCase() === lowerCleanQuery ||
            repo.name.toLowerCase().replace(/[._-]/g, '') === lowerCleanQuery.replace(/[._-]/g, '')
          );
        }

        if (!bestMatch) {
          bestMatch = data.items.find(repo =>
            repo.name.toLowerCase().startsWith(lowerCleanQuery)
          );
        }
        
        if (!bestMatch) {
          bestMatch = data.items.find(repo => {
            const owner = repo.full_name.split('/')[0].toLowerCase();
            return owner === lowerCleanQuery;
          });
        }

        if (!bestMatch) {
          bestMatch = data.items.find(repo =>
            repo.name.toLowerCase().includes(lowerCleanQuery)
          );
        }

        if (!bestMatch) {
          bestMatch = data.items[0];
        }

        if (bestMatch) {
          console.log(`✅ [BG] GitHub API match: ${bestMatch.full_name} (${bestMatch.stargazers_count} ⭐)`);
          const result = {
            success: true,
            url: bestMatch.html_url,
            title: `${bestMatch.full_name} - ${bestMatch.description || 'GitHub Repository'}`,
            source: "github",
            isFirstResult: true,
            stars: bestMatch.stargazers_count,
            method: 'api-search'
          };
          githubCache.set(cacheKey, { data: result, timestamp: Date.now() });
          return result;
        }
      }
    }

    throw new Error('No GitHub results found');
  } catch (err) {
    console.error("[BG] GitHub search error:", err);
    return {
      success: false,
      error: err.message
    };
  }
}

async function fetchFirstStackOverflowResult(query) {
  const cacheKey = query.toLowerCase().trim();
  const cached = stackCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log("✅ [BG] Stack Overflow cache hit");
    return cached.data;
  }

  try {
    const cleanQuery = query.replace(/stackoverflow|stack overflow/gi, '').trim();
    if (!cleanQuery) {
      return {
        success: true,
        url: 'https://stackoverflow.com',
        title: 'Stack Overflow',
        source: 'stackoverflow',
        isFirstResult: false
      };
    }

    const apiUrl = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(cleanQuery)}&site=stackoverflow&pagesize=1`;
    const response = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`SO API: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      const question = data.items[0];
      const result = {
        success: true,
        url: question.link,
        title: question.title,
        source: 'stackoverflow',
        isFirstResult: true,
        score: question.score,
        answered: question.is_answered
      };
      
      stackCache.set(cacheKey, { data: result, timestamp: Date.now() });
      console.log(`✅ [BG] Stack Overflow: "${question.title.substring(0, 60)}..." (Score: ${question.score})`);
      return result;
    }

    throw new Error('No SO results');

  } catch (err) {
    console.warn("[BG] Stack Overflow search failed:", err.message);
    return {
      success: true,
      url: `https://stackoverflow.com/search?q=${encodeURIComponent(query)}`,
      title: `Stack Overflow search: ${query}`,
      source: 'stackoverflow',
      isFirstResult: false
    };
  }
}

function getSpecificSiteUrl(query) {
  const lower = query.toLowerCase().trim();
  
  const exactMappings = {
    'instagram reels': 'https://www.instagram.com/reels/',
    'instagram reel': 'https://www.instagram.com/reels/',
    'watch reels': 'https://www.instagram.com/reels/',
    'watch reel': 'https://www.instagram.com/reels/',
    'youtube shorts': 'https://www.youtube.com/shorts',
    'watch shorts': 'https://www.youtube.com/shorts',
    'listen to music': 'https://open.spotify.com',
    'listen music': 'https://open.spotify.com',
    'play music': 'https://open.spotify.com',
    'music': 'https://open.spotify.com',
    'spotify': 'https://open.spotify.com',
    'youtube': 'https://www.youtube.com',
    'gmail': 'https://mail.google.com',
    'google': 'https://www.google.com',
    'github': 'https://github.com',
    'stackoverflow': 'https://stackoverflow.com',
    'reddit': 'https://www.reddit.com',
    'twitter': 'https://twitter.com',
    'facebook': 'https://www.facebook.com',
    'instagram': 'https://www.instagram.com',
    'linkedin': 'https://www.linkedin.com',
    'amazon': 'https://www.amazon.com',
    'netflix': 'https://www.netflix.com',
    'wikipedia': 'https://www.wikipedia.org',
    'news': 'https://news.google.com',
  };

  const sortedKeys = Object.keys(exactMappings).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lower === key || lower.includes(key)) {
      return {
        url: exactMappings[key],
        title: key.charAt(0).toUpperCase() + key.slice(1),
        matched: true
      };
    }
  }

  return { matched: false };
}

function detectPlatform(query) {
  const lower = query.toLowerCase();
  
  if (lower.includes('github') || lower.includes('repo') || lower.match(/\bgit\b/)) {
    return 'github';
  }
  if (lower.includes('stackoverflow') || lower.includes('stack overflow') || 
      lower.match(/\berror\b/) || lower.match(/\bexception\b/) || lower.includes('how to fix')) {
    return 'stackoverflow';
  }
  
  const platforms = {
    youtube: ['youtube', 'video', 'tutorial',],
    reddit: ['reddit', 'discussion', 'subreddit'],
    amazon: ['amazon', 'buy', 'purchase', 'shop', 'product'],
    wikipedia: ['wikipedia', 'wiki', 'what is', 'who is'],
    twitter: ['twitter', 'tweet', 'x.com'],
    linkedin: ['linkedin', 'professional']
  };
  
  for (const [platform, keywords] of Object.entries(platforms)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return platform;
    }
  }
  
  return null;
}

async function performWebSearch(query) {
  try {
    console.log(`🔍 [BG] Web search: "${query}"`);
    
    const platform = detectPlatform(query);
    console.log(`🎯 [BG] Platform: ${platform || 'general'}`);

    if (platform === 'github') {
      return await fetchFirstGitHubResult(query);
    }
    
    if (platform === 'stackoverflow') {
      return await fetchFirstStackOverflowResult(query);
    }

    const specificSite = getSpecificSiteUrl(query);
    if (specificSite.matched) {
      console.log(`✅ [BG] Specific site mapping: ${specificSite.url}`);
      return {
        success: true,
        url: specificSite.url,
        title: specificSite.title,
        source: 'specific-mapping',
        isFirstResult: true,
        method: 'exact-url'
      };
    }
    
    if (platform) {
      const searchUrls = {
        youtube: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
        reddit: `https://www.reddit.com/search/?q=${encodeURIComponent(query)}`,
        amazon: `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
        wikipedia: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`,
        twitter: `https://twitter.com/search?q=${encodeURIComponent(query)}`,
        linkedin: `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(query)}`
      };

      if (searchUrls[platform]) {
        console.log(`✅ [BG] ${platform} search page`);
        return {
          success: true,
          url: searchUrls[platform],
          title: `${platform.charAt(0).toUpperCase() + platform.slice(1)}: ${query}`,
          source: platform,
          isFirstResult: false,
          method: 'platform-search'
        };
      }
    }

    console.log(`[BG] Using Google search`);
    return await fetchFirstGoogleResult(query);

  } catch (err) {
    console.error("[BG] Web search error:", err);
    return {
      success: true,
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      title: `Search: ${query}`,
      source: "google",
      isFirstResult: false,
      method: 'error-fallback'
    };
  }
}

async function resolveQueryToURL(query, aiSession) {
  console.log(`🔍 [BG] Resolving: "${query}"`);

  if (/^https?:\/\//i.test(query)) {
    return { success: true, url: query, title: query, method: 'direct-url' };
  }

  const platform = detectPlatform(query);
  if (platform === 'github' || platform === 'stackoverflow') {
    console.log(`🎯 [BG] Specialist: ${platform}`);
    return await performWebSearch(query);
  }

  const specificSite = getSpecificSiteUrl(query);
  if (specificSite.matched) {
    console.log(`✅ [BG] Specific site: ${specificSite.url}`);
    return {
      success: true,
      url: specificSite.url,
      title: specificSite.title,
      source: 'specific-mapping',
      isFirstResult: true,
      method: 'exact-url'
    };
  }

  const lowerQuery = query.toLowerCase().trim();
  
  if (query.includes('.') && !query.includes(' ')) {
    const url = query.startsWith('http') ? query : `https://${query}`;
    console.log(`✅ [BG] Domain: ${url}`);
    return { success: true, url, title: query, method: 'domain' };
  }

  console.log(`[BG] Web search fallback`);
  return await performWebSearch(query);
}

// CORE GROUPING LOGIC - Shared by both auto and manual
async function performGrouping(userRequest = "") {
  try {
    const ungroupedTabs = await getUngroupedTabs();

    if (ungroupedTabs.length === 0) {
      return { success: true, message: "No ungrouped tabs found", groupsCreated: 0, tabsAddedToExisting: 0 };
    }

    console.log(`[BG] Grouping ${ungroupedTabs.length} ungrouped tabs...`);

    const existingGroups = await getExistingGroups();

    let aiResult = await askAIToGroupTabs(ungroupedTabs, existingGroups, userRequest);
    if (!aiResult.valid) {
      console.warn("[BG] AI grouping failed, using fallback:", aiResult.error);
      aiResult = createFallbackGroups(ungroupedTabs, existingGroups);
    }

    if (aiResult.valid) {
      console.log("[BG] Grouping strategy:", aiResult.explanation);
      const result = await createMultipleGroups(aiResult.groups, existingGroups);
      
      if (result.success) {
        const message = [];
        if (result.groupsCreated > 0) {
          message.push(`Created ${result.groupsCreated} new group(s)`);
        }
        if (result.tabsAddedToExisting > 0) {
          message.push(`Added ${result.tabsAddedToExisting} tab(s) to existing groups`);
        }
        console.log(`✅ [BG] ${message.join(", ")}`);
        return { 
          success: true, 
          message: message.join(", "),
          groupsCreated: result.groupsCreated,
          tabsAddedToExisting: result.tabsAddedToExisting
        };
      } else {
        console.warn("[BG] createMultipleGroups reported no success:", result.error);
        return { success: false, error: result.error };
      }
    }
    
    return { success: false, error: "Grouping failed" };
  } catch (err) {
    console.error("[BG] Grouping error:", err);
    return { success: false, error: err.message };
  }
}

// AUTO-GROUPING: Debounced, only for new/updated tabs
function debouncedAutoGrouping(delay = 15000) {
  if (!autoGroupingEnabled) {
    console.log("[BG] Auto-grouping trigger skipped (disabled).");
    return;
  }
  
  clearTimeout(organizeDebounceTimer);
  console.log(`[BG] Auto-grouping scheduled in ${delay / 1000}s...`);
  
  organizeDebounceTimer = setTimeout(async () => {
    if (isProcessing) {
      console.log("[BG] Auto-grouping skipped (already processing).");
      return;
    }
    
    isProcessing = true;
    console.log("⏰ [BG] Running auto-grouping...");
    
    try {
      await performGrouping("Auto-organize new tabs");
    } catch (err) {
      console.error("[BG] Auto-grouping error:", err);
    } finally {
      isProcessing = false;
    }
  }, delay);
}

// MANUAL ORGANIZATION: Immediate, user-triggered
async function organizeNow() {
  if (isProcessing) {
    return { success: false, error: "Already processing" };
  }

  isProcessing = true;
  console.log("🔥 [BG] Manual organization started...");
  
  try {
    const result = await performGrouping("User requested organization");
    return result;
  } catch (err) {
    console.error("[BG] Manual organization error:", err);
    return { success: false, error: err.message };
  } finally {
    isProcessing = false;
  }
}

async function initializeAI() {
  if (!autoGroupingEnabled) {
    console.log("🚫 AI init skipped (disabled)");
    return;
  }

  try {
    console.log("Initializing AI...");
    if (typeof LanguageModel !== "undefined") {
      const availability = await LanguageModel.availability();
      if (availability === "available") {
        aiSession = await LanguageModel.create({
          systemPrompt: systemPrompt,
        });
        aiStatus = "ready";
        console.log("✅ AI ready");

        await buildFuseIndex();
        // Run initial organization after 3 seconds
        setTimeout(() => organizeNow(), 3000);
      } else {
        aiStatus = "unavailable";
        console.log("❌ AI unavailable");
      }
    } else {
      aiStatus = "unavailable";
      console.log("❌ LanguageModel API not found");
    }
  } catch (err) {
    aiStatus = "error";
    console.error("AI init error:", err);
  }
}

async function getUngroupedTabs() {
  const windows = await chrome.windows.getAll({
    populate: true,
    windowTypes: ["normal"],
  });
  let ungrouped = [];

  for (const window of windows) {
    const windowTabs = window.tabs.filter((tab) => {
      const url = tab.url || "";
      const isValidUrl =
        !url.startsWith("chrome://") &&
        !url.startsWith("chrome-extension://") &&
        !url.startsWith("edge://") &&
        !url.startsWith("about:");
      const isUngrouped = tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE;
      return isValidUrl && isUngrouped;
    });

    ungrouped = ungrouped.concat(
      windowTabs.map((tab) => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        windowId: tab.windowId,
      }))
    );
  }

  return ungrouped;
}

async function getExistingGroups() {
  const groups = await chrome.tabGroups.query({});
  const groupsWithTabs = await Promise.all(
    groups.map(async (g) => {
      const tabs = await chrome.tabs.query({ groupId: g.id });
      return {
        id: g.id,
        title: g.title || "Untitled",
        color: g.color,
        tabIds: tabs.map(t => t.id),
        tabs: tabs.map(t => ({
          id: t.id,
          title: t.title,
          url: t.url
        }))
      };
    })
  );
  return groupsWithTabs;
}

const askAIToGroupTabs = async (tabs = [], existingGroups = [], userRequest = "") => {
  try {
    if (!aiSession) {
      return { valid: false, error: "AI session not available" };
    }
    if (typeof aiStatus !== "undefined" && aiStatus !== "ready") {
      return { valid: false, error: `AI not ready (status: ${aiStatus})` };
    }

    const tabsList = tabs
      .map(
        (tab) => `Tab ${tab.id}: "${tab.title.replace(/\n/g, " ")}" - ${new URL(tab.url).hostname}`
      )
      .join("\n");
    const allIds = tabs.map((t) => t.id);

    let existingGroupsInfo = "";
    const existingGroupNames = [];
    if (Array.isArray(existingGroups) && existingGroups.length > 0) {
      existingGroupsInfo =
        "EXISTING GROUPS:\n" +
        existingGroups
          .map((g) => {
            existingGroupNames.push(g.title);
            const tabInfo = (g.tabs || [])
              .map((t) => {
                const hostname = t.url ? new URL(t.url).hostname : "unknown";
                return `  - ${t.title.replace(/\n/g, " ")} (${hostname}) [id:${t.id}]`;
              })
              .join("\n");
            return `"${g.title}" (${(g.tabs || []).length} tabs):\n${tabInfo}`;
          })
          .join("\n\n");
    }

    const prompt = [
      `You are a Chrome Tab Manager AI. Analyze and organize the following NEW ungrouped tabs.`,
      ``,
      `CONSTRAINTS (must follow):`,
      `- Respond ONLY with valid JSON parsable to { "groups": { "<Name>": [ids] }, "explanation": "text" }.`,
      `- Use ONLY these exact tab IDs: ${allIds.join(", ")}`,
      `- Each tab ID must appear in EXACTLY ONE group (no duplicates, no omissions).`,
      `- If a new tab matches an EXISTING GROUP name, add it to that existing group (use the exact existing group name).`,
      `- Create new groups only when no existing group matches semantically.`,
      ``,
      `USER CONTEXT:`,
      `- User wants: "${userRequest.replace(/"/g, "'")}"`,
      ``,
      `${existingGroupsInfo}`,
      ``,
      `NEW TABS TO ORGANIZE:\n${tabsList}`,
      ``,
      `RESPONSE FORMAT (example):`,
      `{"groups": {"Social Media": [12,13], "React Tutorials": [21,22]}, "explanation": "Added X to Social Media; created React Tutorials for several YouTube React videos."}`
    ].join("\n");

    const aiRawResponse = await aiSession.prompt(prompt);

    let parsed;
    try {
      parsed = await parseAIResponse(aiRawResponse, tabs, existingGroups);
    } catch (parseErr) {
      try {
        parsed = JSON.parse(aiRawResponse);
      } catch (jsonErr) {
        return { valid: false, error: "Failed to parse AI response", detail: parseErr.message || parseErr, aiRawResponse };
      }
    }

    if (!parsed || typeof parsed !== "object" || !parsed.groups || typeof parsed.groups !== "object") {
      return { valid: false, error: "AI response missing required 'groups' object", raw: parsed || aiRawResponse };
    }

    const normalizeGroups = (groupsObj) => {
      const out = {};
      for (const [name, arr] of Object.entries(groupsObj)) {
        out[String(name)] = Array.isArray(arr) ? arr.map((x) => Number(x)) : [];
      }
      return out;
    };

    let groups = normalizeGroups(parsed.groups);

    const idToGroups = new Map();
    for (const [gName, ids] of Object.entries(groups)) {
      for (const id of ids) {
        if (!idToGroups.has(id)) idToGroups.set(id, []);
        idToGroups.get(id).push(gName);
      }
    }

    const duplicates = [];
    for (const [id, gList] of idToGroups.entries()) {
      if (gList.length > 1) duplicates.push({ id, groups: gList });
    }
    const seenIds = Array.from(idToGroups.keys()).filter((n) => !Number.isNaN(n));
    const missing = allIds.filter((id) => !seenIds.includes(id));

    const fixes = { duplicates: [], missing: [] };

    if (duplicates.length > 0) {
      for (const d of duplicates) {
        const keepGroup = Object.keys(groups).find((k) => groups[k].includes(d.id));
        for (const g of d.groups) {
          if (g !== keepGroup) {
            groups[g] = groups[g].filter((x) => x !== d.id);
          }
        }
        fixes.duplicates.push({ id: d.id, keptIn: keepGroup, removedFrom: d.groups.filter((g) => g !== keepGroup) });
      }
    }

    if (missing.length > 0) {
      fixes.missing = missing.slice();
      const preferNames = ["Misc", "Reading", "Research"];
      let placed = false;
      for (const name of preferNames) {
        if (groups[name]) {
          groups[name] = groups[name].concat(missing);
          placed = true;
          break;
        }
      }
      if (!placed) {
        const miscNameBase = "Misc";
        let miscName = miscNameBase;
        let counter = 1;
        while (groups[miscName]) {
          miscName = `${miscNameBase} ${counter++}`;
        }
        groups[miscName] = missing.slice();
      }
    }
    
    const finalIdCounts = {};
    for (const ids of Object.values(groups)) {
      for (const id of ids) {
        finalIdCounts[id] = (finalIdCounts[id] || 0) + 1;
      }
    }
    const stillDuplicates = Object.entries(finalIdCounts).filter(([id, cnt]) => cnt > 1).map(([id, cnt]) => Number(id));
    const stillMissing = allIds.filter((id) => !finalIdCounts[id]);

    if (stillDuplicates.length > 0 || stillMissing.length > 0) {
      const finalGroups = {};
      for (const [name] of Object.entries(groups)) finalGroups[name] = [];
      const miscName = Object.keys(finalGroups).find((n) => n === "Misc") || "Misc";
      if (!finalGroups[miscName]) finalGroups[miscName] = [];

      const seen = new Set();
      for (const id of allIds) {
        const owningGroup = Object.keys(groups).find((g) => (groups[g] || []).includes(id));
        if (owningGroup && !seen.has(id)) {
          finalGroups[owningGroup].push(id);
          seen.add(id);
        } else if (!seen.has(id)) {
          finalGroups[miscName].push(id);
          seen.add(id);
        }
      }
      groups = finalGroups;
      fixes.actions = "Forced deterministic re-assignment to ensure exactly-one-per-id";
    }

    const existingGroupMap = {};
    for (const g of existingGroups || []) {
      existingGroupMap[g.title] = Array.isArray(g.tabs) ? g.tabs.map((t) => t.id) : [];
    }

    const existingGroupAdds = {};
    const newGroups = {};
    for (const [gName, ids] of Object.entries(groups)) {
      if (existingGroupMap.hasOwnProperty(gName)) {
        const adds = ids.filter((id) => !existingGroupMap[gName].includes(id));
        if (adds.length > 0) existingGroupAdds[gName] = adds;
      } else {
        newGroups[gName] = ids;
      }
    }

    return {
      valid: true,
      raw: parsed,
      groups,
      existingGroupAdds,
      newGroups,
      fixes,
      explanation: parsed.explanation || "",
    };
  } catch (err) {
    console.error("askAIToGroupTabs error:", err);
    return { valid: false, error: err.message || String(err) };
  }
};

function createFallbackGroups(tabs, existingGroups = []) {
  const groups = {};
  const existingGroupMap = new Map();

  existingGroups.forEach(g => {
    const title = g.title.toLowerCase();
    existingGroupMap.set(title, g.title);
  });

  tabs.forEach((tab) => {
    try {
      const hostname = new URL(tab.url).hostname;
      const domain = hostname.replace(/^www\./, "");

      let category = "Other";
      let matchedExistingGroup = null;

      if (domain.includes("google") || domain.includes("stackoverflow") || domain.includes("github")) {
        matchedExistingGroup = findExistingGroup(existingGroupMap, ["development", "dev", "code", "programming"]);
        category = matchedExistingGroup || "Development";
      } else if (domain.includes("youtube") || domain.includes("twitter") || domain.includes("facebook")) {
        matchedExistingGroup = findExistingGroup(existingGroupMap, ["social", "media", "social media"]);
        category = matchedExistingGroup || "Social & Media";
      } else if (domain.includes("amazon") || domain.includes("ebay") || domain.includes("shop")) {
        matchedExistingGroup = findExistingGroup(existingGroupMap, ["shopping", "shop", "store"]);
        category = matchedExistingGroup || "Shopping";
      } else if (domain.includes("news") || domain.includes("bbc")) {
        matchedExistingGroup = findExistingGroup(existingGroupMap, ["news", "articles"]);
        category = matchedExistingGroup || "News";
      } else if (domain.includes("gmail") || domain.includes("mail")) {
        matchedExistingGroup = findExistingGroup(existingGroupMap, ["email", "mail"]);
        category = matchedExistingGroup || "Email";
      }

      if (!groups[category]) groups[category] = [];
      groups[category].push(tab.id);
    } catch {
      if (!groups["Other"]) groups["Other"] = [];
      groups["Other"].push(tab.id);
    }
  });

  return {
    valid: true,
    groups,
    explanation: "Organized by domain categories (fallback mode), merged with existing groups where possible",
  };
}

function findExistingGroup(existingGroupMap, keywords) {
  for (const [key, originalTitle] of existingGroupMap.entries()) {
    if (keywords.some(keyword => key.includes(keyword))) {
      return originalTitle;
    }
  }
  return null;
}

async function createMultipleGroups(groupedTabs, existingGroups = []) {
  try {
    let groupsCreated = 0;
    let tabsAddedCount = 0;
    const colors = [
      "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange",
    ];
    
    const freshExistingGroups = await chrome.tabGroups.query({});
    const existingGroupMap = new Map();
    freshExistingGroups.forEach(g => {
      existingGroupMap.set(g.title.toLowerCase(), g);
    });

    for (const [groupName, tabIds] of Object.entries(groupedTabs)) {
      if (!Array.isArray(tabIds)) continue;
      if (tabIds.length === 0) continue;

      const validTabIds = [];
      for (const tabId of tabIds) {
        try {
          const tab = await chrome.tabs.get(tabId);
          const window = await chrome.windows.get(tab.windowId);

          if (
            tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE &&
            window.type === "normal"
          ) {
            validTabIds.push(tabId);
          }
        } catch {
          console.log(`Tab ${tabId} no longer exists`);
        }
      }

      if (validTabIds.length > 0) {
        const existingGroup = existingGroupMap.get(groupName.toLowerCase());

        if (existingGroup) {
          await chrome.tabs.group({
            groupId: existingGroup.id,
            tabIds: validTabIds
          });
          tabsAddedCount += validTabIds.length;
          console.log(`✅ Added ${validTabIds.length} tab(s) to existing group: ${groupName}`);
        } else {
          const groupId = await chrome.tabs.group({ tabIds: validTabIds });
          await chrome.tabGroups.update(groupId, {
            title: groupName,
            color: colors[groupsCreated % colors.length],
          });
          groupsCreated++;
          console.log(`✅ Created new group: ${groupName} (${validTabIds.length} tabs)`);
          existingGroupMap.set(groupName.toLowerCase(), { id: groupId, title: groupName });
        }
      }
    }

    const success = (groupsCreated > 0 || tabsAddedCount > 0);
    return {
      success: success,
      groupsCreated,
      tabsAddedToExisting: tabsAddedCount,
      error: success ? null : "No tabs were grouped. (They might be already grouped)"
    };
  } catch (err) {
    console.error("Error in createMultipleGroups:", err);
    return { success: false, error: err.message };
  }
}

// OPTIMIZED: Request snippet only once per tab
async function requestSnippetFromTab(tabId) {
  if (snippetRequestCache.has(tabId)) {
    return; // Already requested for this tab
  }
  
  snippetRequestCache.add(tabId);
  
  try {
    await chrome.tabs.sendMessage(tabId, { action: "sendPageSnippet" });
  } catch (err) {
    // Content script not ready or tab restricted
  }
  
  // Remove from cache after 30 seconds
  setTimeout(() => {
    snippetRequestCache.delete(tabId);
  }, 30000);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (!request || !request.action) {
      sendResponse({ error: "no action" });
      return false;
    }

    const action = request.action;

    if (action === "getAIStatus") {
      sendResponse({ status: aiStatus });
      return false;
    }

    if (action === "organizeNow") {
      organizeNow()
        .then((result) => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (action === "fuseSearch") {
      (async () => {
        const q = (request.query || "").trim();
        const limit = Math.min(request.limit || 10, 50);

        if (!q) {
          sendResponse({ results: [] });
          return;
        }

        await ensureIndex();

        try {
          const raw = fuse.search(q, { limit: limit * 3 });
          
          const validResults = [];
          for (const r of raw) {
            if (r.score > FUSE_OPTIONS.threshold) {
              continue;
            }
            
            try {
              const tab = await chrome.tabs.get(r.item.id);
              if (tab && tab.url) {
                validResults.push({
                  id: r.item.id,
                  title: r.item.title,
                  url: r.item.url,
                  snippet: r.item.snippet,
                  score: r.score,
                  windowId: tab.windowId,
                  groupId: tab.groupId
                });
              }
            } catch (err) {
              // Tab no longer exists
            }
          }

          const results = validResults.slice(0, limit);

          if (results.length === 0) {
            console.log("🔍 No Fuse results, fallback search");
            const ql = q.toLowerCase();
            const allTabs = await chrome.tabs.query({});

            const fallback = allTabs
              .filter(tab => {
                const url = tab.url || "";
                if (url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
                  return false;
                }
                const title = (tab.title || "").toLowerCase();
                return title.includes(ql) || url.toLowerCase().includes(ql);
              })
              .slice(0, limit)
              .map(tab => ({
                id: tab.id,
                title: tab.title,
                url: tab.url,
                snippet: "",
                score: null,
                windowId: tab.windowId,
                groupId: tab.groupId
              }));

            sendResponse({ results: fallback, totalMatches: fallback.length });
            return;
          }

          console.log(`🔎 [BG] Search "${q}": ${results.length} results`);
          sendResponse({ results, totalMatches: raw.length });
        } catch (err) {
          console.error("[BG] Fuse search error:", err);
          sendResponse({ results: [], error: err.message });
        }
      })();
      return true;
    }

    if (action === "webSearch") {
      (async () => {
        try {
          const query = (request.query || "").trim();
          if (!query) {
            sendResponse({ success: false, error: "Empty query" });
            return;
          }
          
          const result = await resolveQueryToURL(query, aiSession);
          sendResponse(result);
        } catch (err) {
          console.error("[BG] Web search error:", err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    if (action === "rebuildIndex") {
      (async () => {
        const ok = await buildFuseIndex();
        sendResponse({ success: ok });
      })();
      return true;
    }

    if (action === "pageSnippet") {
      (async () => {
        try {
          const tabId = sender?.tab?.id || request.tabId;
          const tabUrl = sender?.tab?.url || request.url;
          const title = sender?.tab?.title || request.title;
          const snippet = (request.snippetText || request.snippet || "").trim();

          if (!tabId || typeof tabId !== 'number') {
            sendResponse({ ok: false, error: "Invalid tabId" });
            return;
          }

          if (!snippet || snippet.length < 50) {
            sendResponse({ ok: false, error: "Snippet too short" });
            return;
          }

          await updateSnippetForTab(tabId, snippet, tabUrl, title);
          sendResponse({ ok: true });
        } catch (e) {
          console.error("[BG] pageSnippet error:", e);
          sendResponse({ ok: false, error: e.message });
        }
      })();
      return true;
    }

    sendResponse({ error: "Unknown action" });
    return false;
  } catch (err) {
    console.error("[BG] Message handler error:", err);
    try {
      sendResponse({ error: err.message });
    } catch {}
    return false;
  }
});

// OPTIMIZED TAB EVENT LISTENERS
chrome.tabs.onCreated.addListener((tab) => {
  // Debounced index rebuild
  setTimeout(() => buildFuseIndex(), 1500);
  
  // Request snippet after page loads
  setTimeout(() => {
    if (tab.id) requestSnippetFromTab(tab.id);
  }, 4000);
  
  // Trigger auto-grouping only for real tabs
  if (tab.url && !tab.url.startsWith("chrome://")) {
    debouncedAutoGrouping(10000); // 10s delay for new tabs
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  // Immediate index update for removals
  indexDocs = indexDocs.filter(doc => doc.id !== tabId);
  if (indexDocs.length > 0) {
    fuse = new Fuse(indexDocs, FUSE_OPTIONS);
  }
  
  // Clean up cache
  snippetRequestCache.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    setTimeout(() => buildFuseIndex(), 1500);
    setTimeout(() => requestSnippetFromTab(tabId), 2000);
    
    // Trigger auto-grouping when ungrouped tab finishes loading
    if (tab.url && !tab.url.startsWith("chrome://") && tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
      debouncedAutoGrouping(15000); // 15s delay for updated tabs
    }
  } else if (changeInfo.title) {
    const docIndex = indexDocs.findIndex(d => d.id === tabId);
    if (docIndex !== -1) {
      indexDocs[docIndex].title = changeInfo.title;
    }
  } else if (typeof changeInfo.groupId !== 'undefined') {
    const docIndex = indexDocs.findIndex(d => d.id === tabId);
    if (docIndex !== -1) {
      indexDocs[docIndex].groupId = changeInfo.groupId ?? chrome.tabGroups.TAB_GROUP_ID_NONE;
      setTimeout(() => buildFuseIndex(), 500);
    }
  }
});

// OPTIMIZED: Less frequent window focus updates
let windowFocusTimeout = null;
chrome.windows.onFocusChanged && chrome.windows.onFocusChanged.addListener(() => {
  clearTimeout(windowFocusTimeout);
  windowFocusTimeout = setTimeout(() => buildFuseIndex(), 1000);
});

// OPTIMIZED: Less frequent tab group updates
let tabGroupUpdateTimeout = null;
chrome.tabGroups.onUpdated && chrome.tabGroups.onUpdated.addListener(() => {
  clearTimeout(tabGroupUpdateTimeout);
  tabGroupUpdateTimeout = setTimeout(() => buildFuseIndex(), 1000);
});

chrome.runtime.onInstalled.addListener((details) => {
  console.log("📦 Extension installed/updated:", details.reason);

  setTimeout(async () => {
    try {
      const tabs = await chrome.tabs.query({});
      let count = 0;
      for (const tab of tabs) {
        if (tab.url && !tab.url.startsWith("chrome://") &&
          !tab.url.startsWith("chrome-extension://")) {
          setTimeout(() => requestSnippetFromTab(tab.id), count * 100);
          count++;
        }
      }
      console.log(`🔥 Requested content from ${count} existing tabs`);
    } catch (err) {
      console.error("Error requesting snippets:", err);
    }
  }, 3000);

  initializeAI();
});

chrome.runtime.onStartup.addListener(() => {
  console.log("🚀 Browser started");
  initializeAI();

  setTimeout(async () => {
    const tabs = await chrome.tabs.query({});
    tabs.forEach((tab, i) => {
      if (tab.url && !tab.url.startsWith("chrome://") &&
        !tab.url.startsWith("chrome-extension://")) {
        setTimeout(() => requestSnippetFromTab(tab.id), i * 100);
      }
    });
  }, 5000);
});

initializeAI();

console.log("🚀 [BG] AI Tab Manager loaded - OPTIMIZED VERSION");