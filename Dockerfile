FROM node:20-alpine

WORKDIR /app

# Install dependencies needed for native modules (if any)
RUN apk add --no-cache libc6-compat

# Install node dependencies
COPY package*.json ./
RUN npm ci

# Copy all source files
COPY . .

# Build Next.js production bundle
ENV NEXT_PUBLIC_SERVER_URL=https://vps-2613da52.vps.rcld.dev
RUN npm run build

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

CMD ["npm", "run", "start"]
