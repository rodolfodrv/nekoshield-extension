var API_URL = 'https://nekoshield-server.onrender.com';
var isLoginMode = true;

document.getElementById('tabLogin').addEventListener('click', function() {
  isLoginMode = true;
  document.getElementById('tabLogin').style.background = '#00e5ff';
  document.getElementById('tabLogin').style.color = '#080b14';
  document.getElementById('tabRegister').style.background = 'transparent';
  document.getElementById('tabRegister').style.color = '#00e5ff';
  document.getElementById('loginBtn').textContent = 'Sign In 🛡️';
});

document.getElementById('tabRegister').addEventListener('click', function() {
  isLoginMode = false;
  document.getElementById('tabRegister').style.background = '#00e5ff';
  document.getElementById('tabRegister').style.color = '#080b14';
  document.getElementById('tabLogin').style.background = 'transparent';
  document.getElementById('tabLogin').style.color = '#00e5ff';
  document.getElementById('loginBtn').textContent = 'Register Free 🛡️';
});
function showMsg(msg, color) {
  var el = document.getElementById('loginMsg');
  el.textContent = msg;
  el.style.color = color || '#6b7280';
}

function showDashboard(email) {
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('logoutBtn').style.display = 'block';
  document.getElementById('userEmailDisplay').textContent = email;
  chrome.storage.local.get(['scanned', 'threats'], function(data) {
    document.getElementById('scannedCount').textContent = data.scanned || 0;
    document.getElementById('threatsCount').textContent = data.threats || 0;
  });
}

function showLogin() {
  document.getElementById('loginSection').style.display = 'block';
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('logoutBtn').style.display = 'none';
}

chrome.runtime.sendMessage({ action: 'getUser' }, function(response) {
  if (response && response.email) {
    showDashboard(response.email);
  }
});

document.getElementById('loginBtn').addEventListener('click', async function() {
  var email = document.getElementById('emailInput').value.trim();
  if (!email || !email.includes('@')) {
    showMsg('Please enter a valid email.', '#ff2d78');
    return;
  }
  showMsg('Connecting...', '#6b7280');
  try {
    var endpoint = isLoginMode ? '/tokens' : '/register';
    var response = await fetch(API_URL + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    });
    var data = await response.json();
    if (isLoginMode) {
      if (data.tokens !== undefined) {
        chrome.runtime.sendMessage({ action: 'setUser', email: email });
        showDashboard(email);
      } else {
        showMsg('Email not found. Please register first.', '#ff2d78');
      }
    } else {
      if (data.success) {
        chrome.runtime.sendMessage({ action: 'setUser', email: email });
        showDashboard(email);
      } else {
        showMsg(data.error || 'Something went wrong.', '#ff2d78');
      }
    }
  } catch(e) {
    showMsg('Connection error. Please try again.', '#ff2d78');
  }
});

document.getElementById('logoutBtn').addEventListener('click', function() {
  chrome.runtime.sendMessage({ action: 'logout' });
  showLogin();
});
