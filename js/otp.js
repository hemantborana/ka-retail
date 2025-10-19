/* ========================================
   KA Retail E-Ordering - OTP Screen JavaScript
   ======================================== */

(function() {
    'use strict';
    
    // DOM Elements
    const otpForm = document.getElementById('otp-form');
    const otpInput = document.getElementById('otp');
    const submitButton = otpForm.querySelector('button[type="submit"]');
    const resendButton = document.querySelector('.resend-button');
    
    // Get email from session
    const pendingEmail = sessionStorage.getItem('pendingEmail');
    
    // Resend cooldown timer
    let resendCooldown = 0;
    let cooldownInterval = null;
    let isSubmitting = false;
    
    // Check if user came from login screen
    if (!pendingEmail) {
        console.log('No pending email found, redirecting to login');
        Navigation.goto('login');
        return;
    }
    
    // Form submission handler
    otpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Prevent multiple simultaneous submissions
        if (isSubmitting) {
            return;
        }
        
        const otp = otpInput.value.trim();
        
        // Clear any existing errors
        Utils.clearError(otpInput);
        
        // Validate OTP
        if (!otp) {
            Utils.showError(otpInput, 'OTP is required');
            return;
        }
        
        if (!Utils.validateOTP(otp)) {
            Utils.showError(otpInput, 'OTP must be 6 digits');
            return;
        }
        
        // Set submitting flag
        isSubmitting = true;
        
        // Show loading state
        Utils.setButtonLoading(submitButton, true);
        
        try {
            // Call real API to verify OTP
            const response = await API.verifyOTP(pendingEmail, otp);
            
            if (response.success) {
                // Store user data with session token
                AppState.setUser(response.data);
                
                // Clear pending email
                sessionStorage.removeItem('pendingEmail');
                
                // Show success message
                Utils.showSuccess(response.message || 'Login successful!');
                
                // Navigate to home screen after short delay
                setTimeout(() => {
                    Navigation.goto('home');
                }, 1000);
            } else {
                // Show error from server
                Utils.showError(otpInput, response.message || 'Invalid OTP');
                Utils.setButtonLoading(submitButton, false);
                otpInput.value = '';
                otpInput.focus();
                isSubmitting = false;
            }
            
        } catch (error) {
            console.error('OTP verification error:', error);
            Utils.showError(otpInput, error.message || 'Failed to verify OTP. Please try again.');
            Utils.setButtonLoading(submitButton, false);
            otpInput.value = '';
            otpInput.focus();
            isSubmitting = false;
        }
    });
    
    // Resend OTP handler
    resendButton.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (resendCooldown > 0) {
            return;
        }
        
        Utils.setButtonLoading(resendButton, true);
        
        try {
            // Call real API to resend OTP
            const response = await API.generateOTP(pendingEmail);
            
            if (response.success) {
                Utils.showSuccess(response.message || 'OTP resent successfully!');
                startResendCooldown();
            } else {
                alert(response.message || 'Failed to resend OTP. Please try again.');
            }
            
        } catch (error) {
            console.error('Resend OTP error:', error);
            alert('Failed to resend OTP. Please try again.');
        } finally {
            Utils.setButtonLoading(resendButton, false);
        }
    });
    
    // Real-time OTP validation
    otpInput.addEventListener('input', (e) => {
        // Only allow digits
        e.target.value = e.target.value.replace(/\D/g, '');
        
        if (e.target.value.length > 0) {
            Utils.clearError(otpInput);
        }
        
        // Auto-submit when 6 digits entered
        if (e.target.value.length === 6 && !isSubmitting) {
            setTimeout(() => {
                const submitEvent = new SubmitEvent('submit', {
                    bubbles: true,
                    cancelable: true,
                    submitter: submitButton
                });
                otpForm.dispatchEvent(submitEvent);
            }, 100);
        }
    });
    
    // Prevent form from submitting via Enter key during input
    otpInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (otpInput.value.length === 6 && !isSubmitting) {
                otpForm.dispatchEvent(new SubmitEvent('submit', {
                    bubbles: true,
                    cancelable: true,
                    submitter: submitButton
                }));
            }
        }
    });
    
    // Start resend cooldown timer
    function startResendCooldown() {
        resendCooldown = 60; // 60 seconds cooldown
        resendButton.disabled = true;
        
        cooldownInterval = setInterval(() => {
            resendCooldown--;
            resendButton.textContent = `Resend OTP (${resendCooldown}s)`;
            
            if (resendCooldown <= 0) {
                clearInterval(cooldownInterval);
                resendButton.disabled = false;
                resendButton.textContent = 'Resend OTP';
            }
        }, 1000);
    }
    
    // Auto-focus OTP input on load
    window.addEventListener('load', () => {
        otpInput.focus();
    });
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (cooldownInterval) {
            clearInterval(cooldownInterval);
        }
    });
    
})();