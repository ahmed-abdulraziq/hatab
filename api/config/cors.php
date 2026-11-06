<?php

// The web app (GitHub Pages, or Vite on localhost while developing) calls the API from
// another origin. Logins use a bearer token, not cookies, so no credentials are shared.

$origins = env(
    'CORS_ALLOWED_ORIGINS',
    'https://ahmed-abdulraziq.github.io,http://localhost:5173,http://localhost:4173',
);

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_values(array_filter(array_map('trim', explode(',', $origins)))),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 86400,
    'supports_credentials' => false,
];
