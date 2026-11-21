add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), geolocation=(), microphone=(), focus-without-user-activation=()" always;
add_header Cross-Origin-Opener-Policy "same-origin-allow-popups" always;
add_header Cross-Origin-Resource-Policy "same-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; worker-src 'self' blob:; child-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://tiles.openfreemap.org https://tiles.mapterhorn.com https://*.arcgisonline.com https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://tile.openstreetmap.org; connect-src 'self' https://tiles.openfreemap.org https://tiles.mapterhorn.com https://*.arcgisonline.com https://*.basemaps.cartocdn.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self';" always;
