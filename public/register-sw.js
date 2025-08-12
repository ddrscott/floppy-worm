// Service Worker Registration Script for Floppy Worm

if ('serviceWorker' in navigator) {
  // Register service worker when the window loads
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });
      
      console.log('ServiceWorker registered successfully:', registration.scope);
      
      // Check for updates periodically (every hour)
      setInterval(() => {
        registration.update();
      }, 3600000);
      
      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker available
            console.log('New content available! Refresh to update.');
            
            // Show update notification to user (optional)
            if (window.showUpdateNotification) {
              window.showUpdateNotification();
            }
          }
        });
      });
      
      // Cache all map data for offline play
      if (registration.active) {
        // Get all map URLs from the game
        const mapUrls = await getMapUrls();
        if (mapUrls.length > 0) {
          registration.active.postMessage({
            type: 'CACHE_MAPS',
            maps: mapUrls
          });
        }
      }
      
    } catch (error) {
      console.error('ServiceWorker registration failed:', error);
    }
  });
  
  // Handle controller change (new SW activated)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Reload the page to get the new version
    window.location.reload();
  });
  
  // Optional: Show install prompt for mobile
  let deferredPrompt;
  
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default prompt
    e.preventDefault();
    // Store the event for later use
    deferredPrompt = e;
    
    // Show custom install button/banner
    const installButton = document.getElementById('install-button');
    if (installButton) {
      installButton.style.display = 'block';
      
      installButton.addEventListener('click', async () => {
        if (deferredPrompt) {
          // Show the install prompt
          deferredPrompt.prompt();
          
          // Wait for the user's response
          const { outcome } = await deferredPrompt.userChoice;
          console.log(`User ${outcome} the install prompt`);
          
          // Clear the deferred prompt
          deferredPrompt = null;
          installButton.style.display = 'none';
        }
      });
    }
  });
  
  // Track installation
  window.addEventListener('appinstalled', () => {
    console.log('Floppy Worm PWA installed successfully!');
    
    // Track install analytics if available
    if (window.gtag) {
      window.gtag('event', 'app_installed');
    }
  });
}

// Helper function to get all map URLs (to be implemented based on your map structure)
async function getMapUrls() {
  try {
    // This would ideally come from your MapDataRegistry
    // For now, return empty array - will be populated by the game
    return [];
  } catch (error) {
    console.error('Failed to get map URLs:', error);
    return [];
  }
}

// Optional: Function to show update notification
window.showUpdateNotification = function() {
  // Create a simple notification banner
  const notification = document.createElement('div');
  notification.id = 'update-notification';
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: #4ecdc4;
      color: white;
      padding: 15px 20px;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: Arial, sans-serif;
    ">
      <span>New version available!</span>
      <button onclick="window.location.reload()" style="
        background: white;
        color: #4ecdc4;
        border: none;
        padding: 5px 15px;
        border-radius: 3px;
        cursor: pointer;
        font-weight: bold;
      ">Update</button>
      <button onclick="this.parentElement.parentElement.remove()" style="
        background: transparent;
        color: white;
        border: 1px solid white;
        padding: 5px 15px;
        border-radius: 3px;
        cursor: pointer;
      ">Later</button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-hide after 10 seconds
  setTimeout(() => {
    notification.remove();
  }, 10000);
};