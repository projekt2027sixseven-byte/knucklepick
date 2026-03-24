# API-only image (monorepo). Runtime env (DATABASE_URL, JWT_SECRET, …) must be set by the platform.
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat

# Prisma validate/generate during npm ci (backend postinstall) needs placeholder URLs.
ENV DATABASE_URL="postgresql://dummy:dummy@127.0.0.1:5432/dummy"
ENV DIRECT_URL="postgresql://dummy:dummy@127.0.0.1:5432/dummy"

COPY package.json package-lock.json ./
COPY app/backend/package.json app/backend/
COPY app/frontend/package.json app/frontend/
COPY app/db ./app/db

# Install devDependencies too (Prisma CLI, TypeScript) — runtime image still starts only the API.
RUN npm ci --include=dev

COPY app ./app
COPY scripts ./scripts

ENV NODE_ENV=production

EXPOSE 4000

CMD ["npm", "run", "start", "-w", "@match-oracle/backend"]
