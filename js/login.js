/* ========================================
   KA Retail E-Ordering - Login Screen JavaScript
   ======================================== */

(function() {
    'use strict';
    
    // Check if already logged in
    if (AppState.isAuthenticated && AppState.currentUser) {
        console.log('User already logged in, redirecting to home...');
        Navigation.goto('home');
        return;
    }
    
    // DOM Elements
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const submitButton = loginForm.querySelector('button[type="submit"]');
    
    // Form submission handler
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        
        // Clear any existing errors
        Utils.clearError(emailInput);
        
        // Validate email
        if (!email) {
            Utils.showError(emailInput, 'Email address is required');
            return;
        }
        
        if (!Utils.validateEmail(email)) {
            Utils.showError(emailInput, 'Please enter a valid email address');
            return;
        }
        
        // Show loading state
        Utils.setButtonLoading(submitButton, true);
        
        try {
            // Call real API to send OTP
            const response = await API.generateOTP(email);
            
            if (response.success) {
                // Store email temporarily for OTP verification
                sessionStorage.setItem('pendingEmail', email);
                
                // If admin bypass
                if (response.data && response.data.isAdmin) {
                    Utils.showSuccess('Admin login - redirecting...');
                    setTimeout(() => {
                        Navigation.goto('home');
                    }, 1000);
                } else {
                    // Show success message
                    Utils.showSuccess(response.message || 'OTP sent successfully!');
                    
                    // Navigate to OTP screen after short delay
                    setTimeout(() => {
                        Navigation.goto('otp');
                    }, 1000);
                }
            } else {
                // Show error from server
                Utils.showError(emailInput, response.message || 'Failed to send OTP');
                Utils.setButtonLoading(submitButton, false);
            }
            
        } catch (error) {
            console.error('Login error:', error);
            Utils.showError(emailInput, error.message || 'Failed to send OTP. Please try again.');
            Utils.setButtonLoading(submitButton, false);
        }
    });
    
    // Real-time email validation
    emailInput.addEventListener('input', () => {
        if (emailInput.value.trim()) {
            Utils.clearError(emailInput);
        }
    });
    
    // Auto-focus email input on load
    window.addEventListener('load', () => {
        emailInput.focus();
    });
    
})();