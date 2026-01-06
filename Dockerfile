# syntax=docker/dockerfile:1
FROM nginx:1.27-alpine

# Replace default nginx config for SPA-ish static serving + caching
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static files
WORKDIR /usr/share/nginx/html
COPY index.html .
COPY style.css .
COPY app.js .
# (Optional) include README in image? keep out.
