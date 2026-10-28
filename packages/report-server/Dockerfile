# Formancy Report's server (0046).
#
# Built from the repository root, because a pnpm workspace package cannot be
# built without its lockfile and its sibling packages:
#
#   docker build -f packages/report-server/Dockerfile -t formancy/report-server .
#
# Formancy Data's image's shape (its packages/data-server/Dockerfile), for
# its reasons; the comments here say where it differs. This release does not
# publish the image: the container gate builds it and runs it
# (scripts/container.mjs), and src/dockerfile.test.ts holds this file.

# ---------------------------------------------------------------- build stage
# Node 26 (SV-Q5), whose permission model has the network scope the
# renderer's workers will run under, at the digest of the multi-platform
# index of the tag, read with `docker buildx imagetools inspect` on
# 2026-10-22. The packages' own floor stays Node 22.13 (0004): this is the
# image's Node, not theirs.
FROM node:26.12.1-alpine3.24@sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797 AS build
WORKDIR /repo

# Node 25 and later ship no corepack, so pnpm is installed by npm, at the
# release the root package.json's packageManager pins.
RUN npm install -g --ignore-scripts pnpm@12.4.2

# Manifests and lockfile first, so a source change does not invalidate the
# dependency layer. Every workspace package the server depends on is listed
# here AND copied in full below; src/dockerfile.test.ts derives that list
# from the dependency graph and fails when this file forgets one.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/report-spec/package.json packages/report-spec/
COPY packages/report-server-core/package.json packages/report-server-core/
COPY packages/report-server/package.json packages/report-server/

# --ignore-scripts: nothing the server needs runs an install script, and a
# build that runs them from the network is supply-chain surface for nothing.
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @formancy/report-server...

COPY LICENSE.md NOTICE tsconfig.base.json ./
COPY scripts/sync-licenses.mjs scripts/
COPY packages/report-spec/ packages/report-spec/
COPY packages/report-server-core/ packages/report-server-core/
COPY packages/report-server/ packages/report-server/

RUN pnpm --filter @formancy/report-server... build && node scripts/sync-licenses.mjs

# A self-contained tree, so the runtime stage needs neither pnpm nor the
# repository: the server's dist, its LICENSE.md and NOTICE, and its
# production dependencies.
RUN pnpm --filter @formancy/report-server --prod deploy /app

# -------------------------------------------------------------- runtime stage
FROM node:26.12.1-alpine3.24@sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797 AS runtime
WORKDIR /app

# Root's, and only readable to the user the server runs as, where Data's
# image gives that user its tree: a process made to write could otherwise
# rewrite its own code, and the change would outlive a restart.
COPY --from=build /app /app

# The store's directory, owned by the user the server runs as, and the one
# directory that user is given. Docker copies an image directory's owner
# into a new named volume mounted on it; without this, such a volume is
# root's and the template store that arrives next could not write it. No
# VOLUME instruction: an anonymous volume nobody asked for is a surprise,
# not a default.
RUN mkdir -p /var/lib/formancy-report && chown node:node /var/lib/formancy-report

USER node

ENV NODE_ENV=production \
    PORT=4392

EXPOSE 4392

# The issuer, audience, identity key and tenant claim have no defaults on
# purpose: a server that started accepting tokens from an issuer nobody
# named, or without a tenant, would be worse than one that refuses to start.
# See packages/report-server/src/settings.ts.

# Formancy Data's image's values, so an orchestrator probes both servers
# alike: derived, not measured here. The container gate measured 0.65 to
# 0.78 s from start to healthy in its runs on 2026-10-22, well inside the
# start period.
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4392)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.mjs"]
