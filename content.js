console.log('NekoShield content.js loaded');

function createNekoBar(verdict, score) {
  var existing = document.getElementById('nekoshield-bar');
  if (existing) existing.remove();

  var bar = document.createElement('div');
  bar.id = 'nekoshield-bar';
  bar.style.cssText = [
    'position: fixed',
    'top: 0',
    'left: 0',
    'right: 0',
    'z-index: 2147483647',
    'padding: 10px 20px',
    'display: flex',
    'align-items: center',
    'justify-content: space-between',
    'font-family: sans-serif',
    'font-size: 13px',
    'font-weight: 600',
    'box-shadow: 0 2px 10px rgba(0,0,0,0.3)'
  ].join(';');

  if (verdict === 'dangerous') {
    bar.style.background = '#ff2d78';
    bar.style.color = '#fff';
    bar.innerHTML = '🚨 <strong>NekoShield: HIGH RISK</strong> — This page may be dangerous! Threat level: ' + score + '%&nbsp;&nbsp;<a href="https://nekoshield.com" target="_blank" style="color:#fff;font-size:11px;opacity:0.85;">Learn more →</a><span id="neko-close" style="cursor:pointer;margin-left:16px;opacity:0.8;">✕</span>';
  } else if (verdict === 'suspicious') {
    bar.style.background = '#ffd600';
    bar.style.color = '#080b14';
    bar.innerHTML = '⚠️ <strong>NekoShield: SUSPICIOUS</strong> — Proceed with caution. Threat level: ' + score + '%&nbsp;&nbsp;<a href="https://nekoshield.com" target="_blank" style="color:#080b14;font-size:11px;opacity:0.75;">Learn more →</a><span id="neko-close" style="cursor:pointer;margin-left:16px;opacity:0.7;">✕</span>';
  } else {
    bar.style.background = '#00c853';
    bar.style.color = '#fff';
    bar.innerHTML = '✅ <strong>NekoShield: Page is Safe</strong> — No threats detected.<span id="neko-close" style="cursor:pointer;margin-left:16px;opacity:0.8;">✕</span>';
  }

  document.body.prepend(bar);

  document.getElementById('neko-close').addEventListener('click', function() {
    bar.remove();
  });

  if (verdict === 'safe') {
    setTimeout(function() {
      if (bar && bar.parentNode) bar.remove();
    }, 4000);
  }
}

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

function showLinkWarning(element, verdict) {
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

async function scanCurrentPage() {
  var currentUrl = window.location.href;
  var shownKey = 'neko_shown_' + btoa(currentUrl).substring(0, 20);
  
  if (sessionStorage.getItem(shownKey)) return;
  
  try {
    var response = await chrome.runtime.sendMessage({
      action: 'analyzeUrl',
      url: currentUrl
    });
    if (response && response.result) {
      sessionStorage.setItem(shownKey, '1');
      createNekoBar(response.result.verdict, response.result.score || 0);
    }
  } catch(e) {
    console.log('NekoShield error: ' + e.message);
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
        if (verdict === 'dangerous' || verdict === 'suspicious') {
          showLinkWarning(link.element, verdict);
        }
      }
    } catch(e) {}
    await new Promise(r => setTimeout(r, 300));
  }
}

scanCurrentPage();

var observer = new MutationObserver(function(mutations) {
  mutations.forEach(function(mutation) {
    mutation.addedNodes.forEach(function(node) {
      if (node.querySelectorAll) {
        var newLinks = node.querySelectorAll('a[href]');
        newLinks.forEach(function(link) {
          var href = link.href;
          if (href && href.startsWith('http') && !href.includes(window.location.hostname)) {
            chrome.runtime.sendMessage({
              action: 'analyzeUrl',
              url: href
            }, function(response) {
              if (response && response.result) {
                var verdict = response.result.verdict;
                if (verdict === 'dangerous' || verdict === 'suspicious') {
                  showLinkWarning(link, verdict);
                }
              }
            });
          }
        });
      }
    });
  });
});

if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
} else {
  document.addEventListener('DOMContentLoaded', function() {
    observer.observe(document.body, { childList: true, subtree: true });
  });
}
