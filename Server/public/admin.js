const API_BASE = 'http://167.99.147.118:3000/api/v1';
let authToken = localStorage.getItem('authToken');
let currentUser = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    checkServerStatus();
    updateServerTime();
    setInterval(updateServerTime, 1000);
    
    // Hide admin tabs initially
    hideAdminTabs();
    
    // Ensure all modals are hidden on page load
    const modals = ['addPaymentModal', 'setTrialModal', 'setBillingCycleModal', 'paymentHistoryModal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    });
    
    if (authToken) {
        // Try to validate the token and auto-login
        validateTokenAndLogin();
    }
});

async function validateTokenAndLogin() {
    console.log('validateTokenAndLogin called');
    console.log('authToken from localStorage:', localStorage.getItem('authToken'));
    
    if (!authToken) {
        console.log('No auth token found, staying on login page');
        return;
    }
    
    try {
        const data = await apiCall('/auth/me', 'GET', null, false);
        console.log('User data received:', data);
        currentUser = data;
        
        // Check if user has admin access and show admin panel
        if (checkAdminAccess()) {
            console.log('User has admin access, showing admin panel');
            showAdminPanel();
        } else {
            // Token is valid but user doesn't have admin access
            console.log('User does not have admin access, role:', data.role);
            // Don't logout immediately, just show a message
            const loginStatus = document.getElementById('loginStatus');
            if (loginStatus) {
                loginStatus.textContent = 'Access denied: Admin privileges required';
                loginStatus.className = 'login-status error';
                loginStatus.style.display = 'block';
            }
        }
    } catch (error) {
        // Token is invalid or expired, clear it
        console.log('Token validation failed:', error.message);
        console.log('Clearing invalid token and showing login page');
        authToken = null;
        currentUser = null;
        localStorage.removeItem('authToken');
        
        // Show login page without calling logout (to avoid clearing UI state)
        document.getElementById('statusBar').style.display = 'none';
        document.getElementById('tabsContainer').style.display = 'none';
        hideAdminTabs();
        document.getElementById('auth').classList.add('active');
    }
}

function updateServerTime() {
    document.getElementById('serverTime').textContent = new Date().toLocaleTimeString();
}

async function checkServerStatus() {
    try {
        const response = await fetch('http://167.99.147.118:3000/healthz');
        if (response.ok) {
            updateStatus('Server Online', '#28a745');
        } else {
            updateStatus('Server Error', '#dc3545');
        }
    } catch (error) {
        updateStatus('Server Offline', '#dc3545');
    }
}

function updateStatus(text, color) {
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');
    if (statusText) statusText.textContent = text;
    if (statusDot) statusDot.style.background = color;
}

function hideAdminTabs() {
    document.querySelectorAll('.admin-only').forEach(tab => {
        tab.style.display = 'none';
    });
}

function showAdminTabs() {
    document.querySelectorAll('.admin-only').forEach(tab => {
        tab.style.display = 'flex';
    });
}

function checkAdminAccess() {
    if (currentUser && (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN')) {
        showAdminTabs();
        return true;
    } else {
        hideAdminTabs();
        return false;
    }
}

function showTab(tabName) {
    // Don't allow switching to auth tab when logged in
    if (tabName === 'auth' && currentUser) {
        return;
    }
    
    // Check if user is trying to access admin tabs without permission
    if (tabName !== 'auth' && !checkAdminAccess()) {
        showResponse('Access denied: Admin privileges required', true);
        return;
    }
    
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    if (event && event.target) {
        event.target.classList.add('active');
    }
}

function showAdminPanel() {
    // Hide the authentication tab content
    document.getElementById('auth').classList.remove('active');
    
    // Show status bar and tabs
    document.getElementById('statusBar').style.display = 'flex';
    document.getElementById('tabsContainer').style.display = 'flex';
    
    // Show logout button
    document.getElementById('logoutBtn').style.display = 'flex';
    
    // Update status
    updateStatus('Logged In', '#28a745');
    
    // Show admin tabs
    showAdminTabs();
    
    // Switch to users tab by default and load data
    setTimeout(() => {
        showTab('users');
        loadUserData();
    }, 1000);
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    
    // Hide admin panel elements
    document.getElementById('statusBar').style.display = 'none';
    document.getElementById('tabsContainer').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'none';
    hideAdminTabs();
    
    // Show authentication tab again
    document.getElementById('auth').classList.add('active');
    
    // Clear login status
    const loginStatus = document.getElementById('loginStatus');
    loginStatus.style.display = 'none';
    loginStatus.className = 'login-status';
    
    // Clear response area
    showResponse('Logged out successfully');
}

// Notification System
function showNotification(message, type = 'info', duration = 5000) {
    const container = document.getElementById('notificationContainer');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icon = getNotificationIcon(type);
    const id = 'notification-' + Date.now();
    
    notification.innerHTML = `
        <div class="notification-icon">${icon}</div>
        <div class="notification-content">${message}</div>
        <button class="notification-close" onclick="dismissNotification('${id}')">
            <i class="fas fa-times"></i>
        </button>
        <div class="notification-progress"></div>
    `;
    
    notification.id = id;
    container.appendChild(notification);
    
    // Auto-dismiss after duration
    setTimeout(() => {
        dismissNotification(id);
    }, duration);
}

function getNotificationIcon(type) {
    const icons = {
        success: '<i class="fas fa-check-circle"></i>',
        error: '<i class="fas fa-exclamation-circle"></i>',
        warning: '<i class="fas fa-exclamation-triangle"></i>',
        info: '<i class="fas fa-info-circle"></i>'
    };
    return icons[type] || icons.info;
}

function dismissNotification(id) {
    const notification = document.getElementById(id);
    if (!notification) return;
    
    notification.classList.add('slide-out');
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

// Replace the old showResponse function with notification-based version
function showResponse(data, isError = false) {
    const message = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    const type = isError ? 'error' : 'success';
    showNotification(message, type);
}

async function apiCall(endpoint, method = 'GET', body = null, showResponse = false) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        }
    };

    if (authToken) {
        options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        
        // Handle empty responses (like 204 No Content)
        if (response.status === 204) {
            return { message: 'Success' };
        }
        
        const data = await response.json();
        
        if (response.ok) {
            if (showResponse) {
                showResponse(data);
            }
            return data;
        } else {
            if (showResponse) {
                showResponse(data, true);
            }
            throw new Error(data.message || 'API Error');
        }
    } catch (error) {
        if (showResponse) {
            showResponse(`Error: ${error.message}`, true);
        }
        throw error;
    }
}

// Authentication functions
async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const loginStatus = document.getElementById('loginStatus');
    
    // Show loading state
    loginStatus.className = 'login-status';
    loginStatus.textContent = 'Logging in...';
    loginStatus.style.display = 'block';
    
    try {
        const data = await apiCall('/auth/login', 'POST', { email, password }, false);
        authToken = data.accessToken || data.tokens?.accessToken;
        localStorage.setItem('authToken', authToken);
        currentUser = data.user;
        
        // Check if user has admin access
        if (checkAdminAccess()) {
            // Show admin panel
            showAdminPanel();
            loginStatus.className = 'login-status success';
            loginStatus.textContent = `Welcome ${data.user.email}! Loading admin panel...`;
        } else {
            loginStatus.className = 'login-status error';
            loginStatus.textContent = 'Access denied: Admin privileges required';
        }
    } catch (error) {
        loginStatus.className = 'login-status error';
        loginStatus.textContent = `Login failed: ${error.message}`;
        hideAdminTabs();
    }
}

async function getCurrentUser() {
    try {
        const data = await apiCall('/auth/me', 'GET', null, false);
        currentUser = data;
        
        // Check admin access and show/hide tabs accordingly
        checkAdminAccess();
        
        return data;
    } catch (error) {
        console.error('Failed to get current user:', error);
        hideAdminTabs(); // Hide admin tabs on error
        return null;
    }
}

async function refreshToken() {
    // This would need a refresh token endpoint
    showResponse('Refresh token functionality not implemented yet', true);
}

// CRM-Style User Management Functions
let allUsers = [];
let filteredUsers = [];

async function loadUserData() {
    try {
        const data = await apiCall('/users', 'GET', null, false);
        allUsers = data.users || [];
        filteredUsers = [...allUsers];
        
        updateUserStats();
        renderUserTable();
    } catch (error) {
        console.error('Failed to load users:', error);
        showUserTableError('Failed to load users: ' + error.message);
    }
}

function updateUserStats() {
    const totalUsers = allUsers.length;
    const activeUsers = allUsers.filter(user => user.status === 'ACTIVE').length;
    const adminUsers = allUsers.filter(user => ['SUPER_ADMIN', 'ADMIN'].includes(user.role)).length;
    const recentUsers = allUsers.filter(user => {
        const createdDate = new Date(user.createdAt);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return createdDate > weekAgo;
    }).length;
    
    document.getElementById('totalUsers').textContent = totalUsers;
    document.getElementById('activeUsers').textContent = activeUsers;
    document.getElementById('adminUsers').textContent = adminUsers;
    document.getElementById('recentUsers').textContent = recentUsers;
}

async function renderUserTable() {
    const tbody = document.getElementById('userTableBody');
    
    if (filteredUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="loading-row">
                    <i class="fas fa-search" style="margin-right: 0.5rem;"></i>
                    No users found matching your criteria
                </td>
            </tr>
        `;
        return;
    }
    
    // Load billing status for all users
    const usersWithBilling = await Promise.all(filteredUsers.map(async (user) => {
        try {
            const status = await apiCall(`/billing/${user.id}/status`, 'GET', null, false);
            return { ...user, billing: status };
        } catch (error) {
            return { ...user, billing: null };
        }
    }));
    
    tbody.innerHTML = usersWithBilling.map(user => {
        const billing = user.billing?.user || {};
        const now = new Date();
        let daysRemaining = null;
        let billingStatusBadge = '<span class="status-badge status-inactive">No Cycle</span>';
        let cycleEndDate = 'N/A';
        let billingCycle = 'N/A';
        
        if (billing.isTrialActive && billing.trialEndDate) {
            const endDate = new Date(billing.trialEndDate);
            const diff = endDate.getTime() - now.getTime();
            daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
            cycleEndDate = formatDate(billing.trialEndDate);
            billingCycle = 'Trial';
            billingStatusBadge = daysRemaining > 0 
                ? `<span class="status-badge status-active">Trial - ${daysRemaining}d</span>`
                : `<span class="status-badge status-suspended">Trial Expired</span>`;
        } else if (billing.billingCycle && billing.billingCycleEndDate) {
            const endDate = new Date(billing.billingCycleEndDate);
            const diff = endDate.getTime() - now.getTime();
            daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
            cycleEndDate = formatDate(billing.billingCycleEndDate);
            billingCycle = billing.billingCycle.replace('_', ' ');
            if (daysRemaining < 0) {
                billingStatusBadge = '<span class="status-badge status-suspended">Expired</span>';
            } else if (daysRemaining <= 7) {
                billingStatusBadge = `<span class="status-badge status-disabled">Expiring - ${daysRemaining}d</span>`;
            } else {
                billingStatusBadge = `<span class="status-badge status-active">Active - ${daysRemaining}d</span>`;
            }
        }
        
        return `
        <tr>
            <td>
                <div class="user-info">
                    <div class="user-avatar">
                        ${user.email.charAt(0).toUpperCase()}
                    </div>
                    <div class="user-details">
                        <h4>${user.email}</h4>
                        <p>ID: ${user.id}</p>
                    </div>
                </div>
            </td>
            <td>${user.email}</td>
            <td>
                <span class="role-badge role-${user.role.toLowerCase().replace('_', '-')}">
                    ${user.role.replace('_', ' ')}
                </span>
            </td>
            <td>
                <span class="status-badge status-${user.status.toLowerCase()}">
                    ${user.status}
                </span>
            </td>
            <td>${billingCycle}</td>
            <td>${cycleEndDate}</td>
            <td>${daysRemaining !== null ? daysRemaining : 'N/A'}</td>
            <td>${formatDate(user.createdAt)}</td>
            <td>${user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit" onclick="editUser('${user.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="action-btn password" onclick="changeUserPassword('${user.id}')">
                        <i class="fas fa-key"></i> Password
                    </button>
                    <button class="action-btn info" onclick="showAddPaymentModalForUser('${user.id}', '${user.email}')" style="background: #1E4A4A; color: #00D0B0; border-color: #00D0B0;">
                        <i class="fas fa-credit-card"></i> Payment
                    </button>
                    <button class="action-btn toggle" onclick="toggleUserStatus('${user.id}', '${user.status}')">
                        <i class="fas fa-power-off"></i> ${user.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                    </button>
                    ${user.role !== 'SUPER_ADMIN' ? `
                        <button class="action-btn delete" onclick="deleteUser('${user.id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `;
    }).join('');
}

function filterUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const roleFilter = document.getElementById('roleFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    
    filteredUsers = allUsers.filter(user => {
        const matchesSearch = user.email.toLowerCase().includes(searchTerm) || 
                             user.id.toLowerCase().includes(searchTerm);
        const matchesRole = !roleFilter || user.role === roleFilter;
        const matchesStatus = !statusFilter || user.status === statusFilter;
        
        return matchesSearch && matchesRole && matchesStatus;
    });
    
    renderUserTable();
}

function formatDate(dateString) {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function showUserTableError(message) {
    const tbody = document.getElementById('userTableBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="10" class="loading-row" style="color: #fca5a5;">
                <i class="fas fa-exclamation-triangle" style="margin-right: 0.5rem;"></i>
                ${message}
            </td>
        </tr>
    `;
}

function refreshUserList() {
    loadUserData();
}

function showCreateUserModal() {
    // For now, we'll use a simple prompt. In a real app, you'd have a modal
    const email = prompt('Enter user email:');
    if (!email) return;
    
    const password = prompt('Enter password (min 6 characters):');
    if (!password || password.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
    }
    
    const role = prompt('Enter role (USER, ADMIN, SUPPORT):', 'USER');
    if (!['USER', 'ADMIN', 'SUPPORT'].includes(role)) {
        alert('Invalid role. Must be USER, ADMIN, or SUPPORT');
        return;
    }
    
    createUserWithData(email, password, role);
}

async function createUserWithData(email, password, role) {
    try {
        await apiCall('/users', 'POST', { email, password, role }, false);
        showResponse(`User ${email} created successfully!`);
        loadUserData(); // Refresh the list
    } catch (error) {
        showResponse(`Failed to create user: ${error.message}`, true);
    }
}

async function editUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    const newRole = prompt(`Change role for ${user.email}:\nCurrent: ${user.role}\n\nEnter new role (USER, ADMIN, SUPPORT, SUPER_ADMIN):`, user.role);
    if (!newRole || newRole === user.role) return;
    
    if (!['USER', 'ADMIN', 'SUPPORT', 'SUPER_ADMIN'].includes(newRole)) {
        alert('Invalid role');
        return;
    }
    
    try {
        await apiCall(`/users/${userId}/role`, 'PATCH', { role: newRole }, false);
        showResponse(`User role updated successfully!`);
        loadUserData();
    } catch (error) {
        showResponse(`Failed to update user role: ${error.message}`, true);
    }
}

async function toggleUserStatus(userId, currentStatus) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    const newStatus = currentStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    const confirmMessage = `Are you sure you want to ${newStatus === 'ACTIVE' ? 'enable' : 'disable'} user ${user.email}?`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
        await apiCall(`/users/${userId}/status`, 'PATCH', { status: newStatus }, false);
        showResponse(`User status updated successfully!`);
        loadUserData();
    } catch (error) {
        showResponse(`Failed to update user status: ${error.message}`, true);
    }
}

async function deleteUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    const confirmMessage = `Are you sure you want to delete user ${user.email}?\n\nThis action cannot be undone!`;
    if (!confirm(confirmMessage)) return;
    
    try {
        await apiCall(`/users/${userId}`, 'DELETE', null, false);
        showResponse(`User deleted successfully!`);
        loadUserData();
    } catch (error) {
        showResponse(`Failed to delete user: ${error.message}`, true);
    }
}

async function changeUserPassword(userId) {
    console.log('changeUserPassword called with userId:', userId);
    console.log('currentUser:', currentUser);
    console.log('authToken:', authToken ? 'exists' : 'missing');
    
    const user = allUsers.find(u => u.id === userId);
    if (!user) {
        console.error('User not found:', userId);
        return;
    }
    
    const newPassword = prompt(`Enter new password for user ${user.email}:\n\nPassword must be at least 6 characters long.`);
    if (!newPassword) return;
    
    if (newPassword.length < 6) {
        alert('Password must be at least 6 characters long.');
        return;
    }
    
    const confirmPassword = prompt(`Confirm the new password for ${user.email}:`);
    if (newPassword !== confirmPassword) {
        alert('Passwords do not match. Please try again.');
        return;
    }
    
    try {
        console.log('Attempting to change password for user:', user.email);
        await apiCall(`/users/${userId}/password`, 'PATCH', { password: newPassword }, false);
        showResponse(`Password updated successfully for ${user.email}!`);
        loadUserData();
    } catch (error) {
        console.error('Password change error:', error);
        showResponse(`Failed to update password: ${error.message}`, true);
    }
}

// User management functions
async function createUser() {
    const email = document.getElementById('createUserEmail').value;
    const password = document.getElementById('createUserPassword').value;
    const role = document.getElementById('createUserRole').value;
    
    if (!email || !password) {
        showResponse('Email and password are required', true);
        return;
    }
    
    try {
        const data = await apiCall('/users', 'POST', { email, password, role });
        showResponse(`User created successfully: ${data.email}`);
        document.getElementById('createUserEmail').value = '';
        document.getElementById('createUserPassword').value = '';
    } catch (error) {
        showResponse(`Failed to create user: ${error.message}`, true);
    }
}

async function getAllUsers() {
    try {
        const data = await apiCall('/users');
        
        // Display users in a formatted way
        if (data && data.users && Array.isArray(data.users)) {
            displayUserList(data.users);
        } else {
            showResponse(data);
        }
    } catch (error) {
        showResponse(`Failed to get users: ${error.message}`, true);
    }
}

function displayUserList(users) {
    const userListCard = document.getElementById('userListCard');
    const userList = document.getElementById('userList');
    
    if (!users || users.length === 0) {
        userList.innerHTML = '<p>No users found.</p>';
        userListCard.style.display = 'block';
        return;
    }
    
    let html = '<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">';
    html += '<thead><tr style="background: #f8f9fa;">';
    html += '<th style="padding: 10px; border: 1px solid #dee2e6; text-align: left;">ID</th>';
    html += '<th style="padding: 10px; border: 1px solid #dee2e6; text-align: left;">Email</th>';
    html += '<th style="padding: 10px; border: 1px solid #dee2e6; text-align: left;">Role</th>';
    html += '<th style="padding: 10px; border: 1px solid #dee2e6; text-align: left;">Status</th>';
    html += '<th style="padding: 10px; border: 1px solid #dee2e6; text-align: left;">Created</th>';
    html += '<th style="padding: 10px; border: 1px solid #dee2e6; text-align: left;">Actions</th>';
    html += '</tr></thead><tbody>';
    
    users.forEach(user => {
        const statusColor = user.status === 'ACTIVE' ? '#28a745' : 
                           user.status === 'DISABLED' ? '#6c757d' : '#dc3545';
        const roleColor = user.role === 'SUPER_ADMIN' ? '#dc3545' : 
                         user.role === 'ADMIN' ? '#fd7e14' : 
                         user.role === 'SUPPORT' ? '#20c997' : '#6c757d';
        
        html += `<tr style="border-bottom: 1px solid #dee2e6;">`;
        html += `<td style="padding: 8px; font-family: monospace; font-size: 0.9em;">${user.id}</td>`;
        html += `<td style="padding: 8px;">${user.email}</td>`;
        html += `<td style="padding: 8px;"><span style="color: ${roleColor}; font-weight: bold;">${user.role}</span></td>`;
        html += `<td style="padding: 8px;"><span style="color: ${statusColor}; font-weight: bold;">${user.status}</span></td>`;
        html += `<td style="padding: 8px; font-size: 0.9em;">${new Date(user.createdAt).toLocaleDateString()}</td>`;
        html += `<td style="padding: 8px;">`;
        html += `<button onclick="fillUserForm('${user.id}', '${user.email}', '${user.role}', '${user.status}')" style="background: #007bff; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8em; margin-right: 4px;">Quick Fill</button>`;
        html += `</td>`;
        html += `</tr>`;
    });
    
    html += '</tbody></table>';
    
    userList.innerHTML = html;
    userListCard.style.display = 'block';
    
    // Also show in response area
    showResponse(`Found ${users.length} users. Displayed in table above.`);
}

function fillUserForm(userId, email, role, status) {
    // This function is no longer needed with the new CRM interface
    showResponse(`Forms filled with data for user: ${email} (${role})`);
}

async function getSessionAssignmentStats() {
    try {
        const data = await apiCall('/sessions/assignment-stats');
        showResponse(data);
    } catch (error) {
        showResponse(`Failed to get session assignment stats: ${error.message}`, true);
    }
}

async function getUserById() {
    const userId = prompt('Enter User ID:');
    if (userId) {
        try {
            const data = await apiCall(`/users/${userId}`);
            showResponse(data);
        } catch (error) {
            showResponse(`Failed to get user: ${error.message}`, true);
        }
    }
}

// This function is now handled by the new changeUserPassword(userId) function

// This function is now handled by the new toggleUserStatus(userId, currentStatus) function

// This function is now handled by the new updateUserRole(userId) function

// This function is now handled by the new deleteUser(userId) function

// Session management functions
async function createSession() {
    const name = document.getElementById('sessionName').value;
    const notes = document.getElementById('sessionNotes').value;
    
    if (!name) {
        showResponse('Session name is required', true);
        return;
    }
    
    try {
        const data = await apiCall('/sessions', 'POST', { name, notes });
        showResponse(`Session created successfully: ${data.name}`);
        document.getElementById('sessionName').value = '';
        document.getElementById('sessionNotes').value = '';
    } catch (error) {
        showResponse(`Failed to create session: ${error.message}`, true);
    }
}

async function getAllSessions() {
    try {
        const data = await apiCall('/sessions');
        showResponse(data);
    } catch (error) {
        showResponse(`Failed to get sessions: ${error.message}`, true);
    }
}

async function getSessionById() {
    const sessionId = prompt('Enter Session ID:');
    if (sessionId) {
        try {
            const data = await apiCall(`/sessions/${sessionId}`);
            showResponse(data);
        } catch (error) {
            showResponse(`Failed to get session: ${error.message}`, true);
        }
    }
}

async function deleteSession() {
    const sessionId = prompt('Enter Session ID to delete:');
    if (sessionId) {
        if (confirm('Are you sure you want to delete this session?')) {
            try {
                const data = await apiCall(`/sessions/${sessionId}`, 'DELETE');
                showResponse(`Session deleted successfully`);
            } catch (error) {
                showResponse(`Failed to delete session: ${error.message}`, true);
            }
        }
    }
}

// Proxy management functions
async function addProxy() {
    const name = document.getElementById('proxyName').value;
    const host = document.getElementById('proxyHost').value;
    const port = parseInt(document.getElementById('proxyPort').value);
    const protocol = document.getElementById('proxyProtocol').value;
    
    if (!name || !host || !port) {
        showResponse('Name, host, and port are required', true);
        return;
    }
    
    try {
        const data = await apiCall('/proxies', 'POST', { name, host, port, protocol });
        showResponse(`Proxy added successfully: ${data.name}`);
        document.getElementById('proxyName').value = '';
        document.getElementById('proxyHost').value = '';
        document.getElementById('proxyPort').value = '';
    } catch (error) {
        showResponse(`Failed to add proxy: ${error.message}`, true);
    }
}

async function getAllProxies() {
    try {
        const data = await apiCall('/proxies');
        showResponse(data);
    } catch (error) {
        showResponse(`Failed to get proxies: ${error.message}`, true);
    }
}

async function getProxyById() {
    const proxyId = prompt('Enter Proxy ID:');
    if (proxyId) {
        try {
            const data = await apiCall(`/proxies/${proxyId}`);
            showResponse(data);
        } catch (error) {
            showResponse(`Failed to get proxy: ${error.message}`, true);
        }
    }
}

// Domain management functions
async function addDomain() {
    const label = document.getElementById('domainLabel').value;
    const baseUrl = document.getElementById('domainBaseUrl').value;
    const description = document.getElementById('domainDescription').value;
    
    if (!label || !baseUrl) {
        showResponse('Label and base URL are required', true);
        return;
    }
    
    try {
        const data = await apiCall('/domains', 'POST', { label, baseUrl, description });
        showResponse(`Domain added successfully: ${data.label}`);
        document.getElementById('domainLabel').value = '';
        document.getElementById('domainBaseUrl').value = '';
        document.getElementById('domainDescription').value = '';
    } catch (error) {
        showResponse(`Failed to add domain: ${error.message}`, true);
    }
}

async function getAllDomains() {
    try {
        const data = await apiCall('/domains');
        showResponse(data);
    } catch (error) {
        showResponse(`Failed to get domains: ${error.message}`, true);
    }
}

async function getDomainById() {
    const domainId = prompt('Enter Domain ID:');
    if (domainId) {
        try {
            const data = await apiCall(`/domains/${domainId}`);
            showResponse(data);
        } catch (error) {
            showResponse(`Failed to get domain: ${error.message}`, true);
        }
    }
}

// ============================================================================
// LOGIN HISTORY FUNCTIONS
// ============================================================================

let allLoginHistory = [];
let filteredLoginHistory = [];

async function loadLoginHistory() {
    try {
        const data = await apiCall('/login-history', 'GET', null, false);
        allLoginHistory = data || [];
        filteredLoginHistory = [...allLoginHistory];
        
        updateLoginHistoryStats();
        renderLoginHistoryTable();
    } catch (error) {
        console.error('Failed to load login history:', error);
        showLoginHistoryError('Failed to load login history: ' + error.message);
    }
}

function updateLoginHistoryStats() {
    const total = allLoginHistory.length;
    const successful = allLoginHistory.filter(l => l.success).length;
    const failed = allLoginHistory.filter(l => !l.success).length;
    const last24h = allLoginHistory.filter(l => {
        const loginDate = new Date(l.loginAt);
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return loginDate > dayAgo;
    }).length;
    
    document.getElementById('totalLogins').textContent = total;
    document.getElementById('successfulLogins').textContent = successful;
    document.getElementById('failedLogins').textContent = failed;
    document.getElementById('recentLogins24h').textContent = last24h;
}

function renderLoginHistoryTable() {
    const tbody = document.getElementById('loginHistoryTableBody');
    
    if (filteredLoginHistory.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="loading-row">
                    <i class="fas fa-search"></i> No login records found
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredLoginHistory.map(login => `
        <tr>
            <td>${login.email || 'N/A'}</td>
            <td>${login.ipAddress || 'N/A'}</td>
            <td>${login.city && login.country ? `${login.city}, ${login.country}` : 'Unknown'}</td>
            <td>${login.deviceInfo || 'Unknown'}</td>
            <td>${formatDate(login.loginAt)}</td>
            <td>
                <span class="status-badge ${login.success ? 'status-active' : 'status-suspended'}">
                    ${login.success ? '✓ Success' : '✗ Failed'}
                </span>
            </td>
        </tr>
    `).join('');
}

function filterLoginHistory() {
    const searchTerm = document.getElementById('loginHistorySearch').value.toLowerCase();
    const statusFilter = document.getElementById('loginStatusFilter').value;
    
    filteredLoginHistory = allLoginHistory.filter(login => {
        const matchesSearch = login.email?.toLowerCase().includes(searchTerm) || 
                             login.ipAddress?.toLowerCase().includes(searchTerm) ||
                             login.city?.toLowerCase().includes(searchTerm);
        const matchesStatus = !statusFilter || login.success.toString() === statusFilter;
        
        return matchesSearch && matchesStatus;
    });
    
    renderLoginHistoryTable();
}

function showLoginHistoryError(message) {
    const tbody = document.getElementById('loginHistoryTableBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="loading-row" style="color: #fca5a5;">
                <i class="fas fa-exclamation-triangle"></i> ${message}
            </td>
        </tr>
    `;
}

function refreshLoginHistory() {
    loadLoginHistory();
    showNotification('Login history refreshed', 'success', 2000);
}

function exportLoginHistory() {
    // Simple CSV export
    const csv = ['User,IP Address,Location,Device,Time,Status'];
    filteredLoginHistory.forEach(login => {
        const row = [
            login.email || 'N/A',
            login.ipAddress || 'N/A',
            login.city && login.country ? `${login.city} ${login.country}` : 'Unknown',
            login.deviceInfo || 'Unknown',
            new Date(login.loginAt).toLocaleString(),
            login.success ? 'Success' : 'Failed'
        ].map(v => `"${v}"`).join(',');
        csv.push(row);
    });
    
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `login-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    showNotification('Login history exported', 'success', 2000);
}

// ============================================================================
// ACTIVE SESSIONS FUNCTIONS
// ============================================================================

let allActiveSessions = [];
let filteredActiveSessions = [];

async function loadActiveSessions() {
    try {
        const data = await apiCall('/session-activity/active', 'GET', null, false);
        allActiveSessions = data || [];
        filteredActiveSessions = [...allActiveSessions];
        
        updateActiveSessionsStats();
        renderActiveSessionsTable();
    } catch (error) {
        console.error('Failed to load active sessions:', error);
        showActiveSessionsError('Failed to load active sessions: ' + error.message);
    }
}

function updateActiveSessionsStats() {
    const total = allActiveSessions.length;
    const uniqueDevices = new Set(allActiveSessions.map(s => s.macAddress || s.deviceInfo)).size;
    const uniqueLocations = new Set(allActiveSessions.map(s => `${s.city},${s.country}`)).size;
    
    // Calculate average session duration
    const avgDuration = allActiveSessions.reduce((acc, session) => {
        const duration = (new Date() - new Date(session.loginAt)) / 1000 / 60; // minutes
        return acc + duration;
    }, 0) / (total || 1);
    
    document.getElementById('totalActiveSessions').textContent = total;
    document.getElementById('uniqueDevices').textContent = uniqueDevices;
    document.getElementById('uniqueLocations').textContent = uniqueLocations;
    document.getElementById('avgSessionDuration').textContent = Math.round(avgDuration) + ' min';
}

function renderActiveSessionsTable() {
    const tbody = document.getElementById('activeSessionsTableBody');
    
    if (filteredActiveSessions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-row">
                    <i class="fas fa-info-circle"></i> No active sessions
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredActiveSessions.map(session => `
        <tr>
            <td>
                <div class="user-info">
                    <div class="user-avatar">${session.user?.email?.charAt(0).toUpperCase() || '?'}</div>
                    <div class="user-details">
                        <h4>${session.user?.email || 'Unknown'}</h4>
                        <p>ID: ${session.userId}</p>
                    </div>
                </div>
            </td>
            <td>${session.ipAddress || 'N/A'}</td>
            <td>${session.city && session.country ? `${session.city}, ${session.country}` : 'Unknown'}</td>
            <td>${session.deviceInfo || 'Unknown'}</td>
            <td>${formatDate(session.loginAt)}</td>
            <td>${formatDate(session.lastActivityAt)}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn delete" onclick="forceLogoutSession('${session.id}')">
                        <i class="fas fa-power-off"></i> Force Logout
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function filterActiveSessions() {
    const searchTerm = document.getElementById('activeSessionsSearch').value.toLowerCase();
    
    filteredActiveSessions = allActiveSessions.filter(session => {
        return session.user?.email?.toLowerCase().includes(searchTerm) ||
               session.ipAddress?.toLowerCase().includes(searchTerm) ||
               session.city?.toLowerCase().includes(searchTerm);
    });
    
    renderActiveSessionsTable();
}

function showActiveSessionsError(message) {
    const tbody = document.getElementById('activeSessionsTableBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="loading-row" style="color: #fca5a5;">
                <i class="fas fa-exclamation-triangle"></i> ${message}
            </td>
        </tr>
    `;
}

function refreshActiveSessions() {
    loadActiveSessions();
    showNotification('Active sessions refreshed', 'success', 2000);
}

async function forceLogoutSession(sessionId) {
    if (!confirm('Are you sure you want to force logout this session?')) {
        return;
    }
    
    try {
        await apiCall(`/session-activity/${sessionId}/logout`, 'POST', null, false);
        showNotification('Session logged out successfully', 'success');
        loadActiveSessions(); // Refresh
    } catch (error) {
        showNotification(`Failed to logout session: ${error.message}`, 'error');
    }
}

async function logoutAllSessions() {
    if (!confirm('Are you sure you want to logout ALL active sessions? This will disconnect all users!')) {
        return;
    }
    
    try {
        // Logout all sessions for each user
        const userIds = [...new Set(allActiveSessions.map(s => s.userId))];
        
        for (const userId of userIds) {
            await apiCall(`/session-activity/logout-all/${userId}`, 'POST', null, false);
        }
        
        showNotification('All sessions logged out successfully', 'success');
        loadActiveSessions(); // Refresh
    } catch (error) {
        showNotification(`Failed to logout all sessions: ${error.message}`, 'error');
    }
}

// ============================================================================
// SECURITY ALERTS FUNCTIONS
// ============================================================================

let allSecurityAlerts = [];
let filteredSecurityAlerts = [];

async function loadSecurityAlerts() {
    try {
        const data = await apiCall('/security-alerts', 'GET', null, false);
        allSecurityAlerts = data || [];
        filteredSecurityAlerts = [...allSecurityAlerts];
        
        updateSecurityAlertsStats();
        renderSecurityAlertsTable();
        updateAlertBadge();
    } catch (error) {
        console.error('Failed to load security alerts:', error);
        showSecurityAlertsError('Failed to load security alerts: ' + error.message);
    }
}

function updateSecurityAlertsStats() {
    const total = allSecurityAlerts.length;
    const unread = allSecurityAlerts.filter(a => !a.isRead).length;
    const critical = allSecurityAlerts.filter(a => a.severity === 'CRITICAL').length;
    const last24h = allSecurityAlerts.filter(a => {
        const alertDate = new Date(a.createdAt);
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return alertDate > dayAgo;
    }).length;
    
    document.getElementById('totalAlerts').textContent = total;
    document.getElementById('unreadAlerts').textContent = unread;
    document.getElementById('criticalAlerts').textContent = critical;
    document.getElementById('alerts24h').textContent = last24h;
}

function updateAlertBadge() {
    const unread = allSecurityAlerts.filter(a => !a.isRead && !a.isDismissed).length;
    const badge = document.getElementById('alertBadge');
    
    if (badge) {
        if (unread > 0) {
            badge.textContent = unread > 99 ? '99+' : unread;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }
}

function renderSecurityAlertsTable() {
    const tbody = document.getElementById('securityAlertsTableBody');
    
    if (filteredSecurityAlerts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-row">
                    <i class="fas fa-check-circle"></i> No security alerts
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredSecurityAlerts.map(alert => {
        const severityColors = {
            CRITICAL: 'status-suspended',
            HIGH: 'status-suspended',
            MEDIUM: 'role-admin',
            LOW: 'status-active'
        };
        
        return `
        <tr style="${alert.isRead ? 'opacity: 0.6;' : ''}">
            <td>
                <strong>${alert.message}</strong>
                ${alert.metadata ? `<br><small>${JSON.stringify(alert.metadata).substring(0, 100)}</small>` : ''}
            </td>
            <td>${alert.user?.email || 'System'}</td>
            <td>
                <span class="status-badge ${severityColors[alert.severity]}">
                    ${alert.severity}
                </span>
            </td>
            <td>${alert.alertType.replace(/_/g, ' ')}</td>
            <td>${formatDate(alert.createdAt)}</td>
            <td>
                ${alert.isDismissed ? '<span class="status-badge status-inactive">Dismissed</span>' : 
                  alert.isRead ? '<span class="status-badge status-active">Read</span>' : 
                  '<span class="status-badge role-admin">Unread</span>'}
            </td>
            <td>
                <div class="action-buttons">
                    ${!alert.isRead ? `
                        <button class="action-btn edit" onclick="markAlertRead('${alert.id}')">
                            <i class="fas fa-check"></i> Mark Read
                        </button>
                    ` : ''}
                    ${!alert.isDismissed ? `
                        <button class="action-btn delete" onclick="dismissAlert('${alert.id}')">
                            <i class="fas fa-times"></i> Dismiss
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `}).join('');
}

function filterSecurityAlerts() {
    const searchTerm = document.getElementById('alertsSearch').value.toLowerCase();
    const severityFilter = document.getElementById('alertSeverityFilter').value;
    const typeFilter = document.getElementById('alertTypeFilter').value;
    
    filteredSecurityAlerts = allSecurityAlerts.filter(alert => {
        const matchesSearch = alert.message?.toLowerCase().includes(searchTerm) ||
                             alert.user?.email?.toLowerCase().includes(searchTerm);
        const matchesSeverity = !severityFilter || alert.severity === severityFilter;
        const matchesType = !typeFilter || alert.alertType === typeFilter;
        
        return matchesSearch && matchesSeverity && matchesType;
    });
    
    renderSecurityAlertsTable();
}

function showSecurityAlertsError(message) {
    const tbody = document.getElementById('securityAlertsTableBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="loading-row" style="color: #fca5a5;">
                <i class="fas fa-exclamation-triangle"></i> ${message}
            </td>
        </tr>
    `;
}

function refreshSecurityAlerts() {
    loadSecurityAlerts();
    showNotification('Security alerts refreshed', 'success', 2000);
}

async function markAlertRead(alertId) {
    try {
        await apiCall(`/security-alerts/${alertId}/read`, 'POST', null, false);
        showNotification('Alert marked as read', 'success', 2000);
        loadSecurityAlerts(); // Refresh
    } catch (error) {
        showNotification(`Failed to mark alert as read: ${error.message}`, 'error');
    }
}

async function markAllAlertsRead() {
    try {
        await apiCall('/security-alerts/read-all', 'POST', null, false);
        showNotification('All alerts marked as read', 'success');
        loadSecurityAlerts(); // Refresh
    } catch (error) {
        showNotification(`Failed to mark all alerts as read: ${error.message}`, 'error');
    }
}

async function dismissAlert(alertId) {
    try {
        await apiCall(`/security-alerts/${alertId}/dismiss`, 'POST', null, false);
        showNotification('Alert dismissed', 'success', 2000);
        loadSecurityAlerts(); // Refresh
    } catch (error) {
        showNotification(`Failed to dismiss alert: ${error.message}`, 'error');
    }
}

async function dismissAllAlerts() {
    if (!confirm('Are you sure you want to dismiss all alerts?')) {
        return;
    }
    
    try {
        // Dismiss each alert
        for (const alert of allSecurityAlerts.filter(a => !a.isDismissed)) {
            await apiCall(`/security-alerts/${alert.id}/dismiss`, 'POST', null, false);
        }
        showNotification('All alerts dismissed', 'success');
        loadSecurityAlerts(); // Refresh
    } catch (error) {
        showNotification(`Failed to dismiss all alerts: ${error.message}`, 'error');
    }
}

// ============================================================================
// AUTO-REFRESH & POLLING
// ============================================================================

// Poll for new security alerts every 30 seconds
setInterval(() => {
    if (currentUser && authToken) {
        loadSecurityAlerts();
    }
}, 30000);

// Load security alerts initially when user logs in
const originalShowAdminPanel = showAdminPanel;
showAdminPanel = function() {
    originalShowAdminPanel();
    // Load data for new tabs
    loadSecurityAlerts();
    loadDashboardData();
}

// ============================================================================
// BILLING MANAGEMENT
// ============================================================================

let allBillingData = [];
let filteredBillingData = [];
let loggedInUsers = [];

// Load billing data
async function loadBillingData() {
    try {
        // Get all users with billing info
        const usersResponse = await apiCall('/users', 'GET', null, false);
        const users = usersResponse.users || [];
        
        // Get billing status for each user
        allBillingData = [];
        for (const user of users) {
            try {
                const status = await apiCall(`/billing/${user.id}/status`, 'GET', null, false);
                allBillingData.push({
                    ...user,
                    billing: status,
                });
            } catch (error) {
                // User might not have billing set up
                allBillingData.push({
                    ...user,
                    billing: {
                        isExpired: false,
                        daysRemaining: null,
                        statusMessage: 'No billing cycle set',
                    },
                });
            }
        }
        
        filteredBillingData = [...allBillingData];
        updateBillingStats();
        renderBillingTable();
    } catch (error) {
        console.error('Failed to load billing data:', error);
        showNotification('Failed to load billing data: ' + error.message, 'error');
    }
}

function updateBillingStats() {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const withBilling = allBillingData.filter(u => u.billing?.user?.billingCycle || u.billing?.user?.isTrialActive);
    const expired = allBillingData.filter(u => u.billing?.isExpired);
    const expiringSoon = allBillingData.filter(u => {
        if (!u.billing?.user?.billingCycleEndDate && !u.billing?.user?.trialEndDate) return false;
        const endDate = u.billing?.user?.billingCycleEndDate || u.billing?.user?.trialEndDate;
        return endDate && new Date(endDate) <= sevenDaysFromNow && new Date(endDate) > now;
    });
    const activeTrials = allBillingData.filter(u => u.billing?.user?.isTrialActive);
    
    document.getElementById('billingTotalUsers').textContent = withBilling.length;
    document.getElementById('billingExpired').textContent = expired.length;
    document.getElementById('billingExpiringSoon').textContent = expiringSoon.length;
    document.getElementById('billingActiveTrials').textContent = activeTrials.length;
}

function renderBillingTable() {
    const tbody = document.getElementById('billingTableBody');
    
    if (filteredBillingData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-row">
                    <i class="fas fa-search"></i> No billing data found
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredBillingData.map(user => {
        const billing = user.billing?.user || {};
        const now = new Date();
        let daysRemaining = null;
        let statusBadge = '';
        let endDate = null;
        
        if (billing.isTrialActive && billing.trialEndDate) {
            endDate = new Date(billing.trialEndDate);
            const diff = endDate.getTime() - now.getTime();
            daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
            statusBadge = daysRemaining > 0 
                ? `<span class="status-badge status-active">Trial - ${daysRemaining}d left</span>`
                : `<span class="status-badge status-suspended">Trial Expired</span>`;
        } else if (billing.billingCycle && billing.billingCycleEndDate) {
            endDate = new Date(billing.billingCycleEndDate);
            const diff = endDate.getTime() - now.getTime();
            daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
            if (daysRemaining < 0) {
                statusBadge = '<span class="status-badge status-suspended">Expired</span>';
            } else if (daysRemaining <= 7) {
                statusBadge = `<span class="status-badge status-disabled">Expiring Soon - ${daysRemaining}d</span>`;
            } else {
                statusBadge = `<span class="status-badge status-active">Active - ${daysRemaining}d</span>`;
            }
        } else {
            statusBadge = '<span class="status-badge status-inactive">No Cycle Set</span>';
        }
        
        return `
            <tr>
                <td>
                    <div class="user-info">
                        <div class="user-avatar">${user.email.charAt(0).toUpperCase()}</div>
                        <div class="user-details">
                            <h4>${user.email}</h4>
                            <p>ID: ${user.id}</p>
                        </div>
                    </div>
                </td>
                <td>${billing.billingCycle ? billing.billingCycle.replace('_', ' ') : 'Trial'}</td>
                <td>${billing.billingCycleStartDate ? formatDate(billing.billingCycleStartDate) : (billing.trialStartDate ? formatDate(billing.trialStartDate) : 'N/A')}</td>
                <td>${endDate ? formatDate(endDate.toISOString()) : 'N/A'}</td>
                <td>${daysRemaining !== null ? daysRemaining : 'N/A'}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn edit" onclick="showAddPaymentModalForUser('${user.id}', '${user.email}')">
                            <i class="fas fa-credit-card"></i> Payment
                        </button>
                        <button class="action-btn password" onclick="showPaymentHistory('${user.id}')">
                            <i class="fas fa-history"></i> History
                        </button>
                        <button class="action-btn toggle" onclick="showSetBillingCycleModalForUser('${user.id}', '${user.email}')">
                            <i class="fas fa-calendar"></i> Set Cycle
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filterBillingUsers() {
    const searchTerm = document.getElementById('billingSearch').value.toLowerCase();
    const cycleFilter = document.getElementById('billingCycleFilter').value;
    const statusFilter = document.getElementById('billingStatusFilter').value;
    
    filteredBillingData = allBillingData.filter(user => {
        const matchesSearch = user.email.toLowerCase().includes(searchTerm);
        const billing = user.billing?.user || {};
        const matchesCycle = !cycleFilter || billing.billingCycle === cycleFilter;
        
        let matchesStatus = true;
        if (statusFilter) {
            const now = new Date();
            if (statusFilter === 'active') {
                matchesStatus = !user.billing?.isExpired && (billing.billingCycle || billing.isTrialActive);
            } else if (statusFilter === 'expired') {
                matchesStatus = user.billing?.isExpired;
            } else if (statusFilter === 'expiring_soon') {
                const endDate = billing.billingCycleEndDate || billing.trialEndDate;
                if (endDate) {
                    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                    matchesStatus = new Date(endDate) <= sevenDaysFromNow && new Date(endDate) > now;
                } else {
                    matchesStatus = false;
                }
            } else if (statusFilter === 'trial') {
                matchesStatus = billing.isTrialActive === true;
            }
        }
        
        return matchesSearch && matchesCycle && matchesStatus;
    });
    
    renderBillingTable();
}

async function refreshBillingData() {
    showNotification('Refreshing billing data...', 'info');
    await loadBillingData();
    showNotification('Billing data refreshed', 'success');
}

// Payment Modal Functions
function showAddPaymentModal() {
    document.getElementById('addPaymentModal').style.display = 'flex';
    document.getElementById('paymentUserEmail').value = '';
    document.getElementById('paymentBillingCycle').value = '';
    document.getElementById('paymentAmount').value = '';
    document.getElementById('paymentMemo').value = '';
}

function showAddPaymentModalForUser(userId, email) {
    document.getElementById('addPaymentModal').style.display = 'flex';
    document.getElementById('paymentUserEmail').value = email;
    document.getElementById('paymentUserEmail').setAttribute('data-user-id', userId);
    document.getElementById('paymentBillingCycle').value = '';
    document.getElementById('paymentAmount').value = '';
    document.getElementById('paymentMemo').value = '';
}

function closeAddPaymentModal() {
    document.getElementById('addPaymentModal').style.display = 'none';
}

async function submitPayment() {
    const email = document.getElementById('paymentUserEmail').value;
    const userId = document.getElementById('paymentUserEmail').getAttribute('data-user-id');
    const cycle = document.getElementById('paymentBillingCycle').value;
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const memo = document.getElementById('paymentMemo').value;
    
    if (!email || !cycle || !amount || amount <= 0) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    try {
        // Find user by email if userId not set
        let targetUserId = userId;
        if (!targetUserId) {
            const usersResponse = await apiCall('/users', 'GET', null, false);
            const user = usersResponse.users.find(u => u.email === email);
            if (!user) {
                showNotification('User not found', 'error');
                return;
            }
            targetUserId = user.id;
        }
        
        await apiCall(`/billing/${targetUserId}/add-payment`, 'POST', {
            cycle,
            amount,
            memo: memo || null,
        }, false);
        
        showNotification('Payment added successfully', 'success');
        closeAddPaymentModal();
        await loadBillingData();
    } catch (error) {
        showNotification('Failed to add payment: ' + error.message, 'error');
    }
}

// Trial Modal Functions
function showSetTrialModal() {
    document.getElementById('setTrialModal').style.display = 'flex';
    document.getElementById('trialUserEmail').value = '';
    document.getElementById('trialHours').value = '24';
}

function closeSetTrialModal() {
    document.getElementById('setTrialModal').style.display = 'none';
}

async function submitTrial() {
    const email = document.getElementById('trialUserEmail').value;
    const hours = parseInt(document.getElementById('trialHours').value);
    
    if (!email || !hours || hours <= 0) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    try {
        const usersResponse = await apiCall('/users', 'GET', null, false);
        const user = usersResponse.users.find(u => u.email === email);
        if (!user) {
            showNotification('User not found', 'error');
            return;
        }
        
        await apiCall(`/billing/${user.id}/set-trial`, 'POST', { hours }, false);
        
        showNotification('Trial period set successfully', 'success');
        closeSetTrialModal();
        await loadBillingData();
    } catch (error) {
        showNotification('Failed to set trial: ' + error.message, 'error');
    }
}

// Billing Cycle Modal Functions
function showSetBillingCycleModalForUser(userId, email) {
    document.getElementById('setBillingCycleModal').style.display = 'flex';
    document.getElementById('cycleUserEmail').value = email;
    document.getElementById('cycleUserEmail').setAttribute('data-user-id', userId);
    document.getElementById('cycleType').value = '';
    document.getElementById('cycleStartDate').value = '';
}

function closeSetBillingCycleModal() {
    document.getElementById('setBillingCycleModal').style.display = 'none';
}

async function submitBillingCycle() {
    const email = document.getElementById('cycleUserEmail').value;
    const userId = document.getElementById('cycleUserEmail').getAttribute('data-user-id');
    const cycle = document.getElementById('cycleType').value;
    const startDateStr = document.getElementById('cycleStartDate').value;
    
    if (!email || !cycle) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    try {
        let targetUserId = userId;
        if (!targetUserId) {
            const usersResponse = await apiCall('/users', 'GET', null, false);
            const user = usersResponse.users.find(u => u.email === email);
            if (!user) {
                showNotification('User not found', 'error');
                return;
            }
            targetUserId = user.id;
        }
        
        const payload = { cycle };
        if (startDateStr) {
            payload.startDate = new Date(startDateStr).toISOString();
        }
        
        await apiCall(`/billing/${targetUserId}/start-cycle`, 'POST', payload, false);
        
        showNotification('Billing cycle started successfully', 'success');
        closeSetBillingCycleModal();
        await loadBillingData();
    } catch (error) {
        showNotification('Failed to set billing cycle: ' + error.message, 'error');
    }
}

// Payment History Modal
async function showPaymentHistory(userId) {
    document.getElementById('paymentHistoryModal').style.display = 'flex';
    const content = document.getElementById('paymentHistoryContent');
    content.innerHTML = '<div class="loading-row"><div class="loading-spinner"></div>Loading payment history...</div>';
    
    try {
        const response = await apiCall(`/billing/${userId}/payments`, 'GET', null, false);
        const payments = response.payments || [];
        
        if (payments.length === 0) {
            content.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No payment history found</p>';
            return;
        }
        
        content.innerHTML = `
            <table class="user-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Cycle</th>
                        <th>Status</th>
                        <th>Period</th>
                        <th>Memo</th>
                    </tr>
                </thead>
                <tbody>
                    ${payments.map(p => `
                        <tr>
                            <td>${formatDate(p.paymentDate)}</td>
                            <td>$${parseFloat(p.amount).toFixed(2)}</td>
                            <td>${p.billingCycle.replace('_', ' ')}</td>
                            <td><span class="status-badge status-${p.status.toLowerCase()}">${p.status}</span></td>
                            <td>${formatDate(p.cycleStartDate)} - ${formatDate(p.cycleEndDate)}</td>
                            <td>${p.memo || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        content.innerHTML = `<p style="color: var(--danger-color);">Failed to load payment history: ${error.message}</p>`;
    }
}

function closePaymentHistoryModal() {
    document.getElementById('paymentHistoryModal').style.display = 'none';
}

async function checkExpiredAccounts() {
    try {
        const response = await apiCall('/billing/expired', 'GET', null, false);
        const expired = response.total || 0;
        
        if (expired > 0) {
            document.getElementById('expiredAccountsCount').textContent = `${expired} account(s) have expired billing cycles or trials.`;
            document.getElementById('expiredAccountsAlert').style.display = 'block';
        } else {
            document.getElementById('expiredAccountsAlert').style.display = 'none';
        }
        
        showNotification(`Found ${expired} expired account(s)`, expired > 0 ? 'warning' : 'success');
    } catch (error) {
        showNotification('Failed to check expired accounts: ' + error.message, 'error');
    }
}

async function checkAndDisableExpired() {
    if (!confirm('Are you sure you want to disable all expired accounts? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await apiCall('/billing/check-expired', 'POST', null, false);
        showNotification(`Disabled ${response.disabled} expired account(s)`, 'success');
        await loadBillingData();
        document.getElementById('expiredAccountsAlert').style.display = 'none';
    } catch (error) {
        showNotification('Failed to disable expired accounts: ' + error.message, 'error');
    }
}

// ============================================================================
// DASHBOARD FUNCTIONS
// ============================================================================

async function loadDashboardData() {
    await Promise.all([
        loadLoggedInUsers(),
        loadBillingOverview(),
        updateDashboardStats(),
    ]);
}

async function loadLoggedInUsers() {
    try {
        const response = await apiCall('/session-activity/active', 'GET', null, false);
        loggedInUsers = response.sessions || [];
        renderLoggedInUsersTable();
        
        document.getElementById('dashboardActiveSessions').textContent = loggedInUsers.length;
    } catch (error) {
        console.error('Failed to load logged-in users:', error);
    }
}

function renderLoggedInUsersTable() {
    const tbody = document.getElementById('loggedInUsersTableBody');
    
    if (loggedInUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-row">
                    <i class="fas fa-info-circle"></i> No users currently logged in
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = loggedInUsers.map(session => {
        const loginTime = new Date(session.loginAt);
        const now = new Date();
        const durationMs = now.getTime() - loginTime.getTime();
        const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
        const durationMins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        const durationStr = durationHours > 0 ? `${durationHours}h ${durationMins}m` : `${durationMins}m`;
        
        return `
            <tr>
                <td>
                    <div class="user-info">
                        <div class="user-avatar">${session.user?.email?.charAt(0).toUpperCase() || '?'}</div>
                        <div class="user-details">
                            <h4>${session.user?.email || 'Unknown'}</h4>
                            <p>ID: ${session.userId}</p>
                        </div>
                    </div>
                </td>
                <td>${session.ipAddress || 'N/A'}</td>
                <td>${session.city && session.country ? `${session.city}, ${session.country}` : 'Unknown'}</td>
                <td>${session.deviceInfo || 'Unknown'}</td>
                <td>${formatDate(session.loginAt)}</td>
                <td>${durationStr}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn delete" onclick="forceLogoutSession('${session.id}')">
                            <i class="fas fa-power-off"></i> Force Logout
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function loadBillingOverview() {
    try {
        const usersResponse = await apiCall('/users', 'GET', null, false);
        const users = usersResponse.users || [];
        
        const billingData = [];
        for (const user of users.slice(0, 20)) { // Limit to 20 for performance
            try {
                const status = await apiCall(`/billing/${user.id}/status`, 'GET', null, false);
                if (status.user.billingCycle || status.user.isTrialActive) {
                    billingData.push({ ...user, billing: status });
                }
            } catch (error) {
                // Skip users without billing
            }
        }
        
        renderBillingOverviewTable(billingData);
    } catch (error) {
        console.error('Failed to load billing overview:', error);
    }
}

function renderBillingOverviewTable(billingData) {
    const tbody = document.getElementById('billingOverviewTableBody');
    
    if (billingData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-row">
                    <i class="fas fa-info-circle"></i> No billing data available
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = billingData.map(item => {
        const billing = item.billing?.user || {};
        const now = new Date();
        let daysRemaining = null;
        let statusBadge = '';
        let endDate = null;
        
        if (billing.isTrialActive && billing.trialEndDate) {
            endDate = new Date(billing.trialEndDate);
            const diff = endDate.getTime() - now.getTime();
            daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
            statusBadge = daysRemaining > 0 
                ? `<span class="status-badge status-active">Trial</span>`
                : `<span class="status-badge status-suspended">Expired</span>`;
        } else if (billing.billingCycle && billing.billingCycleEndDate) {
            endDate = new Date(billing.billingCycleEndDate);
            const diff = endDate.getTime() - now.getTime();
            daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
            if (daysRemaining < 0) {
                statusBadge = '<span class="status-badge status-suspended">Expired</span>';
            } else if (daysRemaining <= 7) {
                statusBadge = `<span class="status-badge status-disabled">Expiring Soon</span>`;
            } else {
                statusBadge = `<span class="status-badge status-active">Active</span>`;
            }
        } else {
            statusBadge = '<span class="status-badge status-inactive">No Cycle</span>';
        }
        
        return `
            <tr>
                <td>
                    <div class="user-info">
                        <div class="user-avatar">${item.email.charAt(0).toUpperCase()}</div>
                        <div class="user-details">
                            <h4>${item.email}</h4>
                        </div>
                    </div>
                </td>
                <td>${billing.billingCycle ? billing.billingCycle.replace('_', ' ') : 'Trial'}</td>
                <td>${billing.billingCycleStartDate ? formatDate(billing.billingCycleStartDate) : (billing.trialStartDate ? formatDate(billing.trialStartDate) : 'N/A')}</td>
                <td>${endDate ? formatDate(endDate.toISOString()) : 'N/A'}</td>
                <td>${daysRemaining !== null ? daysRemaining : 'N/A'}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="action-btn edit" onclick="showTab('billing'); showAddPaymentModalForUser('${item.id}', '${item.email}')">
                        <i class="fas fa-credit-card"></i> Payment
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function updateDashboardStats() {
    try {
        const usersResponse = await apiCall('/users', 'GET', null, false);
        const users = usersResponse.users || [];
        
        const expiredResponse = await apiCall('/billing/expired', 'GET', null, false);
        const expired = expiredResponse.total || 0;
        
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        let expiringSoon = 0;
        
        for (const user of users.slice(0, 50)) {
            try {
                const status = await apiCall(`/billing/${user.id}/status`, 'GET', null, false);
                const billing = status.user;
                const endDate = billing.billingCycleEndDate || billing.trialEndDate;
                if (endDate) {
                    const end = new Date(endDate);
                    if (end <= sevenDaysFromNow && end > now) {
                        expiringSoon++;
                    }
                }
            } catch (error) {
                // Skip
            }
        }
        
        document.getElementById('dashboardTotalUsers').textContent = users.length;
        document.getElementById('dashboardExpiredAccounts').textContent = expired;
        document.getElementById('dashboardExpiringSoon').textContent = expiringSoon;
    } catch (error) {
        console.error('Failed to update dashboard stats:', error);
    }
}

async function refreshDashboard() {
    showNotification('Refreshing dashboard...', 'info');
    await loadDashboardData();
    showNotification('Dashboard refreshed', 'success');
}

async function refreshLoggedInUsers() {
    await loadLoggedInUsers();
    showNotification('Logged-in users refreshed', 'success');
}

// Auto-refresh dashboard every minute
setInterval(() => {
    if (currentUser && authToken && document.getElementById('dashboard').classList.contains('active')) {
        loadDashboardData();
    }
}, 60000);

// Auto-refresh active sessions every 30 seconds
setInterval(() => {
    if (currentUser && authToken && document.getElementById('activeSessions').classList.contains('active')) {
        loadActiveSessions();
    }
}, 30000);
