let form, sessionPanel, sessionList, statusBanner, logoutBtn;
let cachedSessions = [];
let emailEntered = false;

function initializeElements() {
  form = document.getElementById('loginForm');
  sessionPanel = document.getElementById('sessionPanel');
  sessionList = document.getElementById('sessionList');
  statusBanner = document.getElementById('statusBanner');
  logoutBtn = document.getElementById('logoutBtn');
}

function setStatus(message, type = 'info') {
  if (!statusBanner) {
    console.error('Status banner not found');
    return;
  }
  statusBanner.textContent = message;
  statusBanner.className = `status-banner ${type}`;
  statusBanner.style.display = 'flex'; // Show banner when status is set
}

function renderSessions(sessions) {
  sessionList.innerHTML = '';
  sessions.forEach((session) => {
    const node = document.createElement('div');
    node.className = 'session-item';

    const title = document.createElement('h3');
    title.textContent = session.name;

    const meta = document.createElement('p');
    meta.textContent = session.domain?.baseUrl || 'DAT';

    const launchBtn = document.createElement('button');
    launchBtn.className = 'btn-primary';
    launchBtn.textContent = 'Launch DAT';
    launchBtn.addEventListener('click', async () => {
      try {
        await window.dslb.launchSession(session.id, session.domain?.baseUrl);
      } catch (error) {
        setStatus(error.message || 'Failed to launch DAT', 'error');
      }
    });

    node.appendChild(title);
    node.appendChild(meta);
    node.appendChild(launchBtn);
    sessionList.appendChild(node);
  });
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  initializeElements();
  
  if (!form || !sessionPanel || !sessionList || !statusBanner || !logoutBtn) {
    console.error('Required DOM elements not found');
    return;
  }

  const emailInput = document.getElementById('email');
  const passwordGroup = document.getElementById('passwordGroup');
  const passwordInput = document.getElementById('password');
  const continueBtn = document.querySelector('.btn-continue');

  // Track login state to prevent multiple simultaneous logins
  let isLoggingIn = false;

  // Function to set login button state
  const setLoginButtonState = (enabled, text = null, progressPercent = null) => {
    if (continueBtn) {
      continueBtn.disabled = !enabled;
      continueBtn.style.opacity = enabled ? '1' : '1';
      continueBtn.style.cursor = enabled ? 'pointer' : 'not-allowed';
      
      if (text !== null) {
        // Wrap text in span for z-index positioning
        if (!continueBtn.querySelector('span')) {
          const span = document.createElement('span');
          continueBtn.appendChild(span);
        }
        continueBtn.querySelector('span').textContent = text;
      }
      
      // Set progress bar
      if (progressPercent !== null) {
        continueBtn.classList.add('progress-active');
        continueBtn.style.setProperty('--progress-percent', `${progressPercent}%`);
      } else {
        continueBtn.classList.remove('progress-active');
        continueBtn.style.setProperty('--progress-percent', '0%');
      }
    }
  };

  // Initialize button with span wrapper
  if (continueBtn && !continueBtn.querySelector('span')) {
    const span = document.createElement('span');
    span.textContent = continueBtn.textContent || 'CONTINUE';
    continueBtn.textContent = '';
    continueBtn.appendChild(span);
  }

  // Handle email input - show password field when email is entered
  emailInput.addEventListener('blur', () => {
    if (emailInput.value.trim() && !emailEntered && !isLoggingIn) {
      emailEntered = true;
      passwordGroup.style.display = 'flex';
      setLoginButtonState(true, 'LOG IN', null);
      passwordInput.focus();
    }
  });
  
  // Handle Enter key on email input
  emailInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && emailInput.value.trim() && !emailEntered && !isLoggingIn) {
      event.preventDefault();
      emailEntered = true;
      passwordGroup.style.display = 'flex';
      setLoginButtonState(true, 'LOG IN', null);
      passwordInput.focus();
    }
  });

  // Handle form submission
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    // Prevent multiple simultaneous login attempts
    if (isLoggingIn) {
      console.log('Login already in progress, ignoring duplicate request');
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email) {
      setStatus('Email address is required.', 'warning');
      return;
    }

    if (!emailEntered) {
      // First step - just email validation, show password field
      emailEntered = true;
      passwordGroup.style.display = 'flex';
      setLoginButtonState(true, 'LOG IN', null);
      passwordInput.focus();
      return;
    }

    if (!password) {
      setStatus('Password is required.', 'warning');
      return;
    }

    // Set login in progress state
    isLoggingIn = true;
    
    // Track login stages and timing
    const loginStartTime = Date.now();
    const stages = [
      { name: 'Connecting...', percent: 10 },
      { name: 'Authenticating...', percent: 30 }
    ];
    
    let currentStage = 0;
    let progressInterval = null;
    
    // Update progress
    const updateProgress = (stageIndex, message = null) => {
      if (stageIndex < stages.length) {
        const stage = stages[stageIndex];
        setLoginButtonState(false, message || stage.name, stage.percent);
        currentStage = stageIndex;
      }
    };
    
    // Start progress timer
    progressInterval = setInterval(() => {
      // Auto-advance progress if stuck (smooth animation)
      if (currentStage < stages.length - 1) {
        const elapsed = Math.floor((Date.now() - loginStartTime) / 1000);
        const expectedStage = Math.min(Math.floor(elapsed / 2), stages.length - 1);
        if (expectedStage > currentStage) {
          updateProgress(expectedStage);
        }
      }
    }, 500);

    try {
      // Stage 1: Connecting
      updateProgress(0, 'Connecting...');
      setStatus('Connecting...');
      
      // Stage 2: Authenticating
      setTimeout(() => updateProgress(1, 'Authenticating...'), 500);
      
      const result = await window.dslb.login(email, password);
      
      // Clear progress interval - download progress will update button with "Loading DAT Workspace (%)"
      clearInterval(progressInterval);
      
      cachedSessions = result.sessions || [];
      
      // Download progress will automatically update button to "Loading DAT Workspace (%)"
      
      // Start session validation
      startSessionValidation();

      // Keep login form visible - don't show session panel
      // The download progress will update the button automatically
      // Once DAT window opens, the login window will be hidden by main process
      
      if (!cachedSessions.length) {
        sessionList.innerHTML = '<p>No DAT assigned to this account yet.</p>';
      } else {
        const session = cachedSessions[0];
        const userRole = result.user?.role || result.user?.userRole;
        
        // Debug: Log user role to see what we're getting
        console.log('User role from login:', userRole, 'Full user object:', result.user);
        
        // Check if this is super admin setup or regular user
        if (session.status === 'PENDING') {
          // If super admin, show setup message
          if (userRole === 'SUPER_ADMIN' || userRole === 'superadmin' || result.user?.email?.includes('superadmin')) {
            sessionList.innerHTML = `
              <div class="session-item">
                <h3>${session.name}</h3>
                <p>Preparing DAT workspace...</p>
                <div class="status-info">
                  <p>🔧 Setting up shared DAT for all users</p>
                  <p>🔗 DAT will open automatically</p>
                </div>
              </div>
            `;
          } else {
            // For normal users, show simple contact provider message
            // Hide the login form completely
            const loginForm = document.querySelector('.login-form');
            if (loginForm) loginForm.style.display = 'none';
            
            // Hide the heading, subtitle, and buttons
            const heading = sessionPanel.querySelector('h2');
            const subtitle = sessionPanel.querySelector('p');
            const buttonGroup = sessionPanel.querySelector('.button-group');
            if (heading) heading.style.display = 'none';
            if (subtitle) subtitle.style.display = 'none';
            if (buttonGroup) buttonGroup.style.display = 'none';
            
            sessionList.innerHTML = `
              <div class="session-item" style="text-align: center; padding: 60px 40px;">
                <p style="font-size: 18px; color: #333; margin: 0;">📞 Please contact your service provider for access</p>
              </div>
            `;
          }
        } else {
          // Regular user or super admin after setup - session is READY
          sessionList.innerHTML = `
            <div class="session-item">
              <h3>${session.name}</h3>
              <p>Loading DAT Loadboard (estimated 30-60 seconds)</p>
              <div class="status-info">
                <p>✅ DAT will open automatically</p>
                <p>🔗 You'll be logged in using the master account</p>
              </div>
            </div>
          `;
        }
      }
    } catch (error) {
      // Clear progress interval
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      
      // Check if error is a launch error (user is still logged in)
      if (error.message && (error.message.includes('Failed to launch') || error.message.includes('DAT workspace'))) {
        // Launch failed but user is still logged in - show error but don't logout
        console.error('Launch failed:', error.message);
        setStatus(`Failed to launch DAT workspace: ${error.message}. Please try again or contact support.`, 'error');
        setLoginButtonState(true, 'CONTINUE', null);
        isLoggingIn = false;
        // Don't show login form - user stays logged in, can retry
        return;
      }
      
      // Authentication error - show login form again
      console.error('Login failed:', error.message);
      const errorMessage = error.message || 'Connection failed. Please check your credentials and try again.';
      
      // Only show specific error messages for authentication failures
      if (error.message && (error.message.includes('Invalid') || error.message.includes('credentials'))) {
        setStatus('Invalid email or password', 'error');
      } else {
        setStatus(errorMessage, 'error');
      }
      
      // Re-enable login button on error
      isLoggingIn = false;
      const buttonText = continueBtn.querySelector('span')?.textContent || continueBtn.textContent;
      setLoginButtonState(true, buttonText === 'LOG IN' ? 'LOG IN' : 'CONTINUE', null);
    } finally {
      // Ensure button is re-enabled even if something unexpected happens
      // (though it should be hidden by form.style.display = 'none' on success)
      if (form.style.display !== 'none') {
        isLoggingIn = false;
      }
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await window.dslb.logout();
    cachedSessions = [];
    sessionPanel.classList.add('hidden');
    form.style.display = 'flex';
    form.reset();
    emailEntered = false;
    passwordGroup.style.display = 'none';
    isLoggingIn = false; // Reset login state
    setLoginButtonState(true, 'CONTINUE', null);
    setStatus('Signed out.', 'info');
  });

  window.dslb.onStatus((payload) => {
    if (!payload) return;
    
    // Handle download progress - show "Loading DAT Workspace (%)" format
    if (payload.type === 'download' && payload.percent !== undefined) {
      // Update login button with "Loading DAT Workspace (%)" format
      setLoginButtonState(false, `Loading DAT Workspace (${payload.percent}%)`, payload.percent);
      return;
    }
    
    // Handle other status messages
    setStatus(payload.message || 'Ready.', payload.type || 'info');
  });

  // Periodic session validation to detect if user was logged out from another device
  let sessionValidationInterval = null;
  
  // Start session validation after successful login
  const startSessionValidation = () => {
    if (sessionValidationInterval) {
      clearInterval(sessionValidationInterval);
    }
    
    // Track consecutive validation failures to avoid false positives
    let consecutiveFailures = 0;
    const MAX_FAILURES = 3; // Require 3 consecutive failures before logout
    
    sessionValidationInterval = setInterval(async () => {
      try {
        const result = await window.dslb.validateSession();
        
        if (!result.valid) {
          consecutiveFailures++;
          console.log(`🔒 Session validation failed (${consecutiveFailures}/${MAX_FAILURES}):`, result.reason);
          
          // If explicitly logged out from another device, logout immediately (don't wait for 3 failures)
          if (result.reason === 'logged_out_from_another_device') {
            console.log('🔒 Session invalidated from another device - logging out immediately');
            clearInterval(sessionValidationInterval);
            sessionValidationInterval = null;
            
            setStatus('Signed out due to another device logged into same account. Please logout from there and login again.', 'warning');
            
            // Force logout IMMEDIATELY
            await window.dslb.logout('logged_out_from_another_device');
            cachedSessions = [];
            sessionPanel.classList.add('hidden');
            form.style.display = 'flex';
            form.reset();
            emailEntered = false;
            passwordGroup.style.display = 'none';
            isLoggingIn = false; // Reset login state
            setLoginButtonState(true, 'CONTINUE', null);
            return; // Exit immediately
          }
          
          // Only logout if we have multiple consecutive failures AND it's a real session invalidation
          // This prevents false positives from temporary network issues
          if (consecutiveFailures >= MAX_FAILURES) {
            // Session is no longer valid - force logout
            console.log('🔒 Session invalidated after multiple failures:', result.reason);
            clearInterval(sessionValidationInterval);
            sessionValidationInterval = null;
            
            // Show appropriate message
            if (result.reason === 'logged_out_from_another_device') {
              setStatus('Signed out due to another device logged into same account. Please logout from there and login again.', 'warning');
            } else {
              setStatus('Your session has expired. Please log in again.', 'warning');
            }
            
            // Force logout IMMEDIATELY to close DAT window
            await window.dslb.logout(result.reason === 'logged_out_from_another_device' ? 'logged_out_from_another_device' : undefined);
            cachedSessions = [];
            sessionPanel.classList.add('hidden');
            form.style.display = 'flex';
            form.reset();
            emailEntered = false;
            passwordGroup.style.display = 'none';
            isLoggingIn = false; // Reset login state
            setLoginButtonState(true, 'CONTINUE', null);
          } else {
            // Log but don't logout yet - might be temporary network issue
            console.log(`⚠️ Session validation failed but not logging out yet (${consecutiveFailures}/${MAX_FAILURES})`);
          }
        } else {
          // Session is valid - reset failure counter
          if (consecutiveFailures > 0) {
            console.log('✅ Session validation successful - resetting failure counter');
            consecutiveFailures = 0;
          }
        }
      } catch (error) {
        consecutiveFailures++;
        console.error(`Session validation error (${consecutiveFailures}/${MAX_FAILURES}):`, error);
        
        // Only logout if we have multiple consecutive failures
        if (consecutiveFailures >= MAX_FAILURES) {
          console.error('❌ Too many consecutive validation failures - logging out');
          clearInterval(sessionValidationInterval);
          sessionValidationInterval = null;
          
          setStatus('Connection error. Please log in again.', 'error');
          
          // Force logout
          try {
            await window.dslb.logout();
          } catch (logoutError) {
            console.error('Error during logout:', logoutError);
          }
          
          cachedSessions = [];
          sessionPanel.classList.add('hidden');
          form.style.display = 'flex';
          form.reset();
          emailEntered = false;
          passwordGroup.style.display = 'none';
          isLoggingIn = false; // Reset login state
          setLoginButtonState(true, 'CONTINUE', null);
          setStatus('Your session has expired. Please log in again.', 'warning');
        }
        // Don't force logout on single validation errors (might be network issue)
      }
    }, 5000); // Check every 5 seconds (faster detection of logout from another device)
  };
  
  // Override the login success to start validation
  const originalFormSubmit = form.addEventListener;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email) {
      setStatus('Email address is required.', 'warning');
      return;
    }

    if (!emailEntered) {
      emailEntered = true;
      passwordGroup.style.display = 'flex';
      continueBtn.textContent = 'LOG IN';
      passwordInput.focus();
      return;
    }

    if (!password) {
      setStatus('Password is required.', 'warning');
      return;
    }

    try {
      setStatus('Connecting...');
      const result = await window.dslb.login(email, password);
      cachedSessions = result.sessions || [];
      
      // Start session validation
      startSessionValidation();

      // Keep login form visible - don't hide it
      // The download progress will update the button automatically
      // Once DAT window opens, the login window will be hidden by main process
      // form.style.display = 'none'; // REMOVED - keep login form visible
      // sessionPanel.classList.remove('hidden'); // REMOVED - keep login screen visible
      
      if (!cachedSessions.length) {
        sessionList.innerHTML = '<p>No DAT assigned to this account yet.</p>';
      } else {
        const session = cachedSessions[0];
        const userRole = result.user?.role || result.user?.userRole;
        
        // Check if this is super admin setup or regular user
        if (session.status === 'PENDING') {
          // If super admin, show setup message
          if (userRole === 'SUPER_ADMIN' || userRole === 'superadmin' || result.user?.email?.includes('superadmin')) {
            sessionList.innerHTML = `
              <div class="session-item">
                <h3>${session.name}</h3>
                <p>Preparing DAT workspace...</p>
                <div class="status-info">
                  <p>🔧 Setting up shared DAT for all users</p>
                  <p>🔗 DAT will open automatically</p>
                </div>
              </div>
            `;
          } else {
            // For normal users, show simple contact provider message
            // Hide the login form completely
            const loginForm = document.querySelector('.login-form');
            if (loginForm) loginForm.style.display = 'none';
            
            // Hide the heading, subtitle, and buttons
            const heading = sessionPanel.querySelector('h2');
            const subtitle = sessionPanel.querySelector('p');
            const buttonGroup = sessionPanel.querySelector('.button-group');
            if (heading) heading.style.display = 'none';
            if (subtitle) subtitle.style.display = 'none';
            if (buttonGroup) buttonGroup.style.display = 'none';
            
            sessionList.innerHTML = `
              <div class="session-item" style="text-align: center; padding: 60px 40px;">
                <p style="font-size: 18px; color: #333; margin: 0;">📞 Please contact your service provider for access</p>
              </div>
            `;
          }
        } else {
          sessionList.innerHTML = `
            <div class="session-item">
              <h3>${session.name}</h3>
              <p>Loading DAT Loadboard (estimated 30-60 seconds)</p>
              <div class="status-info">
                <p>✅ DAT will open automatically</p>
                <p>🔗 You'll be logged in using the master account</p>
              </div>
            </div>
          `;
        }
      }
    } catch (error) {
      if (error.message && (error.message.includes('Invalid') || error.message.includes('credentials'))) {
        setStatus('Invalid email or password', 'error');
      } else {
        setStatus('Connection failed. Please try again.', 'error');
      }
    }
  }, true); // Use capture phase
  
  // Stop validation on logout
  const originalLogout = logoutBtn.addEventListener;
  logoutBtn.addEventListener('click', async () => {
    if (sessionValidationInterval) {
      clearInterval(sessionValidationInterval);
      sessionValidationInterval = null;
    }
    
    await window.dslb.logout();
    cachedSessions = [];
    sessionPanel.classList.add('hidden');
    form.style.display = 'flex';
    form.reset();
    emailEntered = false;
    passwordGroup.style.display = 'none';
    continueBtn.textContent = 'CONTINUE';
    setStatus('Signed out.', 'info');
  }, true); // Use capture phase
});
