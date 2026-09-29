FROM nginx:1.27-alpine

# Yayin ayari: surumlu dosyalar uzun sure onbellekte. Gelistirmede docker-compose
# nginx.conf'u bunun uzerine baglar, orada onbellek kapali kalir.
COPY nginx.prod.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY assets     /usr/share/nginx/html/assets

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
