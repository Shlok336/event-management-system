const API_BASE = 'http://localhost:8000';
let currentToken = null;
let currentUser = null;
let scannerActive = false;
let videoStream = null;
let scanAnimation = null;

// ========================
// INITIALIZATION
// ========================

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Check for saved token
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
        currentToken = savedToken;
        checkAuthStatus();
    }
    
    // Setup event listeners
    setupEventListeners();
    
    // Load initial data
    loadInitialData();
}

function setupEventListeners() {
  // Auth forms
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const createEventForm = document.getElementById('createEventForm');
  
  if (loginForm) loginForm.addEventListener('submit', (e) => { e.preventDefault(); login(); });
  if (registerForm) registerForm.addEventListener('submit', (e) => { e.preventDefault(); register(); });
  if (adminLoginForm) adminLoginForm.addEventListener('submit', (e) => { e.preventDefault(); adminLogin(); });
  if (createEventForm) createEventForm.addEventListener('submit', (e) => { e.preventDefault(); createEvent(); });
  
  // Navigation - Main tabs
  document.addEventListener('click', function(e) {
      if (e.target.classList.contains('nav-tab')) {
          e.preventDefault();
          e.stopPropagation();
          
          // Check if it's a main navigation tab
          const tabName = e.target.dataset.tab;
          if (tabName) {
              showTab(tabName);
          }
      }
  });
  
  // Admin panel navigation - Prevent any link behavior
  document.addEventListener('click', function(e) {
      // Prevent default for any links in admin panel
      if (e.target.closest('#admin-panel') && e.target.tagName === 'A') {
          e.preventDefault();
          e.stopPropagation();
          return false;
      }
      
      // Handle admin section buttons specifically
      if (e.target.closest('#admin-panel') && e.target.classList.contains('nav-tab')) {
          e.preventDefault();
          e.stopPropagation();
          
          // Map button text to section names
          const buttonText = e.target.textContent.trim();
          const sectionMap = {
              '📷 QR Scanner': 'qr-scanner',
              '📋 All Registrations': 'all-registrations',
              '➕ Create Event': 'create-event'
          };
          
          const sectionName = sectionMap[buttonText];
          if (sectionName) {
              showAdminSection(sectionName, e);
          }
      }
  });
  
  // Additional safety: Prevent all hash links from navigating
  document.addEventListener('click', function(e) {
      if (e.target.tagName === 'A' && e.target.getAttribute('href') === '#') {
          e.preventDefault();
          e.stopPropagation();
      }
  });
}

function loadInitialData() {
    if (currentToken) {
        checkAuthStatus();
    } else {
        showTab('auth');
    }
}

// ========================
// UI MANAGEMENT
// ========================

function showTab(tabName) {
    console.log('Showing tab:', tabName);
    
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab and activate button
    const targetTab = document.getElementById(tabName);
    if (targetTab) {
        targetTab.classList.remove('hidden');
    }
    
    const targetButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (targetButton) {
        targetButton.classList.add('active');
    }
    
    // Load tab-specific data
    switch(tabName) {
        case 'events':
            loadEvents();
            break;
        case 'my-registrations':
            loadMyRegistrations();
            break;
        case 'qr-scanner':
            initializeScanner();
            break;
        case 'all-registrations':
            loadAllRegistrations();
            break;
        case 'create-event':
            // Nothing to load for create event form
            break;
    }
}

function showLoading(containerId, message = 'Loading...') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>${message}</p>
            </div>
        `;
    }
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <strong>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'} ${message}</strong>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 5000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

// ========================
// AUTHENTICATION
// ========================

async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const button = document.querySelector('#loginForm button');

    if (!email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    try {
        button.disabled = true;
        button.innerHTML = '<div class="loading-spinner" style="width: 20px; height: 20px; margin-right: 8px;"></div> Logging in...';

        const response = await fetch(`${API_BASE}/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
        });

        if (response.ok) {
            const data = await response.json();
            currentToken = data.access_token;
            localStorage.setItem('authToken', currentToken);
            showToast('Login successful!', 'success');
            await checkAuthStatus();
        } else {
            const error = await response.json();
            showToast(error.detail || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Network error. Please try again.', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = 'Login to Account';
        }
    }
}

async function adminLogin() {
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    const button = document.querySelector('#adminLoginForm button');

    if (!email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    try {
        button.disabled = true;
        button.innerHTML = '<div class="loading-spinner" style="width: 20px; height: 20px; margin-right: 8px;"></div> Logging in...';

        const response = await fetch(`${API_BASE}/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
        });

        if (response.ok) {
            const data = await response.json();
            currentToken = data.access_token;
            localStorage.setItem('authToken', currentToken);
            showToast('Admin login successful!', 'success');
            checkAdminAccess();
        } else {
            showToast('Invalid admin credentials', 'error');
        }
    } catch (error) {
        console.error('Admin login error:', error);
        showToast('Network error. Please try again.', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = 'Login as Admin';
        }
    }
}

async function register() {
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const button = document.querySelector('#registerForm button');

    if (!name || !email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    try {
        button.disabled = true;
        button.innerHTML = '<div class="loading-spinner" style="width: 20px; height: 20px; margin-right: 8px;"></div> Creating account...';

        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                full_name: name,
                password: password
            })
        });

        if (response.ok) {
            showToast('Registration successful! Please login.', 'success');
            document.getElementById('registerForm').reset();
            showTab('auth');
            // Switch to login tab within auth section
            document.querySelectorAll('#auth .nav-tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('#auth .tab-content').forEach(content => content.classList.add('hidden'));
            document.querySelector('[data-tab="login"]').classList.add('active');
            document.getElementById('login').classList.remove('hidden');
        } else {
            const error = await response.json();
            showToast(error.detail, 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Network error. Please try again.', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = 'Create Account';
        }
    }
}

async function checkAuthStatus() {
    try {
        // Try to access user endpoint to verify token
        const response = await fetch(`${API_BASE}/my-registrations`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });

        if (response.ok) {
            await checkAdminStatus();
        } else {
            logout();
        }
    } catch (error) {
        console.error('Auth check error:', error);
        logout();
    }
}

async function checkAdminStatus() {
    try {
        const response = await fetch(`${API_BASE}/admin/registrations`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            currentUser = { is_admin: true, email: 'Admin' };
            showAdminInterface();
        } else {
            currentUser = { is_admin: false };
            showUserInterface();
        }
    } catch (error) {
        currentUser = { is_admin: false };
        showUserInterface();
    }
}

async function checkAdminAccess() {
    try {
        const response = await fetch(`${API_BASE}/admin/registrations`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            document.getElementById('admin-login').classList.add('hidden');
            document.getElementById('admin-panel').classList.remove('hidden');
            loadAllRegistrations();
            showToast('Admin access granted', 'success');
        } else {
            showToast('Admin privileges required', 'error');
            logout();
        }
    } catch (error) {
        console.error('Admin check error:', error);
        showToast('Error verifying admin access', 'error');
    }
}

function showUserInterface() {
    // Show user tabs and hide auth/admin
    document.getElementById('auth').classList.add('hidden');
    document.getElementById('admin').classList.add('hidden');
    
    // Enable user tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        if (tab.dataset.tab !== 'auth' && tab.dataset.tab !== 'admin') {
            tab.style.display = 'flex';
        }
    });
    
    // Load user data
    loadEvents();
    showTab('events');
}

function showAdminInterface() {
    // Show admin panel and hide auth/user content
    document.getElementById('auth').classList.add('hidden');
    
    // Enable all tabs including admin
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.style.display = 'flex';
    });
    
    showTab('admin');
}

function logout() {
    currentToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    
    // Reset UI to auth state
    document.getElementById('auth').classList.remove('hidden');
    document.getElementById('admin-login').classList.remove('hidden');
    document.getElementById('admin-panel').classList.add('hidden');
    
    // Hide non-auth tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        if (tab.dataset.tab !== 'auth') {
            tab.style.display = 'none';
        }
    });
    
    // Reset forms
    document.getElementById('loginForm')?.reset();
    document.getElementById('registerForm')?.reset();
    document.getElementById('adminLoginForm')?.reset();
    
    // Stop scanner if active
    stopScanner();
    
    // Show auth tab
    showTab('auth');
    
    showToast('Logged out successfully', 'success');
}

// ========================
// EVENTS & REGISTRATIONS
// ========================

async function loadEvents() {
    const eventsList = document.getElementById('events-list');
    if (!eventsList) return;
    
    showLoading('events-list', 'Loading events...');
    
    try {
        const response = await fetch(`${API_BASE}/events`);
        if (!response.ok) {
            throw new Error('Failed to fetch events');
        }
        const events = await response.json();
        
        eventsList.innerHTML = '';
        
        if (events.length === 0) {
            eventsList.innerHTML = `
                <div class="card text-center">
                    <h3>No Events Available</h3>
                    <p class="mt-3">Check back later for upcoming events.</p>
                </div>
            `;
            return;
        }
        
        events.forEach(event => {
            const eventCard = createEventCard(event);
            eventsList.appendChild(eventCard);
        });
    } catch (error) {
        console.error('Error loading events:', error);
        eventsList.innerHTML = `
            <div class="card text-center">
                <h3>Error Loading Events</h3>
                <p>Please try again later.</p>
                <button class="btn btn-secondary mt-3" onclick="loadEvents()">Retry</button>
            </div>
        `;
    }
}

function createEventCard(event) {
    const card = document.createElement('div');
    card.className = 'event-card fade-in';
    card.innerHTML = `
        <div class="event-header">
            <h3 class="event-title">${event.title}</h3>
            <div class="event-date">${new Date(event.date).toLocaleDateString()}</div>
        </div>
        <div class="event-description">${event.description || 'No description available.'}</div>
        <div class="event-details">
            <div class="detail-item">
                <span class="detail-icon">📅</span>
                <span>${new Date(event.date).toLocaleString()}</span>
            </div>
            <div class="detail-item">
                <span class="detail-icon">📍</span>
                <span>${event.location || 'TBA'}</span>
            </div>
            ${event.max_attendees ? `
            <div class="detail-item">
                <span class="detail-icon">👥</span>
                <span>Max: ${event.max_attendees}</span>
            </div>
            ` : ''}
        </div>
        <button class="btn btn-primary" onclick="registerForEvent(${event.id})" 
                ${!currentToken ? 'disabled' : ''}>
            ${!currentToken ? 'Login to Register' : 'Register Now'}
        </button>
    `;
    return card;
}

async function registerForEvent(eventId) {
    if (!currentToken) {
        showToast('Please login to register for events', 'error');
        showTab('auth');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/registrations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ event_id: eventId })
        });

        if (response.ok) {
            showToast('Registration successful! QR code sent to your email.', 'success');
            // Refresh events to show updated state
            loadEvents();
            // Load user registrations
            loadMyRegistrations();
        } else {
            const error = await response.json();
            showToast(error.detail, 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Registration failed. Please try again.', 'error');
    }
}

async function loadMyRegistrations() {
    if (!currentToken) return;
    
    const registrationsList = document.getElementById('registrations-list');
    if (!registrationsList) return;
    
    showLoading('registrations-list', 'Loading your registrations...');
    
    try {
        const response = await fetch(`${API_BASE}/my-registrations`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            const registrations = await response.json();
            displayRegistrations(registrations, 'registrations-list');
        } else {
            throw new Error('Failed to fetch registrations');
        }
    } catch (error) {
        console.error('Error loading registrations:', error);
        registrationsList.innerHTML = `
            <div class="card text-center">
                <h3>Error Loading Registrations</h3>
                <p>Please try again later.</p>
                <button class="btn btn-secondary mt-3" onclick="loadMyRegistrations()">Retry</button>
            </div>
        `;
    }
}

async function loadAllRegistrations() {
    if (!currentToken) return;
    
    const allRegistrationsList = document.getElementById('all-registrations-list');
    if (!allRegistrationsList) return;
    
    showLoading('all-registrations-list', 'Loading all registrations...');
    
    try {
        const response = await fetch(`${API_BASE}/admin/registrations`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            const registrations = await response.json();
            displayRegistrations(registrations, 'all-registrations-list', true);
        } else {
            throw new Error('Failed to fetch all registrations');
        }
    } catch (error) {
        console.error('Error loading all registrations:', error);
        allRegistrationsList.innerHTML = `
            <div class="card text-center">
                <h3>Error Loading Registrations</h3>
                <p>Please try again later.</p>
                <button class="btn btn-secondary mt-3" onclick="loadAllRegistrations()">Retry</button>
            </div>
        `;
    }
}

function displayRegistrations(registrations, containerId, showUserInfo = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (registrations.length === 0) {
        container.innerHTML = `
            <div class="card text-center">
                <h3>No Registrations Found</h3>
                <p class="mt-3">${showUserInfo ? 'No one has registered for events yet.' : 'You have not registered for any events yet.'}</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    registrations.forEach(reg => {
        const regCard = document.createElement('div');
        regCard.className = 'registration-card fade-in';
        regCard.innerHTML = `
            <div class="registration-header">
                <h4>${reg.event.title}</h4>
                <span class="status-badge ${reg.is_verified ? 'status-verified' : 'status-pending'}">
                    ${reg.is_verified ? '✓ Verified' : '⏳ Pending'}
                </span>
            </div>
            <div class="registration-details">
                ${showUserInfo ? `<p><strong>User:</strong> ${reg.user.full_name} (${reg.user.email})</p>` : ''}
                <p><strong>Registered:</strong> ${new Date(reg.registration_date).toLocaleString()}</p>
                ${reg.verification_date ? 
                    `<p><strong>Verified:</strong> ${new Date(reg.verification_date).toLocaleString()}</p>` : 
                    ''
                }
            </div>
            ${reg.qr_code_image ? `
                <div class="qr-section">
                    <p><strong>QR Code:</strong></p>
                    <img class="qr-code" src="data:image/png;base64,${reg.qr_code_image}" alt="QR Code">
                    ${showUserInfo ? `<p class="text-center"><small>QR Data: ${reg.qr_code_data}</small></p>` : ''}
                </div>
            ` : ''}
        `;
        container.appendChild(regCard);
    });
}

// ========================
// CREATE EVENT (ADMIN ONLY)
// ========================

async function createEvent() {
    const title = document.getElementById('eventTitle').value;
    const description = document.getElementById('eventDescription').value;
    const date = document.getElementById('eventDate').value;
    const location = document.getElementById('eventLocation').value;
    const maxAttendees = document.getElementById('eventMaxAttendees').value;
    const button = document.querySelector('#createEventForm button');

    if (!title || !date) {
        showToast('Please fill in required fields (Title and Date)', 'error');
        return;
    }

    try {
        button.disabled = true;
        button.innerHTML = '<div class="loading-spinner" style="width: 20px; height: 20px; margin-right: 8px;"></div> Creating Event...';

        const eventData = {
            title: title,
            description: description,
            date: date,
            location: location,
            max_attendees: maxAttendees ? parseInt(maxAttendees) : null
        };

        const response = await fetch(`${API_BASE}/events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify(eventData)
        });

        if (response.ok) {
            showToast('Event created successfully!', 'success');
            document.getElementById('createEventForm').reset();
            // Refresh events list
            loadEvents();
        } else {
            const error = await response.json();
            showToast('Event creation failed: ' + error.detail, 'error');
        }
    } catch (error) {
        console.error('Event creation error:', error);
        showToast('Event creation failed. Please try again.', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = 'Create Event';
        }
    }
}

// ========================
// QR SCANNER (ADMIN ONLY)
// ========================

function initializeScanner() {
    const scannerStatus = document.getElementById('scanner-status');
    if (scannerStatus) {
        scannerStatus.className = 'scanner-status scanner-inactive';
        scannerStatus.innerHTML = '🟡 Scanner Ready - Click "Start Scanner" to begin';
    }
    
    // Clear previous results
    document.getElementById('verification-result').innerHTML = '';
}

async function startScanner() {
    try {
        const video = document.getElementById('qr-video');
        const startBtn = document.getElementById('start-scanner');
        const stopBtn = document.getElementById('stop-scanner');
        const scannerStatus = document.getElementById('scanner-status');
        
        // Request camera access
        videoStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        
        video.srcObject = videoStream;
        scannerActive = true;
        
        // Update UI
        startBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
        
        if (scannerStatus) {
            scannerStatus.className = 'scanner-status scanner-active';
            scannerStatus.innerHTML = '🟢 Scanner Active - Point camera at QR code';
        }
        
        // Create scanning overlay
        createScanningOverlay();
        
        // Start QR code detection
        scanQRCode();
        
        showToast('QR Scanner started successfully', 'success');
        
    } catch (error) {
        console.error('Error starting scanner:', error);
        showToast('Error accessing camera: ' + error.message, 'error');
    }
}

function createScanningOverlay() {
    const scannerContainer = document.querySelector('.scanner-overlay');
    if (!scannerContainer) return;
    
    // Remove existing frame
    const existingFrame = scannerContainer.querySelector('.scanner-frame');
    if (existingFrame) existingFrame.remove();
    
    // Create new frame
    const frame = document.createElement('div');
    frame.className = 'scanner-frame';
    scannerContainer.appendChild(frame);
}

function stopScanner() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    
    scannerActive = false;
    
    const video = document.getElementById('qr-video');
    const startBtn = document.getElementById('start-scanner');
    const stopBtn = document.getElementById('stop-scanner');
    const scannerStatus = document.getElementById('scanner-status');
    
    if (video) video.srcObject = null;
    if (startBtn) startBtn.classList.remove('hidden');
    if (stopBtn) stopBtn.classList.add('hidden');
    
    if (scannerStatus) {
        scannerStatus.className = 'scanner-status scanner-inactive';
        scannerStatus.innerHTML = '🟡 Scanner Stopped - Click "Start Scanner" to begin';
    }
    
    // Remove scanning overlay
    const frame = document.querySelector('.scanner-frame');
    if (frame) frame.remove();
    
    document.getElementById('verification-result').innerHTML = '';
    
    showToast('QR Scanner stopped', 'info');
}

function scanQRCode() {
    if (!scannerActive) return;
    
    const video = document.getElementById('qr-video');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
            // Visual feedback
            flashScannerFrame();
            verifyQRCode(code.data);
            return; // Stop scanning after successful detection
        }
    }
    
    // Continue scanning
    requestAnimationFrame(scanQRCode);
}

function flashScannerFrame() {
    const frame = document.querySelector('.scanner-frame');
    if (frame) {
        frame.style.borderColor = '#4cc9f0';
        frame.style.boxShadow = '0 0 20px #4cc9f0';
        
        setTimeout(() => {
            frame.style.borderColor = '';
            frame.style.boxShadow = '';
        }, 500);
    }
}

async function verifyQRCode(qrData) {
    const resultDiv = document.getElementById('verification-result');
    
    try {
        resultDiv.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Verifying QR code...</p>
            </div>
        `;
        
        const response = await fetch(`${API_BASE}/admin/verify-qr`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ qr_code_data: qrData })
        });
        
        if (response.ok) {
            const result = await response.json();
            resultDiv.className = 'result-container result-success';
            resultDiv.innerHTML = `
                <h3>✅ Verification Successful!</h3>
                <div class="verification-details">
                    <p><strong>User:</strong> ${result.user_name}</p>
                    <p><strong>Event:</strong> ${result.event_title}</p>
                    <p><strong>Verified at:</strong> ${new Date(result.verified_at).toLocaleString()}</p>
                </div>
                <div class="scanner-controls">
                    <button class="btn btn-success" onclick="startScanner()">
                        🎥 Scan Another QR
                    </button>
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.innerHTML=''">
                        Clear Result
                    </button>
                </div>
            `;
            
            // Reload registrations to show updated status
            loadAllRegistrations();
            
        } else {
            const error = await response.json();
            resultDiv.className = 'result-container result-error';
            resultDiv.innerHTML = `
                <h3>❌ Verification Failed</h3>
                <p>${error.detail}</p>
                <div class="scanner-controls">
                    <button class="btn btn-success" onclick="startScanner()">
                        🎥 Try Again
                    </button>
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.innerHTML=''">
                        Clear Result
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Verification error:', error);
        resultDiv.className = 'result-container result-error';
        resultDiv.innerHTML = `
            <h3>❌ Verification Error</h3>
            <p>Network error occurred. Please check your connection.</p>
            <div class="scanner-controls">
                <button class="btn btn-success" onclick="startScanner()">
                    🎥 Try Again
                </button>
                <button class="btn btn-secondary" onclick="this.parentElement.parentElement.innerHTML=''">
                    Clear Result
                </button>
            </div>
        `;
    }
}

// ========================
// GLOBAL FUNCTION EXPORTS
// ========================
function showAdminSection(sectionName, event = null) {
  // Always prevent default behavior
  if (event) {
      event.preventDefault();
      event.stopPropagation();
  }
  
  console.log('Showing admin section:', sectionName);
  
  // Hide all admin sections
  document.querySelectorAll('.admin-section').forEach(section => {
      section.classList.add('hidden');
  });
  
  // Remove active class from all admin nav buttons
  document.querySelectorAll('#admin-panel .nav-tab').forEach(tab => {
      tab.classList.remove('active');
  });
  
  // Show selected section
  const targetSection = document.getElementById(sectionName + '-section');
  if (targetSection) {
      targetSection.classList.remove('hidden');
  }
  
  // Activate the clicked button if we have an event
  if (event && event.target) {
      event.target.classList.add('active');
  }
  
  // Load section-specific data
  switch(sectionName) {
      case 'qr-scanner':
          initializeScanner();
          break;
      case 'all-registrations':
          loadAllRegistrations();
          break;
      case 'create-event':
          const resultDiv = document.getElementById('create-event-result');
          if (resultDiv) resultDiv.innerHTML = '';
          break;
  }
  
  return false; // Additional safety
}

// Enhanced QR Scanner Functions
async function startScanner() {
  try {
      const video = document.getElementById('qr-video');
      const startBtn = document.getElementById('start-scanner');
      const stopBtn = document.getElementById('stop-scanner');
      const scannerStatus = document.getElementById('scanner-status');
      
      // Clear previous stream if any
      if (videoStream) {
          videoStream.getTracks().forEach(track => track.stop());
      }
      
      // Request camera access with better constraints
      videoStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
              facingMode: "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 }
          } 
      });
      
      video.srcObject = videoStream;
      scannerActive = true;
      
      // Wait for video to be ready
      video.onloadedmetadata = () => {
          video.play().catch(e => console.error('Video play error:', e));
      };
      
      // Update UI
      startBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
      
      if (scannerStatus) {
          scannerStatus.className = 'scanner-status scanner-active';
          scannerStatus.innerHTML = '🟢 Scanner Active - Point camera at QR code';
      }
      
      // Create scanning overlay
      createScanningOverlay();
      
      // Start QR code detection
      scanQRCode();
      
      showToast('QR Scanner started successfully', 'success');
      
  } catch (error) {
      console.error('Error starting scanner:', error);
      let errorMessage = 'Error accessing camera: ';
      
      if (error.name === 'NotAllowedError') {
          errorMessage += 'Camera permission denied. Please allow camera access.';
      } else if (error.name === 'NotFoundError') {
          errorMessage += 'No camera found on this device.';
      } else if (error.name === 'NotSupportedError') {
          errorMessage += 'Camera not supported in this browser.';
      } else {
          errorMessage += error.message;
      }
      
      showToast(errorMessage, 'error');
  }
}

function createScanningOverlay() {
  const scannerContainer = document.querySelector('.scanner-overlay');
  if (!scannerContainer) return;
  
  // Remove existing frame
  const existingFrame = scannerContainer.querySelector('.scanner-frame');
  if (existingFrame) existingFrame.remove();
  
  // Create new frame
  const frame = document.createElement('div');
  frame.className = 'scanner-frame';
  scannerContainer.appendChild(frame);
}

// ========================
// ADMIN PANEL FUNCTIONS
// ========================

function showAdminSection(sectionName, event = null) {
  // Prevent default behavior if event is provided
  if (event) {
      event.preventDefault();
      event.stopPropagation();
  }
  
  console.log('Showing admin section:', sectionName);
  
  // Hide all admin sections
  document.querySelectorAll('.admin-section').forEach(section => {
      section.classList.add('hidden');
  });
  
  // Remove active class from all admin nav buttons
  document.querySelectorAll('#admin-panel .nav-tab').forEach(tab => {
      tab.classList.remove('active');
  });
  
  // Show selected section
  const targetSection = document.getElementById(sectionName + '-section');
  if (targetSection) {
      targetSection.classList.remove('hidden');
      console.log('Section shown:', targetSection.id);
  } else {
      console.error('Section not found:', sectionName + '-section');
  }
  
  // Activate the clicked button
  if (event && event.target) {
      event.target.classList.add('active');
  }
  
  // Load section-specific data
  switch(sectionName) {
      case 'qr-scanner':
          initializeScanner();
          break;
      case 'all-registrations':
          loadAllRegistrations();
          break;
      case 'create-event':
          // Clear any previous results
          const resultDiv = document.getElementById('create-event-result');
          if (resultDiv) resultDiv.innerHTML = '';
          break;
  }
  
  // Return false to prevent any default behavior
  return false;
}
function clearEventForm() {
  document.getElementById('createEventForm').reset();
  document.getElementById('create-event-result').innerHTML = '';
  showToast('Form cleared', 'info');
}

// Enhanced create event function
async function createEvent() {
  const title = document.getElementById('eventTitle').value;
  const description = document.getElementById('eventDescription').value;
  const date = document.getElementById('eventDate').value;
  const location = document.getElementById('eventLocation').value;
  const maxAttendees = document.getElementById('eventMaxAttendees').value;
  const button = document.querySelector('#createEventForm button[type="submit"]');
  const resultDiv = document.getElementById('create-event-result');

  if (!title || !date) {
      showToast('Please fill in required fields (Title and Date)', 'error');
      return;
  }

  // Validate date is in the future
  const eventDate = new Date(date);
  const now = new Date();
  if (eventDate <= now) {
      showToast('Event date must be in the future', 'error');
      return;
  }

  try {
      button.disabled = true;
      button.innerHTML = '<div class="loading-spinner" style="width: 20px; height: 20px; margin-right: 8px;"></div> Creating...';

      const eventData = {
          title: title,
          description: description || null,
          date: date,
          location: location || null,
          max_attendees: maxAttendees ? parseInt(maxAttendees) : null
      };

      console.log('Creating event:', eventData);

      const response = await fetch(`${API_BASE}/events`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${currentToken}`
          },
          body: JSON.stringify(eventData)
      });

      if (response.ok) {
          const newEvent = await response.json();
          showToast('Event created successfully!', 'success');
          
          // Show success message
          resultDiv.innerHTML = `
              <div class="result-container result-success">
                  <h4>✅ Event Created Successfully!</h4>
                  <p><strong>Title:</strong> ${newEvent.title}</p>
                  <p><strong>Date:</strong> ${new Date(newEvent.date).toLocaleString()}</p>
                  <p><strong>Location:</strong> ${newEvent.location || 'Not specified'}</p>
                  ${newEvent.max_attendees ? `<p><strong>Max Attendees:</strong> ${newEvent.max_attendees}</p>` : ''}
              </div>
          `;
          
          // Clear form
          document.getElementById('createEventForm').reset();
          
          // Refresh events list
          loadEvents();
          
      } else {
          const error = await response.json();
          resultDiv.innerHTML = `
              <div class="result-container result-error">
                  <h4>❌ Event Creation Failed</h4>
                  <p>${error.detail}</p>
              </div>
          `;
          showToast('Event creation failed: ' + error.detail, 'error');
      }
  } catch (error) {
      console.error('Event creation error:', error);
      resultDiv.innerHTML = `
          <div class="result-container result-error">
              <h4>❌ Network Error</h4>
              <p>Please check your connection and try again.</p>
          </div>
      `;
      showToast('Event creation failed. Please try again.', 'error');
  } finally {
      if (button) {
          button.disabled = false;
          button.innerHTML = '🎉 Create Event';
      }
  }
}

// Update the showAdminInterface function
function showAdminInterface() {
  console.log('Showing admin interface');
  
  // Hide other main tabs
  document.getElementById('auth').classList.add('hidden');
  document.getElementById('events').classList.add('hidden');
  document.getElementById('my-registrations').classList.add('hidden');
  
  // Show admin tab
  document.getElementById('admin').classList.remove('hidden');
  document.getElementById('admin-login').classList.add('hidden');
  document.getElementById('admin-panel').classList.remove('hidden');
  
  // Show admin tabs in main navigation
  document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.style.display = 'flex';
  });
  
  // Initialize the first admin section
  showAdminSection('qr-scanner');
}
function scanQRCode() {
  if (!scannerActive || !videoStream) return;
  
  const video = document.getElementById('qr-video');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (video.videoWidth > 0 && video.videoHeight > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      try {
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          
          if (code) {
              console.log('QR Code detected:', code.data);
              // Visual feedback
              flashScannerFrame();
              verifyQRCode(code.data);
              return; // Stop scanning after successful detection
          }
      } catch (e) {
          console.error('QR scanning error:', e);
      }
  }
  
  // Continue scanning
  if (scannerActive) {
      requestAnimationFrame(scanQRCode);
  }
}

// Update the showAdminInterface function
function showAdminInterface() {
  document.getElementById('auth').classList.add('hidden');
  document.getElementById('admin').classList.remove('hidden');
  document.getElementById('admin-login').classList.add('hidden');
  document.getElementById('admin-panel').classList.remove('hidden');
  
  // Show admin tabs in main navigation
  document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.style.display = 'flex';
  });
  
  // Initialize the first admin section
  showAdminSection('qr-scanner');
}
// Make functions available globally
window.showTab = showTab;
window.login = login;
window.register = register;
window.adminLogin = adminLogin;
window.logout = logout;
window.registerForEvent = registerForEvent;
window.startScanner = startScanner;
window.stopScanner = stopScanner;
window.loadAllRegistrations = loadAllRegistrations;
window.loadMyRegistrations = loadMyRegistrations;
window.loadEvents = loadEvents;
window.createEvent = createEvent;
window.showTab = showTab;
window.showAdminSection = showAdminSection;
window.login = login;
window.register = register;
window.adminLogin = adminLogin;
window.logout = logout;
window.registerForEvent = registerForEvent;
window.startScanner = startScanner;
window.stopScanner = stopScanner;
window.loadAllRegistrations = loadAllRegistrations;
window.loadMyRegistrations = loadMyRegistrations;
window.loadEvents = loadEvents;
window.createEvent = createEvent;
