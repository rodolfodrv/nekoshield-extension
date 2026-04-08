const NEKOSHIELD_API = 'https://nekoshield-server.onrender.com';
console.log('NekoShield content.js loaded');

function extractLinks() {
  var links = document.querySelectorAll('a[href]');
  var urls = [];
  links.forEach(function(link) {
    var href = link.href;
    if (href && href.startsWith('http') && !href.includes(window.location.hostname)) {
      urls.push({ element: link, url: href });
    }
  });
  return urls;
}

function showWarning(element, verdict) {
  if (verdict === 'dangerous') {
    element.style.border = '2px solid #ff2d78';
    element.style.borderRadius = '4px';
    element.style.padding = '2px';
    element.setAttribute('title', '🚨 NekoShield: HIGH RISK — This link may be dangerous');
  } else if (verdict === 'suspicious') {
    element.style.border = '2px solid #ffd600';
    element.style.borderRadius = '4px';
    element.style.padding = '2px';
    element.setAttribute('title', '⚠️ NekoShield: SUSPICIOUS — Proceed with caution');
  }
}

async function scanLinks() {
  var links = extractLinks();
  console.log('NekoShield found ' + links.length + ' links to scan');

  for (var i = 0; i < links.length; i++) {
    var link = links[i];
    try {
      var response = await chrome.runtime.sendMessage({
        action: 'analyzeUrl',
        url: link.url
      });
      if (response && response.result) {
        var verdict = response.result.verdict;
        console.log('NekoShield scanned: ' + link.url + ' — ' + verdict);
        if (verdict === 'dangerous' || verdict === 'suspicious') {
          showWarning(link.element, verdict);
          if (verdict === 'dangerous') {
            chrome.runtime.sendMessage({
              action: 'notify',
              title: '🚨 NekoShield Alert',
              message: 'Dangerous link detected on this page!'
            });
          }
        }
      }
    } catch(e) {
      console.log('NekoShield error: ' + e.message);
    }
    await new Promise(r => setTimeout(r, 500));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scanLinks);
} else {
  scanLinks();
}
