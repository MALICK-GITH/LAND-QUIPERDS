// Enregistrement du service worker pour le PWA
export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      // Nettoyer les anciens service workers Firebase
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          if (registration.active?.scriptURL.includes('firebase-messaging-sw')) {
            await registration.unregister();
            console.log('Ancien service worker Firebase supprimé:', registration);
          }
        }
      } catch (error) {
        console.error('Erreur lors du nettoyage des anciens service workers:', error);
      }

      // Enregistrer le nouveau service worker
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker enregistré avec succès:', registration);
        })
        .catch((error) => {
          console.error('Erreur lors de l\'enregistrement du Service Worker:', error);
        });
    });
  }
}
