const API_URL = 'https://nekoshield-server.onrender.com';

chrome.runtime.onInstalled.addListener(function() {
  console.log('NekoShield extension installed');
  chrome.storage.local.set({ scanned: 0, threats: 0, linksScanned: 0, urlCache: {} });
});

// Auto-scan URL when user navigates (free tier — no token consumption)
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    chrome.storage.local.get(['userEmail'], function(data) {
      if (!data.userEmail) return;
      analyzeUrl(tab.url, null).then(function(result) {
        if (!result) return;
        updateCounters(result.verdict, false);
        if (result.verdict === 'dangerous') {
          chrome.notifications.create('nekoshield-' + Date.now(), {
            type: 'basic', iconUrl: 'icon128.png',
            title: '🚨 HIGH RISK PAGE',
            message: 'This page is dangerous! Do not proceed.'
          });
        } else if (result.verdict === 'suspicious') {
          chrome.notifications.create('nekoshield-' + Date.now(), {
            type: 'basic', iconUrl: 'icon128.png',
            title: '⚠️ SUSPICIOUS PAGE',
            message: 'This page looks suspicious. Proceed with caution.'
          });
        }
      });
    });
  }
});

var urlCache = {};
var urlCacheOrder = [];
var MAX_CACHE = 50;

async function analyzeUrl(url, email) {
  try {
    if (urlCache[url]) return urlCache[url];
    var body = { url: url };
    if (email) body.email = email;
    var response = await fetch(API_URL + '/extension-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    var data = await response.json();
    urlCache[url] = data;
    urlCacheOrder.push(url);
    if (urlCacheOrder.length > MAX_CACHE) {
      var oldest = urlCacheOrder.shift();
      delete urlCache[oldest];
    }
    return data;
  } catch(e) { return null; }
}

function updateCounters(verdict, isLink) {
  chrome.storage.local.get(['scanned', 'threats', 'linksScanned'], function(data) {
    var scanned = data.scanned || 0;
    var threats = data.threats || 0;
    var linksScanned = data.linksScanned || 0;
    if (isLink) { linksScanned++; } else { scanned++; }
    if (verdict === 'dangerous' || verdict === 'suspicious') threats++;
    chrome.storage.local.set({ scanned: scanned, threats: threats, linksScanned: linksScanned });
  });
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {

  if (request.action === 'getUser') {
    chrome.storage.local.get(['userEmail', 'userTokens', 'reportPoints'], function(data) {
      if (!data.userEmail) { sendResponse({ email: null }); return; }
      // Fetch fresh token + points data from server
      fetch('https://nekoshield-server.onrender.com/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.userEmail })
      }).then(function(r) { return r.json(); }).then(function(d) {
        var tokens = d.tokens !== undefined ? d.tokens : (data.userTokens || 0);
        var reportPoints = d.report_points !== undefined ? d.report_points : (data.reportPoints || 0);
        chrome.storage.local.set({ userTokens: tokens, reportPoints: reportPoints });
        sendResponse({ email: data.userEmail, tokens: tokens, reportPoints: reportPoints });
      }).catch(function() {
        sendResponse({ email: data.userEmail, tokens: data.userTokens || 0, reportPoints: data.reportPoints || 0 });
      });
    });
    return true;
  }

  if (request.action === 'setUser') {
    chrome.storage.local.set({
      userEmail: request.email,
      userTokens: request.tokens || 0
    });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'updateTokens') {
    chrome.storage.local.set({ userTokens: request.tokens });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'logout') {
    chrome.storage.local.remove(['userEmail', 'userTokens', 'reportPoints']);
    sendResponse({ success: true });
    return true;
  }

  // Manual analysis from popup (consumes tokens)
  if (request.action === 'analyzeManual') {
    chrome.storage.local.get(['userEmail', 'userTokens'], function(data) {
      if (!data.userEmail) { sendResponse({ error: 'Not logged in' }); return; }
      if ((data.userTokens || 0) < 5) { sendResponse({ error: 'No analyses remaining' }); return; }
      // Force fresh analysis (bypass cache)
      var url = request.url;
      fetch(API_URL + '/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url, email: data.userEmail })
      }).then(function(r) { return r.json(); }).then(function(result) {
        if (result.tokensRemaining !== undefined) {
          chrome.storage.local.set({ userTokens: result.tokensRemaining });
        }
        sendResponse({ result: result });
      }).catch(function() { sendResponse({ error: 'Connection error' }); });
    });
    return true;
  }

  // Report a suspicious URL
  if (request.action === 'reportUrl') {
    chrome.storage.local.get(['userEmail'], function(data) {
      if (!data.userEmail) { sendResponse({ error: 'Not logged in' }); return; }
      fetch(API_URL + '/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: request.url, email: data.userEmail })
      }).then(function(r) { return r.json(); }).then(function(result) {
        if (result.success && result.tokensAdded) {
          chrome.storage.local.get('userTokens', function(d) {
            var newTokens = (d.userTokens || 0) + result.tokensAdded;
            chrome.storage.local.set({ userTokens: newTokens });
          });
        }
        sendResponse(result);
      }).catch(function() { sendResponse({ error: 'Connection error' }); });
    });
    return true;
  }

  if (request.action === 'analyzeUrl') {
    chrome.storage.local.get('userEmail', function(data) {
      analyzeUrl(request.url, data.userEmail || null).then(function(result) {
        sendResponse({ result: result });
      });
    });
    return true;
  }

  // Analyze page content (called from content.js)
  if (request.action === 'analyzePageContent') {
    chrome.storage.local.get(['userEmail', 'userTokens', 'pagesAnalyzed', 'pagesLimit'], function(data) {
      if (!data.userEmail) { sendResponse(null); return; }

      var pagesAnalyzed = data.pagesAnalyzed || 0;
      var pagesLimit = data.pagesLimit || 20; // 20 free pages by default
      var isPaid = (data.userTokens || 0) > 0 || pagesLimit > 20;

      // Check if free pages exhausted
      if (!isPaid && pagesAnalyzed >= pagesLimit) {
        sendResponse({ upgradeNeeded: true });
        return;
      }

      // Increment page count
      chrome.storage.local.set({ pagesAnalyzed: pagesAnalyzed + 1 });

      // Get URL verdict from backend
      analyzeUrl(request.url, null).then(function(urlResult) {
        var verdict = urlResult ? urlResult.verdict : 'safe';
        var urlScore = verdict === 'dangerous' ? 85 : verdict === 'suspicious' ? 50 : 0;
        var combinedScore = Math.max(request.localScore || 0, urlScore);

        // If paid and score is ambiguous, call AI behavioral analysis
        if (isPaid && combinedScore >= 20 && combinedScore < 70 && request.pageText) {
          fetch(API_URL + '/analyze-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: request.url,
              pageText: request.pageText,
              patterns: request.patterns,
              email: data.userEmail
            })
          }).then(function(r) { return r.json(); }).then(function(aiResult) {
            sendResponse({
              verdict: verdict,
              urlScore: urlScore,
              aiScore: aiResult.riskScore || 0,
              aiHumanMessage: aiResult.humanMessage || null,
              upgradeNeeded: false,
              isPaid: isPaid
            });
          }).catch(function() {
            sendResponse({ verdict: verdict, urlScore: urlScore, upgradeNeeded: false });
          });
        } else {
          sendResponse({ verdict: verdict, urlScore: urlScore, upgradeNeeded: false, isPaid: isPaid });
        }

        // Update counters
        if (urlResult) updateCounters(verdict, false);

        // Humanized notification for dangerous/suspicious
        if (verdict === 'dangerous' || combinedScore >= 70) {
          chrome.notifications.create('nekoshield-' + Date.now(), {
            type: 'basic', iconUrl: 'icons/icon128.png',
            title: '🔴 NekoShield — Get out of here!',
            message: 'This is a dangerous phishing attack. Close this page right now.'
          });
        } else if (verdict === 'suspicious' || combinedScore >= 40) {
          chrome.notifications.create('nekoshield-' + Date.now(), {
            type: 'basic', iconUrl: 'icons/icon128.png',
            title: '🚨 NekoShield — Hold on!',
            message: "This page is using tricks to pressure you. Don't click anything yet."
          });
        }
      });
    });
    return true;
  }

  // Set pages limit when user pays
  if (request.action === 'setPagesLimit') {
    chrome.storage.local.get('pagesLimit', function(data) {
      var current = data.pagesLimit || 20;
      chrome.storage.local.set({ pagesLimit: current + request.pages });
      sendResponse({ success: true });
    });
    return true;
  }

});
