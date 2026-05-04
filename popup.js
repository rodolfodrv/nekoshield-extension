document.addEventListener('DOMContentLoaded', function() {

  var isLoginMode = true;
  var currentUser = null;

  // ── NEKO IMAGE FALLBACK ───────────────────────────────────────────────────
  var nekoAvatar = document.getElementById('nekoAvatar');
  if (nekoAvatar) {
    nekoAvatar.onerror = function() {
      this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🛡️</text></svg>';
    };
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────
  function toAnalyses(tokens) { return Math.floor((tokens || 0) / 5); }

  function showLoginMsg(msg, color) {
    var el = document.getElementById('loginMsg');
    el.textContent = msg;
    el.style.color = color || '#6b7280';
  }

  function showReportMsg(msg, color) {
    var el = document.getElementById('reportMsg');
    el.textContent = msg;
    el.style.color = color || '#6b7280';
  }

  // ── SCREENS ───────────────────────────────────────────────────────────────
  function showLogin() {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('welcomeCard').style.display = 'none';
    document.getElementById('mainDashboard').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('headerEmail').textContent = '';
    document.getElementById('headerAnalyses').style.display = 'none';
  }

  function showWelcome(user) {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('welcomeCard').style.display = 'block';
    document.getElementById('mainDashboard').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'block';
    currentUser = user;
  }

  function showDashboard(user) {
    currentUser = user;
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('welcomeCard').style.display = 'none';
    document.getElementById('mainDashboard').style.display = 'block';
    document.getElementById('logoutBtn').style.display = 'block';

    // Header
    document.getElementById('headerEmail').textContent = user.email;
    var analyses = toAnalyses(user.tokens);
    if (analyses > 0) {
      document.getElementById('headerAnalyses').style.display = 'inline-flex';
      document.getElementById('headerAnalyses').textContent = analyses + ' analyses';
    } else {
      document.getElementById('headerAnalyses').style.display = 'none';
    }

    // Stats
    chrome.storage.local.get(['scanned', 'threats', 'linksScanned'], function(data) {
      document.getElementById('scannedCount').textContent = data.scanned || 0;
      document.getElementById('threatsCount').textContent = data.threats || 0;
      document.getElementById('linksCount').textContent = data.linksScanned || 0;
    });

    // Report points
    document.getElementById('reportPointsNum').textContent = user.reportPoints || 0;

    // Show/hide no-analyses message
    updateAnalyzeUI(analyses);
  }

  function updateAnalyzeUI(analyses) {
    var noMsg = document.getElementById('noAnalysesMsg');
    var btn = document.getElementById('analyzeRunBtn');
    var input = document.getElementById('urlAnalyzeInput');
    if (analyses <= 0) {
      noMsg.style.display = 'block';
      btn.disabled = true;
      btn.style.opacity = '0.4';
      input.disabled = true;
    } else {
      noMsg.style.display = 'none';
      btn.disabled = false;
      btn.style.opacity = '1';
      input.disabled = false;
    }
  }

  // ── INIT ──────────────────────────────────────────────────────────────────
  chrome.runtime.sendMessage({ action: 'getUser' }, function(response) {
    if (response && response.email) {
      showDashboard(response);
    } else {
      showLogin();
    }
  });

  // ── AUTH TABS ─────────────────────────────────────────────────────────────
  document.getElementById('tabLogin').addEventListener('click', function() {
    isLoginMode = true;
    document.getElementById('tabLogin').classList.add('active');
    document.getElementById('tabRegister').classList.remove('active');
    document.getElementById('loginBtn').textContent = 'Activate Protection 🛡️';
    showLoginMsg('');
  });

  document.getElementById('tabRegister').addEventListener('click', function() {
    isLoginMode = false;
    document.getElementById('tabRegister').classList.add('active');
    document.getElementById('tabLogin').classList.remove('active');
    document.getElementById('loginBtn').textContent = 'Register Free 🛡️';
    showLoginMsg('');
  });

  // ── LOGIN / REGISTER ──────────────────────────────────────────────────────
  document.getElementById('loginBtn').addEventListener('click', async function() {
    var email = document.getElementById('emailInput').value.trim();
    if (!email || !email.includes('@')) { showLoginMsg('Please enter a valid email.', '#ff2d78'); return; }
    showLoginMsg('Connecting...', '#6b7280');

    var API_URL = 'https://nekoshield-server.onrender.com';
    try {
      if (isLoginMode) {
        var r = await fetch(API_URL + '/tokens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email }) });
        var d = await r.json();
        if (d.tokens !== undefined) {
          chrome.runtime.sendMessage({ action: 'setUser', email: email, tokens: d.tokens });
          showWelcome({ email: email, tokens: d.tokens, reportPoints: 0 });
        } else {
          showLoginMsg('Email not found. Please register first.', '#ff2d78');
        }
      } else {
        var r = await fetch(API_URL + '/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email }) });
        var d = await r.json();
        if (d.success) {
          chrome.runtime.sendMessage({ action: 'setUser', email: email, tokens: d.tokens });
          showWelcome({ email: email, tokens: d.tokens, reportPoints: 0 });
        } else {
          showLoginMsg(d.error || 'Something went wrong.', '#ff2d78');
        }
      }
    } catch(e) { showLoginMsg('Connection error. Please try again.', '#ff2d78'); }
  });

  // ── WELCOME BUTTONS ───────────────────────────────────────────────────────
  document.getElementById('getFullBtn').addEventListener('click', function() {
    chrome.tabs.create({ url: 'https://nekoshield.com' });
  });

  document.getElementById('laterBtn').addEventListener('click', function() {
    showDashboard(currentUser);
  });

  // ── LOGOUT ────────────────────────────────────────────────────────────────
  document.getElementById('logoutBtn').addEventListener('click', function() {
    chrome.runtime.sendMessage({ action: 'logout' });
    showLogin();
  });

  // ── MAIN TABS ─────────────────────────────────────────────────────────────
  window.switchMainTab = function(tab) {
    document.querySelectorAll('.main-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
    document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
    document.getElementById('panel' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
  };

  // ── ANALYZE TAB ───────────────────────────────────────────────────────────
  document.getElementById('analyzeRunBtn').addEventListener('click', function() {
    var url = document.getElementById('urlAnalyzeInput').value.trim();
    if (!url) { return; }
    if (!url.startsWith('http')) url = 'https://' + url;

    document.getElementById('analyzeLoading').style.display = 'block';
    document.getElementById('resultCard').style.display = 'none';
    document.getElementById('analyzeRunBtn').disabled = true;

    chrome.runtime.sendMessage({ action: 'analyzeManual', url: url }, function(response) {
      document.getElementById('analyzeLoading').style.display = 'none';
      document.getElementById('analyzeRunBtn').disabled = false;

      if (response.error) {
        if (response.error === 'No analyses remaining') {
          updateAnalyzeUI(0);
        }
        return;
      }

      var data = response.result;
      showAnalyzeResult(data);

      // Update token count in header
      if (data.tokensRemaining !== undefined) {
        var newAnalyses = toAnalyses(data.tokensRemaining);
        document.getElementById('headerAnalyses').textContent = newAnalyses + ' analyses';
        if (currentUser) currentUser.tokens = data.tokensRemaining;
        updateAnalyzeUI(newAnalyses);
      }
    });
  });

  function showAnalyzeResult(data) {
    var verdict = data.verdict || 'safe';
    var score = data.score || 0;

    var card = document.getElementById('resultCard');
    var verdictEl = document.getElementById('resultVerdict');
    var emoji = document.getElementById('resultEmoji');
    var title = document.getElementById('resultTitle');
    var scoreEl = document.getElementById('resultScore');

    card.style.display = 'block';
    verdictEl.className = 'result-verdict ' + verdict;
    title.className = 'result-title ' + verdict;

    if (verdict === 'safe') {
      emoji.textContent = '✅'; title.textContent = 'SECURE';
      scoreEl.textContent = 'No significant threats detected';
    } else if (verdict === 'suspicious') {
      emoji.textContent = '⚠️'; title.textContent = 'SUSPICIOUS';
      scoreEl.textContent = 'Threat level: ' + score + '% — Proceed with caution';
    } else {
      emoji.textContent = '🚨'; title.textContent = 'HIGH RISK';
      scoreEl.textContent = 'Threat level: ' + score + '% — Do not proceed';
    }

    // Human-readable details
    var details = document.getElementById('resultDetails');
    details.innerHTML = '';

    var labelMap = {
      'Domain Age': '📅 Domain age',
      'Google Safe Browsing': '🌐 Google check',
      'OpenPhish': '🎣 Phishing database',
      'NekoShield Database': '🛡️ NekoShield DB',
      'Brand Impersonation': '🎭 Brand check',
      'Brand in Subdomain': '🎭 Brand check',
      'Typosquatting': '🔤 Domain similarity',
      'URL Analysis': '🔗 URL analysis',
      'SSL Certificate': '🔒 SSL certificate',
      'Redirections': '↪️ Redirections',
      'DNS Check': '📡 DNS check',
      'AI Detection': '🤖 AI detection',
      'AI Analysis': '🤖 AI analysis',
      'Whitelist': '✅ Trusted domain'
    };

    if (data.signals && data.signals.length > 0) {
      data.signals.forEach(function(signal) {
        var label = labelMap[signal.label] || signal.label;
        details.innerHTML += '<div class="detail-item"><div class="detail-dot ' + signal.type + '"></div><div><div class="detail-label">' + label + '</div><div class="detail-value">' + signal.value + '</div></div></div>';
      });
    }

    // Report count
    if (data.reportCount && data.reportCount > 0) {
      details.innerHTML += '<div class="detail-item"><div class="detail-dot danger"></div><div><div class="detail-label">🚩 Community reports</div><div class="detail-value">' + data.reportCount + ' user' + (data.reportCount > 1 ? 's have' : ' has') + ' reported this link as suspicious</div></div></div>';
    }

    // Explanation
    if (data.explanation) {
      var expEl = document.getElementById('resultExplanation');
      expEl.textContent = '🛡️ ' + data.explanation;
      expEl.style.display = 'block';
    } else {
      document.getElementById('resultExplanation').style.display = 'none';
    }

    // Analyses remaining
    if (data.tokensRemaining !== undefined) {
      document.getElementById('resultAnalyses').textContent = toAnalyses(data.tokensRemaining) + ' analyses remaining';
    }
  }

  // ── REPORT TAB ────────────────────────────────────────────────────────────
  document.getElementById('reportRunBtn').addEventListener('click', function() {
    var url = document.getElementById('urlReportInput').value.trim();
    if (!url) { showReportMsg('Please enter a URL to report.', '#ff2d78'); return; }
    if (!url.startsWith('http')) url = 'https://' + url;

    document.getElementById('reportRunBtn').disabled = true;
    showReportMsg('Submitting report...', '#6b7280');

    chrome.runtime.sendMessage({ action: 'reportUrl', url: url }, function(response) {
      document.getElementById('reportRunBtn').disabled = false;
      if (response && response.success) {
        showReportMsg('✅ Report submitted! You earned 1 free analysis.', '#00ff88');
        document.getElementById('urlReportInput').value = '';
        // Update points display
        var current = parseInt(document.getElementById('reportPointsNum').textContent) || 0;
        document.getElementById('reportPointsNum').textContent = current + 1;
        // Update analyses in header
        if (currentUser) {
          currentUser.tokens = (currentUser.tokens || 0) + 5;
          var newAnalyses = toAnalyses(currentUser.tokens);
          document.getElementById('headerAnalyses').textContent = newAnalyses + ' analyses';
          document.getElementById('headerAnalyses').style.display = 'inline-flex';
          updateAnalyzeUI(newAnalyses);
        }
      } else if (response && response.error) {
        showReportMsg(response.error, '#ff2d78');
      } else {
        showReportMsg('Connection error. Please try again.', '#ff2d78');
      }
    });
  });

});
