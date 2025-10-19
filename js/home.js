/* ========================================
   KA Retail E-Ordering - Home Screen JavaScript
   ======================================== */

(function() {
    'use strict';
    
    // Validate authentication silently in background
    async function validateAuth() {
        try {
            // Initialize AppState (validates with server)
            await AppState.init();
            
            // Check authentication
            if (!AppState.isAuthenticated || !AppState.currentUser) {
                console.log('User not authenticated, redirecting to login...');
                
                // Check if there was a stored user (means access was denied)
                const hadStoredUser = localStorage.getItem('kaRetailUser') !== null;
                
                if (hadStoredUser) {
                    // Access was denied by server
                    Utils.showAlert('Access Denied: Your account has been deactivated or session is invalid. Please contact admin.', 'error');
                } else {
                    Utils.showAlert('Please login to continue.', 'error');
                }
                
                setTimeout(() => {
                    Navigation.goto('login');
                }, 2500);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Auth validation error:', error);
            Utils.showAlert('Network error. Please check your connection and try again.', 'error');
            setTimeout(() => {
                Navigation.goto('login');
            }, 2500);
            return false;
        }
    }
    
    // Initialize the page
    async function init() {
        const isValid = await validateAuth();
        if (!isValid) return;
        
        // DOM Elements
        const logoutBtn = document.getElementById('logout-btn');
        const buttonCards = document.querySelectorAll('.glass-button-card');
        
        // Logout handler
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                const confirmed = confirm('Are you sure you want to logout?');
                
                if (confirmed) {
                    // Clear user session
                    AppState.clearUser();
                    
                    // Show logout message
                    Utils.showSuccess('Logged out successfully!');
                    
                    // Navigate to login after short delay
                    setTimeout(() => {
                        Navigation.goto('login');
                    }, 1000);
                }
            });
        }
        
        // Button card click handlers
        buttonCards.forEach(card => {
            card.addEventListener('click', () => {
                const action = card.dataset.action;
                
                switch(action) {
                    case 'order':
                        window.location.href = 'order.html';
                        break;
                    case 'recent-order':
                        window.location.href = 'recent-order.html';
                        break;
                    case 'stock':
                        window.location.href = 'stock.html';
                        break;
                    default:
                        console.error('Unknown action:', action);
                }
            });
            
            // Add hover effect
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-8px)';
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0)';
            });
        });
        
        // Display user info in header
        if (AppState.currentUser && AppState.currentUser.businessName) {
            const headerSubtitle = document.querySelector('.header-text p');
            if (headerSubtitle) {
                headerSubtitle.textContent = `${AppState.currentUser.businessName} - ${AppState.currentUser.city || 'India'}`;
            }
        }
        
        // Prevent back navigation to login when logged in
        window.addEventListener('popstate', (e) => {
            if (AppState.isAuthenticated) {
                history.pushState(null, '', window.location.href);
            }
        });
        
        // Initial state push
        history.pushState(null, '', window.location.href);
        
        // Periodic session validation (every 5 minutes) - SILENT
        setInterval(async () => {
            const isValid = await AppState.revalidateSession();
            if (!isValid) {
                Utils.showAlert('Access Denied: Your session has expired or access has been revoked by admin.', 'error');
                setTimeout(() => {
                    Navigation.goto('login');
                }, 2500);
            }
        }, 5 * 60 * 1000); // 5 minutes
    }
    
    // Start initialization when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();