FROM node:22-alpine

WORKDIR /app

# Copy source code
COPY . .

# Buat direktori data untuk volume persistent jika diinginkan
VOLUME ["/app/data"]
ENV DB_PATH=/app/data/data.db
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

CMD ["node", "server.js"]
