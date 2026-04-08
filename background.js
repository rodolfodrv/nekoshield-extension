const API_URL = 'https://nekoshield-server.onrender.com';

chrome.runtime.onInstalled.addListener(function() {
  console.log('NekoShield extension installed');
  chrome.storage.local.set({ scannedUrls: {} });
});

async function analyzeUrl(url) {
  try {
    var scannedUrls = await chrome.storage.local.get('scannedUrls');
    var cache = scannedUrls.scannedUrls || {};
    
    if (cache[url]) return cache[url];

    var response = await fetch(API_URL + '/extension-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url })
    });

    var data = await response.json();
    
    cache[url] = data;
    chrome.storage.local.set({ scannedUrls: cache });
    
    return data;
  } catch(e) {
    return null;
  }
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'analyzeUrl') {
    analyzeUrl(request.url).then(function(result) {
      sendResponse({ result: result });
    });
    return true;
  }
  if (request.action === 'notify') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon128.png',
      title: request.title,
      message: request.message
    });
  }
});
