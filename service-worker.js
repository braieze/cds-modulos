const CACHE_NAME = 'conquistadores-v1';
const urlsToCache = [
  './index.html',
  './src/Utils.js',
  './src/DataLogic.js',
  './src/views/Dashboard.js',
  './src/views/Directory.js',
  './src/views/Finances.js',
  './src/views/Worship.js',
  './src/views/MinistryWithTasks.js',
  './src/views/Messaging.js',
  './src/views/Blog.js',
  './src/views/EventDetails.js',
  './src/views/GlobalCalendar.js',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18/umd/react.development.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.development.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request);
      })
  );
});
