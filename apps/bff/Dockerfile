FROM node:22-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/bff/package.json apps/bff/package.json
COPY apps/supabase/package.json apps/supabase/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json

RUN npm ci

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      fonts-noto-core \
    && rm -rf /var/lib/apt/lists/* && \
    npx playwright install --with-deps chromium && \
    ls -la /ms-playwright && \
    node -e "const { chromium } = require('playwright'); console.log('Chromium executablePath:', chromium.executablePath());"

FROM deps AS build

COPY tsconfig.base.json ./
COPY apps/bff apps/bff
COPY packages/domain packages/domain

RUN npm run build --workspace @wos/domain \
  && npm run build --workspace @wos/bff

FROM deps AS runtime

ENV NODE_ENV=production

WORKDIR /app/apps/bff

COPY --from=build /app/apps/bff/dist /app/apps/bff/dist
COPY --from=build /app/packages/domain/dist /app/packages/domain/dist

EXPOSE 8787

CMD ["npm", "run", "start"]
