FROM node:22-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/bff/package.json apps/bff/package.json
COPY apps/supabase/package.json apps/supabase/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json

RUN npm ci

FROM deps AS build

COPY tsconfig.base.json ./
COPY apps/bff apps/bff
COPY packages/domain packages/domain

RUN npm run build --workspace @wos/domain \
  && npm run build --workspace @wos/bff

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app/apps/bff

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json /app/
COPY --from=build /app/node_modules /app/node_modules

RUN npx playwright install --with-deps chromium

RUN ls -la /ms-playwright && \
    node -e "const { chromium } = require('playwright'); console.log('Chromium executablePath:', chromium.executablePath());"
COPY --from=build /app/apps/bff/package.json /app/apps/bff/package.json
COPY --from=build /app/apps/bff/dist /app/apps/bff/dist
COPY --from=build /app/packages/domain/package.json /app/packages/domain/package.json
COPY --from=build /app/packages/domain/dist /app/packages/domain/dist

EXPOSE 8787

CMD ["npm", "run", "start"]
