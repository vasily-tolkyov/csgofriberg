# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY scripts scripts
COPY data data
COPY client client
COPY server server

RUN pnpm build \
 && pnpm --filter server deploy --prod --no-optional --legacy /runtime/server

FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime

ARG OCI_SOURCE=""
ARG OCI_REVISION=""
ARG OCI_VERSION=""

LABEL org.opencontainers.image.title="friberg-lol-guess" \
      org.opencontainers.image.description="LoL player guessing game MVP" \
      org.opencontainers.image.source=$OCI_SOURCE \
      org.opencontainers.image.revision=$OCI_REVISION \
      org.opencontainers.image.version=$OCI_VERSION

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

COPY --from=build --chown=nonroot:nonroot /runtime/server/node_modules ./server/node_modules
COPY --from=build --chown=nonroot:nonroot /workspace/server/dist ./server/dist
COPY --from=build --chown=nonroot:nonroot /workspace/client/dist ./client/dist

USER nonroot
EXPOSE 3000

CMD ["server/dist/index.js"]
