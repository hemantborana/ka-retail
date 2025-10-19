/* ========================================
   KA Retail E-Ordering - Common JavaScript
   ======================================== */

// API Configuration
const API_CONFIG = {
    baseURL: 'https://script.google.com/macros/s/AKfycbwLtEPYhkoKpcWX5b-i41ZExoiydVB245-RaIOD_4L3B86HhdH3qNaFqX9IoKgWhFnsJw/exec',
    timeout: 30000 // 30 seconds
};

// Application State Management
const AppState = {
    currentUser: null,
    isAuthenticated: false,
    isInitialized: false,
    validationPromise: null,
    
    // Initialize state from localStorage and validate with server
    async init() {
        const storedUser = this.getStoredUser();
        if (storedUser) {
            // Check if session is still valid (client-side first)
            const expiryDate = new Date(storedUser.sessionExpiry);
            const now = new Date();
            
            if (now <= expiryDate) {
                // Session not expired, validate with server
                const isValid = await this.validateSessionWithServer(storedUser);
                if (isValid) {
                    this.currentUser = storedUser;
                    this.isAuthenticated = true;
                    console.log('Session validated with server');
                } else {
                    console.log('Session rejected by server');
                    this.clearUser();
                }
            } else {
                console.log('Session expired (client-side check)');
                this.clearUser();
            }
        }
        this.isInitialized = true;
    },
    
    // Store user data using localStorage (1 month validity)
    setUser(userData) {
        this.currentUser = {
            email: userData.email,
            businessName: userData.businessName,
            city: userData.city,
            sessionToken: userData.sessionToken,
            sessionExpiry: userData.sessionExpiry,
            loginTime: new Date().toISOString()
        };
        this.isAuthenticated = true;
        
        // Use localStorage for persistent login (1 month)
        try {
            localStorage.setItem('kaRetailUser', JSON.stringify(this.currentUser));
            console.log('User session saved to localStorage');
        } catch (e) {
            console.error('Failed to save user session:', e);
        }
    },
    
    // Get stored user from localStorage
    getStoredUser() {
        try {
            const stored = localStorage.getItem('kaRetailUser');
            return stored ? JSON.parse(stored) : null;
        } catch (e) {
            console.error('Failed to retrieve user session:', e);
            return null;
        }
    },
    
    // Validate if stored session is still valid with server
    async validateSessionWithServer(userData) {
        try {
            console.log('Validating session with server...');
            const response = await API.checkSession(userData.email, userData.sessionToken);
            
            if (response.success) {
                // Check if user is still active in the system
                if (response.data && response.data.isActive === false) {
                    console.log('User account is inactive');
                    return false;
                }
                return true;
            } else {
                console.log('Session invalid:', response.message);
                return false;
            }
        } catch (error) {
            console.error('Session validation error:', error);
            // On network error, reject the session for security
            // User will need to login again when network is available
            return false;
        }
    },
    
    // Clear user session
    clearUser() {
        this.currentUser = null;
        this.isAuthenticated = false;
        try {
            localStorage.removeItem('kaRetailUser');
            console.log('User session cleared');
        } catch (e) {
            console.error('Failed to clear user session:', e);
        }
    },
    
    // Check if user needs revalidation (call this periodically)
    async revalidateSession() {
        if (!this.currentUser) return false;
        
        const isValid = await this.validateSessionWithServer(this.currentUser);
        if (!isValid) {
            this.clearUser();
            return false;
        }
        return true;
    }
};

// API Helper for server communication
const API = {
    // Send OTP to email
    async generateOTP(email) {
        try {
            const response = await fetch(API_CONFIG.baseURL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'generateOTP',
                    email: email
                })
            });
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Generate OTP API Error:', error);
            throw new Error('Network error. Please check your connection.');
        }
    },
    
    // Verify OTP
    async verifyOTP(email, otp) {
        try {
            const response = await fetch(API_CONFIG.baseURL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'verifyOTP',
                    email: email,
                    otp: otp
                })
            });
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Verify OTP API Error:', error);
            throw new Error('Network error. Please check your connection.');
        }
    },
    
    // Check if session is valid
    async checkSession(email, sessionToken) {
        try {
            const response = await fetch(API_CONFIG.baseURL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'checkSession',
                    email: email,
                    sessionToken: sessionToken
                })
            });
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Check Session API Error:', error);
            throw new Error('Network error. Please check your connection.');
        }
    }
};

// Navigation Helper
const Navigation = {
    // Navigate to a different page
    goto(page) {
        switch(page) {
            case 'login':
                window.location.href = 'index.html';
                break;
            case 'otp':
                window.location.href = 'otp.html';
                break;
            case 'home':
                window.location.href = 'home.html';
                break;
            default:
                console.error('Unknown page:', page);
        }
    },
    
    // Go back to previous page
    back() {
        window.history.back();
    }
};

// Utility Functions
const Utils = {
    // Validate email format
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },
    
    // Validate OTP format (6 digits)
    validateOTP(otp) {
        const otpRegex = /^\d{6}$/;
        return otpRegex.test(otp);
    },
    
    // Show loading state on button
    setButtonLoading(button, isLoading) {
        if (isLoading) {
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.textContent = 'Please wait...';
        } else {
            button.disabled = false;
            button.textContent = button.dataset.originalText || 'Submit';
        }
    },
    
    // Show error message
    showError(input, message) {
        // Remove existing error
        this.clearError(input);
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            color: #ff6b6b;
            font-size: 12px;
            margin-top: 4px;
            animation: slideUp 0.3s ease;
        `;
        errorDiv.textContent = message;
        
        input.parentElement.appendChild(errorDiv);
        input.style.borderColor = '#ff6b6b';
    },
    
    // Clear error message
    clearError(input) {
        const errorDiv = input.parentElement.querySelector('.error-message');
        if (errorDiv) {
            errorDiv.remove();
        }
        input.style.borderColor = '';
    },
    
    // Show success message (toast)
    showSuccess(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 24px;
            right: 24px;
            background: rgba(76, 175, 80, 0.95);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            animation: slideUp 0.3s ease;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    
    // Show alert message (for access denied, etc.)
    showAlert(message, type = 'error') {
        const bgColor = type === 'error' ? 'rgba(244, 67, 54, 0.95)' : 'rgba(255, 152, 0, 0.95)';
        const alert = document.createElement('div');
        alert.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: ${bgColor};
            color: white;
            padding: 24px 32px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 500;
            z-index: 10001;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            text-align: center;
            min-width: 300px;
        `;
        alert.textContent = message;
        
        document.body.appendChild(alert);
        
        setTimeout(() => {
            alert.remove();
        }, 3000);
    },
    
    // Format date/time
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
};

// Add CSS for toast animations
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from {
            opacity: 1;
            transform: translateY(0);
        }
        to {
            opacity: 0;
            transform: translateY(-20px);
        }
    }
    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);