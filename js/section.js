/* ========================================
   KA Retail E-Ordering - Section Pages JavaScript
   ======================================== */

(function() {
    'use strict';
    
    // Check authentication
    if (!AppState.isAuthenticated || !AppState.currentUser) {
        console.log('User not authenticated, redirecting to login...');
        Navigation.goto('login');
        return;
    }
    
    // DOM Elements
    const logoutBtn = document.getElementById('logout-btn');
    
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
    
    // Display user info in header if available
    window.addEventListener('load', () => {
        if (AppState.currentUser && AppState.currentUser.businessName) {
            // Update header subtitle with business name
            const headerSubtitle = document.querySelector('.header-text p');
            if (headerSubtitle) {
                headerSubtitle.textContent = `${AppState.currentUser.businessName} - ${AppState.currentUser.city || 'Kambeshwar Agencies'}`;
            }
        }
    });
    
    // Prevent back navigation to login when logged in
    window.addEventListener('popstate', (e) => {
        if (AppState.isAuthenticated) {
            history.pushState(null, '', window.location.href);
        }
    });
    
    // Initial state push
    history.pushState(null, '', window.location.href);
    
})();