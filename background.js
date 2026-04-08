const API_URL = 'https://nekoshield-server.onrender.com';

chrome.runtime.onInstalled.addListener(function() {
  console.log('NekoShield extension installed');
  chrome.storage.local.set({ scanned: 0, threats: 0, urlCache: {} });
});

// Analiza la URL principal cuando el usuario navega
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    chrome.storage.local.get('userEmail', function(data) {
      var email = data.userEmail || null;
      analyzeUrl(tab.url, email).then(function(result) {
        if (!result) return;
        updateCounters(result.verdict);
        if (result.verdict === 'dangerous' || result.verdict === 'suspicious') {
          chrome.notifications.create(
            'nekoshield-' + Date.now(),
            {
              type: 'basic',
              iconUrl: 'icon128.png',
              title: result.verdict === 'dangerous' ? '🚨 HIGH RISK PAGE' : '⚠️ SUSPICIOUS PAGE',
              message: result.verdict === 'dangerous' ? 'This page is dangerous! Do not proceed.' : 'This page looks suspicious. Proceed with caution.'
            }
          );
        } else {
          chrome.notifications.create(
            'nekoshield-' + Date.now(),
            {
              type: 'basic',
              iconUrl: 'icon128.png',
              title: '✅ NekoShield: Page is Safe',
              message: 'No threats detected on this page.'
            }
          );
        }
      });
    });
  }
});

var urlCache = {};

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
    return data;
  } catch(e) {
    return null;
  }
}

function updateCounters(verdict) {
  chrome.storage.local.get(['scanned', 'threats'], function(data) {
    var scanned = (data.scanned || 0) + 1;
    var threats = data.threats || 0;
    if (verdict === 'dangerous' || verdict === 'suspicious') threats++;
    chrome.storage.local.set({ scanned: scanned, threats: threats });
  });
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'analyzeUrl') {
    chrome.storage.local.get('userEmail', function(data) {
      analyzeUrl(request.url, data.userEmail || null).then(function(result) {
        sendResponse({ result: result });
      });
    });
    return true;
  }
  if (request.action === 'getUser') {
    chrome.storage.local.get('userEmail', function(data) {
      sendResponse({ email: data.userEmail || null });
    });
    return true;
  }
  if (request.action === 'setUser') {
    chrome.storage.local.set({ userEmail: request.email });
    sendResponse({ success: true });
    return true;
  }
  if (request.action === 'logout') {
    chrome.storage.local.remove('userEmail');
    sendResponse({ success: true });
    return true;
  }
});
