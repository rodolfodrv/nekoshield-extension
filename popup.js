document.addEventListener('DOMContentLoaded', function() {
  var API_URL = 'https://nekoshield-server.onrender.com';
  var isLoginMode = true;

  // ── TABS ──────────────────────────────────────────────────────────────────

  document.getElementById('tabLogin').addEventListener('click', function() {
    isLoginMode = true;
    document.getElementById('tabLogin').classList.add('active');
    document.getElementById('tabRegister').classList.remove('active');
    document.getElementById('loginBtn').textContent = 'Activate Protection 🛡️';
    clearMsg();
  });

  document.getElementById('tabRegister').addEventListener('click', function() {
    isLoginMode = false;
    document.getElementById('tabRegister').classList.add('active');
    document.getElementById('tabLogin').classList.remove('active');
    document.getElementById('loginBtn').textContent = 'Register Free 🛡️';
    clearMsg();
  });

  // ── HELPERS ───────────────────────────────────────────────────────────────

  function showMsg(msg, color) {
    var el = document.getElementById('loginMsg');
    el.textContent = msg;
    el.style.color = color || '#6b7280';
  }

  function clearMsg() {
    document.getElementById('loginMsg').textContent = '';
  }

  function toAnalyses(tokens) {
    return Math.floor((tokens || 0) / 5);
  }

  // ── SCREENS ───────────────────────────────────────────────────────────────

  function showLogin() {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('welcomeCard').style.display = 'none';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'none';
  }

  function showWelcome(email, tokens) {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('welcomeCard').style.display = 'block';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'block';
    // Store email for when they hit "maybe later"
    window._welcomeEmail = email;
    window._welcomeTokens = tokens;
  }

  function showDashboard(email, tokens) {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('welcomeCard').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('logoutBtn').style.display = 'block';
    document.getElementById('userEmailDisplay').textContent = email;
    var analyses = toAnalyses(tokens);
    document.getElementById('userAnalysesDisplay').textContent = analyses > 0 ? analyses + ' analyses left' : 'Free plan';
    chrome.storage.local.get(['scanned', 'threats', 'linksScanned'], function(data) {
      document.getElementById('scannedCount').textContent = data.scanned || 0;
      document.getElementById('threatsCount').textContent = data.threats || 0;
      document.getElementById('linksCount').textContent = data.linksScanned || 0;
    });
  }

  // ── INIT: check if already logged in ─────────────────────────────────────

  chrome.runtime.sendMessage({ action: 'getUser' }, function(response) {
    if (response && response.email) {
      showDashboard(response.email, response.tokens || 0);
    } else {
      showLogin();
    }
  });

  // ── LOGIN / REGISTER ──────────────────────────────────────────────────────

  document.getElementById('loginBtn').addEventListener('click', async function() {
    var email = document.getElementById('emailInput').value.trim();
    if (!email || !email.includes('@')) {
      showMsg('Please enter a valid email.', '#ff2d78');
      return;
    }
    showMsg('Connecting...', '#6b7280');

    try {
      if (isLoginMode) {
        // SIGN IN
        var response = await fetch(API_URL + '/tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email })
        });
        var data = await response.json();
        if (data.tokens !== undefined) {
          chrome.runtime.sendMessage({ action: 'setUser', email: email, tokens: data.tokens });
          showWelcome(email, data.tokens);
        } else {
          showMsg('Email not found. Please register first.', '#ff2d78');
        }
      } else {
        // REGISTER
        var response = await fetch(API_URL + '/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email })
        });
        var data = await response.json();
        if (data.success) {
          chrome.runtime.sendMessage({ action: 'setUser', email: email, tokens: data.tokens });
          showWelcome(email, data.tokens);
        } else {
          showMsg(data.error || 'Something went wrong.', '#ff2d78');
        }
      }
    } catch(e) {
      showMsg('Connection error. Please try again.', '#ff2d78');
    }
  });

  // ── WELCOME CARD BUTTONS ──────────────────────────────────────────────────

  document.getElementById('getFullBtn').addEventListener('click', function() {
    chrome.tabs.create({ url: 'https://nekoshield.com' });
  });

  document.getElementById('laterBtn').addEventListener('click', function() {
    showDashboard(window._welcomeEmail, window._welcomeTokens);
  });

  // ── LOGOUT ────────────────────────────────────────────────────────────────

  document.getElementById('logoutBtn').addEventListener('click', function() {
    chrome.runtime.sendMessage({ action: 'logout' });
    showLogin();
  });

});
