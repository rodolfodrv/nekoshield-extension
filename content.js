(function() {
  if (sessionStorage.getItem('neko_analyzed')) return;
  if (!window.location.href.startsWith('http')) return;
  sessionStorage.setItem('neko_analyzed', '1');

  // ── EXTRACT PAGE DATA ──────────────────────────────────────────────────
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

  // ── LOCAL MANIPULATION ANALYSIS (no AI) ───────────────────────────────
  function analyzeManipulation(pageData) {
    var text = pageData.text.toLowerCase();
    var score = 0;
    var patterns = [];

    var urgencyWords = [
      'act now','act immediately','immediately','expires in','expires today',
      'limited time','act fast','within 24 hours','urgent','final warning',
      'last chance','time is running out','don\'t wait','respond now'
    ];
    urgencyWords.forEach(function(w) {
      if (text.includes(w)) { score += 12; patterns.push('Urgency tactic: "' + w + '"'); }
    });

    var fearWords = [
      'suspended','blocked','unauthorized access','compromised',
      'verify now','account at risk','security alert','unusual activity',
      'your account will be','immediate action required','access restricted',
      'stolen','hacked'
    ];
    fearWords.forEach(function(w) {
      if (text.includes(w)) { score += 12; patterns.push('Fear language: "' + w + '"'); }
    });

    var rewardWords = [
      'you have won','congratulations','you\'ve been selected',
      'claim your prize','claim now','you are the winner',
      'free gift','special offer just for you','exclusive reward'
    ];
    rewardWords.forEach(function(w) {
      if (text.includes(w)) { score += 18; patterns.push('Fake reward: "' + w + '"'); }
    });

    var coercionWords = [
      'do not ignore','failure to comply','legal action',
      'your account will be permanently','you must','required to verify'
    ];
    coercionWords.forEach(function(w) {
      if (text.includes(w)) { score += 20; patterns.push('Coercion: "' + w + '"'); }
    });

    if (pageData.hasCountdown) {
      score += 20;
      patterns.push('Countdown timer — creates artificial urgency');
    }
    if (pageData.hasPasswordAndCard) {
      score += 35;
      patterns.push('Password + credit card requested together');
    }

    return { score: Math.min(100, score), patterns: patterns };
  }

  // ── HUMANIZED MESSAGES ─────────────────────────────────────────────────
  function getHumanMessage(score) {
    if (score < 20) {
      return { level: 'safe', emoji: '✅', title: "You're good to go!", message: "We checked this page and everything looks safe. Browse with confidence!" };
    } else if (score < 40) {
      return { level: 'low', emoji: '🤔', title: "Something feels a little off here.", message: "Nothing confirmed, but be careful before clicking anything or sharing personal info." };
    } else if (score < 70) {
      return { level: 'medium', emoji: '⚠️', title: "Hold on!", message: "This page is using classic tricks to pressure you into acting fast. That's exactly what scammers do. Take a breath and don't click anything yet." };
    } else if (score < 90) {
      return { level: 'high', emoji: '🚨', title: "We're pretty sure this page is trying to trick you.", message: "It's pretending to be someone you trust to steal your information. Please don't enter anything here." };
    } else {
      return { level: 'critical', emoji: '🔴', title: "Get out of here!", message: "This is a dangerous phishing attack. Close this page right now and do not click or type anything. You're safe — we caught it in time." };
    }
  }

  // ── SHOW BAR ───────────────────────────────────────────────────────────
  function showBar(humanMsg, finalScore, isPaid, domain) {
    var existing = document.getElementById('nekoshield-bar');
    if (existing) existing.remove();

    var colors = {
      safe:     { bg: '#00c96e', border: '#00a857', text: '#ffffff' },
      low:      { bg: '#f0a500', border: '#c97f00', text: '#ffffff' },
      medium:   { bg: '#e06000', border: '#b54a00', text: '#ffffff' },
      high:     { bg: '#d42060', border: '#a8164a', text: '#ffffff' },
      critical: { bg: '#8b0000', border: '#5a0000', text: '#ffffff' },
      upgrade:  { bg: '#0d1224', border: '#00e5ff', text: '#e8eaf6' }
    };

    var c = colors[humanMsg.level] || colors.safe;
    var hasRisk = finalScore >= 20;

    if (!document.getElementById('neko-style')) {
      var style = document.createElement('style');
      style.id = 'neko-style';
      style.textContent = [
        '@keyframes nekoIn{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}',
        '.neko-btn{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:100px;border:none;font-size:0.75rem;font-weight:700;cursor:pointer;transition:opacity 0.2s;font-family:inherit;}',
        '.neko-btn:hover{opacity:0.85;}',
        '.neko-btn-primary{background:rgba(255,255,255,0.95);color:#080b14;}',
        '.neko-btn-danger{background:rgba(255,45,120,0.9);color:#ffffff;}',
        '.neko-btn-outline{background:rgba(255,255,255,0.15);color:#ffffff;border:1px solid rgba(255,255,255,0.4);}',
        '.neko-btn-cyan{background:#00e5ff;color:#080b14;}'
      ].join('');
      document.head.appendChild(style);
    }

    var bar = document.createElement('div');
    bar.id = 'nekoshield-bar';
    bar.setAttribute('style', [
      'position:fixed','top:0','left:0','right:0','z-index:2147483647',
      'background:' + c.bg,'border-bottom:3px solid ' + c.border,
      'color:' + c.text,
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'padding:10px 16px','box-shadow:0 4px 20px rgba(0,0,0,0.35)',
      'animation:nekoIn 0.35s ease'
    ].join(';'));

    // Build action buttons based on tier and risk level
    var buttonsHtml = '';

    if (humanMsg.level === 'upgrade') {
      // Free pages exhausted
      buttonsHtml = '<button class="neko-btn neko-btn-cyan" id="neko-upgrade-btn">🔍 Get Full Protection — $1</button>';
    } else if (hasRisk && !isPaid) {
      // Free user with risk — show upsell
      buttonsHtml = '<button class="neko-btn neko-btn-cyan" id="neko-upgrade-btn">🔍 Unlock Deep Analysis — $1</button>';
    } else if (hasRisk && isPaid) {
      // Paid user with risk — show verify + report
      buttonsHtml = [
        '<button class="neko-btn neko-btn-primary" id="neko-verify-btn">🔍 Verify This Link</button>',
        '<button class="neko-btn neko-btn-danger" id="neko-report-btn">🚩 Report</button>'
      ].join('');
    }

    // Free upsell message when there's risk
    var upsellHtml = '';
    if (hasRisk && !isPaid && humanMsg.level !== 'upgrade') {
      upsellHtml = '<div style="font-size:0.72rem;opacity:0.85;margin-top:5px;font-style:italic;">This page may contain hidden manipulation patterns. Want us to do a deep psychological analysis?</div>';
    }

    bar.innerHTML = [
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">',
        '<div style="display:flex;align-items:flex-start;gap:10px;flex:1;min-width:0;">',
          '<span style="font-size:1.3rem;flex-shrink:0;margin-top:1px;">' + humanMsg.emoji + '</span>',
          '<div>',
            '<div style="font-weight:800;font-size:0.87rem;">' + humanMsg.title + '</div>',
            '<div style="font-size:0.76rem;opacity:0.9;margin-top:2px;line-height:1.4;">' + humanMsg.message + '</div>',
            upsellHtml,
            buttonsHtml ? '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">' + buttonsHtml + '</div>' : '',
          '</div>',
        '</div>',
        '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">',
          '<span style="font-size:0.65rem;opacity:0.6;white-space:nowrap;">🛡️ NekoShield</span>',
          '<button id="neko-close" style="background:rgba(0,0,0,0.2);border:none;color:inherit;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:0.85rem;line-height:1;flex-shrink:0;">✕</button>',
        '</div>',
      '</div>'
    ].join('');

    document.body.insertBefore(bar, document.body.firstChild);

    // Close button
    document.getElementById('neko-close').addEventListener('click', function() {
      bar.style.transition = 'opacity 0.2s';
      bar.style.opacity = '0';
      setTimeout(function() { bar.remove(); }, 200);
    });

    // Upgrade button
    var upgradeBtn = document.getElementById('neko-upgrade-btn');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', function() {
        window.open('https://nekoshield.com/#pricing', '_blank');
      });
    }

    // Verify button — opens popup analyze tab
    var verifyBtn = document.getElementById('neko-verify-btn');
    if (verifyBtn) {
      verifyBtn.addEventListener('click', function() {
        chrome.runtime.sendMessage({ action: 'openPopupAnalyze', url: window.location.href });
      });
    }

    // Report button
    var reportBtn = document.getElementById('neko-report-btn');
    if (reportBtn) {
      reportBtn.addEventListener('click', function() {
        chrome.runtime.sendMessage({
          action: 'reportUrl',
          url: window.location.href
        }, function(response) {
          if (response && response.success) {
            reportBtn.textContent = '✅ Reported!';
            reportBtn.disabled = true;
          } else {
            reportBtn.textContent = '❌ Error';
          }
        });
      });
    }

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

  // ── MAIN ──────────────────────────────────────────────────────────────
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

      if (resp.upgradeNeeded) {
        showBar({
          level: 'upgrade',
          emoji: '🛡️',
          title: "Your free protection has run out.",
          message: "Upgrade to keep your shield active and get deep psychological analysis on every page you visit."
        }, 100, false, domain);
        return;
      }

      var urlScore = resp.verdict === 'dangerous' ? 85 : resp.verdict === 'suspicious' ? 50 : 0;
      var finalScore = Math.max(localAnalysis.score, urlScore, resp.aiScore || 0);
      var humanMsg = getHumanMessage(finalScore);

      if (resp.aiHumanMessage) {
        humanMsg.message = resp.aiHumanMessage;
      }

      showBar(humanMsg, finalScore, resp.isPaid || false, domain);
    });
  });

})();
