FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/bff/package.json apps/bff/package.json
COPY apps/supabase/package.json apps/supabase/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json

RUN npm ci

COPY tsconfig.base.json ./
COPY apps/web apps/web
COPY packages/domain packages/domain

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_BFF_URL=/api
ARG VITE_ENABLE_DEV_AUTO_LOGIN=false

ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
ENV VITE_BFF_URL=${VITE_BFF_URL}
ENV VITE_ENABLE_DEV_AUTO_LOGIN=${VITE_ENABLE_DEV_AUTO_LOGIN}

RUN npm run build --workspace @wos/web

FROM nginx:1.27-alpine AS runtime

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
