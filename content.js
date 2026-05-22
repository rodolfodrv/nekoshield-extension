(function() {
  // Don't run twice on same page
  if (sessionStorage.getItem('neko_analyzed')) return;
  if (!window.location.href.startsWith('http')) return;
  sessionStorage.setItem('neko_analyzed', '1');

  // ── EXTRACT PAGE DATA ────────────────────────────────────────────────────
  function extractPageData() {
    var bodyText = document.body ? document.body.innerText.substring(0, 3000) : '';
    var hasCountdown = !!document.querySelector(
      '[id*="countdown"],[class*="countdown"],[id*="timer"],[class*="timer"]'
    );
    var hasPassword = !!document.querySelector('input[type="password"]');
    var hasCreditCard = !!document.querySelector(
      'input[name*="card"],input[name*="credit"],input[id*="card"],input[placeholder*="card"]'
    );
    return {
      text: bodyText,
      url: window.location.href,
      hasCountdown: hasCountdown,
      hasPasswordAndCard: hasPassword && hasCreditCard,
      hasForm: !!document.querySelector('form')
    };
  }

  // ── LOCAL MANIPULATION ANALYSIS (no AI) ──────────────────────────────────
  function analyzeManipulation(pageData) {
    var text = pageData.text.toLowerCase();
    var score = 0;
    var patterns = [];

    var urgencyWords = [
      'act now', 'act immediately', 'immediately', 'expires in', 'expires today',
      'limited time', 'act fast', 'within 24 hours', 'urgent', 'final warning',
      'last chance', 'time is running out', 'don\'t wait', 'respond now'
    ];
    urgencyWords.forEach(function(w) {
      if (text.includes(w)) { score += 12; patterns.push('Urgency tactic: "' + w + '"'); }
    });

    var fearWords = [
      'suspended', 'blocked', 'unauthorized access', 'compromised',
      'verify now', 'account at risk', 'security alert', 'unusual activity',
      'your account will be', 'immediate action required', 'access restricted',
      'your information', 'stolen', 'hacked'
    ];
    fearWords.forEach(function(w) {
      if (text.includes(w)) { score += 12; patterns.push('Fear language: "' + w + '"'); }
    });

    var rewardWords = [
      'you have won', 'congratulations', 'you\'ve been selected',
      'claim your prize', 'claim now', 'you are the winner',
      'free gift', 'special offer just for you', 'exclusive reward'
    ];
    rewardWords.forEach(function(w) {
      if (text.includes(w)) { score += 18; patterns.push('Fake reward: "' + w + '"'); }
    });

    var coercionWords = [
      'do not ignore', 'failure to comply', 'legal action',
      'your account will be permanently', 'you must', 'required to verify'
    ];
    coercionWords.forEach(function(w) {
      if (text.includes(w)) { score += 20; patterns.push('Coercion: "' + w + '"'); }
    });

    if (pageData.hasCountdown) {
      score += 20;
      patterns.push('Countdown timer detected — creates artificial urgency');
    }
    if (pageData.hasPasswordAndCard) {
      score += 35;
      patterns.push('Password + credit card requested together — highly suspicious');
    }

    return { score: Math.min(100, score), patterns: patterns };
  }

  // ── HUMANIZED MESSAGES ───────────────────────────────────────────────────
  function getHumanMessage(score) {
    if (score < 20) {
      return {
        level: 'safe',
        emoji: '✅',
        title: "You're good to go!",
        message: "We checked this page and everything looks safe. Browse with confidence!"
      };
    } else if (score < 40) {
      return {
        level: 'low',
        emoji: '🤔',
        title: "Something feels a little off here.",
        message: "Nothing confirmed, but be careful before clicking anything or sharing personal info."
      };
    } else if (score < 70) {
      return {
        level: 'medium',
        emoji: '⚠️',
        title: "Hold on!",
        message: "This page is using classic tricks to pressure you into acting fast. That's exactly what scammers do. Take a breath and don't click anything yet."
      };
    } else if (score < 90) {
      return {
        level: 'high',
        emoji: '🚨',
        title: "We're pretty sure this page is trying to trick you.",
        message: "It's pretending to be someone you trust to steal your information. Please don't enter anything here."
      };
    } else {
      return {
        level: 'critical',
        emoji: '🔴',
        title: "Get out of here!",
        message: "This is a dangerous phishing attack. Close this page right now and do not click or type anything. You're safe — we caught it in time."
      };
    }
  }

  // ── SHOW BAR ─────────────────────────────────────────────────────────────
  function showBar(humanMsg, domain) {
    var existing = document.getElementById('nekoshield-bar');
    if (existing) existing.remove();

    var colors = {
      safe:     { bg: '#00c96e', border: '#00a857', text: '#ffffff' },
      low:      { bg: '#f0a500', border: '#c97f00', text: '#ffffff' },
      medium:   { bg: '#e06000', border: '#b54a00', text: '#ffffff' },
      high:     { bg: '#d42060', border: '#a8164a', text: '#ffffff' },
      critical: { bg: '#8b0000', border: '#5a0000', text: '#ffffff' },
      upgrade:  { bg: '#1a2340', border: '#00e5ff', text: '#e8eaf6' }
    };

    var c = colors[humanMsg.level] || colors.safe;

    // Inject animation style once
    if (!document.getElementById('neko-style')) {
      var style = document.createElement('style');
      style.id = 'neko-style';
      style.textContent = '@keyframes nekoIn{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}';
      document.head.appendChild(style);
    }

    var bar = document.createElement('div');
    bar.id = 'nekoshield-bar';
    bar.setAttribute('style', [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:2147483647',
      'background:' + c.bg, 'border-bottom:3px solid ' + c.border,
      'color:' + c.text,
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'padding:10px 16px', 'display:flex', 'align-items:center',
      'justify-content:space-between', 'box-shadow:0 4px 20px rgba(0,0,0,0.35)',
      'animation:nekoIn 0.35s ease'
    ].join(';'));

    var domainLabel = domain ? '<span style="font-size:0.68rem;opacity:0.7;display:block;margin-top:1px;">' + domain + '</span>' : '';

    bar.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">' +
        '<span style="font-size:1.4rem;flex-shrink:0;">' + humanMsg.emoji + '</span>' +
        '<div style="min-width:0;">' +
          '<div style="font-weight:800;font-size:0.87rem;letter-spacing:-0.2px;">' + humanMsg.title + '</div>' +
          '<div style="font-size:0.76rem;opacity:0.9;margin-top:2px;line-height:1.4;">' + humanMsg.message + '</div>' +
          domainLabel +
        '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:12px;">' +
        '<span style="font-size:0.68rem;opacity:0.6;white-space:nowrap;">🛡️ NekoShield</span>' +
        '<button id="neko-close" style="background:rgba(0,0,0,0.2);border:none;color:inherit;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:0.85rem;line-height:1;flex-shrink:0;">✕</button>' +
      '</div>';

    document.body.insertBefore(bar, document.body.firstChild);

    document.getElementById('neko-close').addEventListener('click', function() {
      bar.style.animation = 'none';
      bar.style.transition = 'opacity 0.2s';
      bar.style.opacity = '0';
      setTimeout(function() { bar.remove(); }, 200);
    });

    // Auto-hide safe bar after 4 seconds
    if (humanMsg.level === 'safe') {
      setTimeout(function() {
        if (bar.parentNode) {
          bar.style.transition = 'opacity 0.5s';
          bar.style.opacity = '0';
          setTimeout(function() { bar.remove(); }, 500);
        }
      }, 4000);
    }
  }

  // ── MAIN ─────────────────────────────────────────────────────────────────
  chrome.runtime.sendMessage({ action: 'getUser' }, function(response) {
    if (!response || !response.email) return;

    var pageData = extractPageData();
    var localAnalysis = analyzeManipulation(pageData);
    var domain = window.location.hostname.replace('www.', '');

    chrome.runtime.sendMessage({
      action: 'analyzePageContent',
      url: pageData.url,
      pageText: pageData.text,
      localScore: localAnalysis.score,
      patterns: localAnalysis.patterns,
      hasPasswordAndCard: pageData.hasPasswordAndCard,
      hasCountdown: pageData.hasCountdown
    }, function(resp) {
      if (!resp) return;

      // Upgrade needed — free pages exhausted
      if (resp.upgradeNeeded) {
        showBar({
          level: 'upgrade',
          emoji: '🛡️',
          title: "Your free protection has run out.",
          message: "Get full page analysis for just $1 — 50 pages protected. Visit nekoshield.com to upgrade."
        }, domain);
        return;
      }

      // Combine local score with URL verdict from backend
      var urlScore = resp.verdict === 'dangerous' ? 85 : resp.verdict === 'suspicious' ? 50 : 0;
      var finalScore = Math.max(localAnalysis.score, urlScore, resp.aiScore || 0);

      var humanMsg = getHumanMessage(finalScore);

      // AI gave us a better human message — use it
      if (resp.aiHumanMessage) {
        humanMsg.message = resp.aiHumanMessage;
      }

      showBar(humanMsg, domain);
    });
  });

})();
