FROM node:22-bookworm-slim
WORKDIR /usr/app/fiora
COPY package.json yarn.lock ./
COPY packages/assets/package.json packages/assets/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/utils/package.json packages/utils/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/bin/package.json packages/bin/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/web/package.json packages/web/package.json
COPY deploy/review-deps.cjs deploy/review-deps.cjs
RUN node deploy/review-deps.cjs && yarn install --ignore-engines --ignore-scripts --non-interactive --network-timeout 120000 && yarn cache clean
COPY packages/assets packages/assets
COPY packages/config packages/config
COPY packages/utils packages/utils
COPY packages/database packages/database
COPY packages/bin packages/bin
COPY packages/server packages/server
COPY packages/web packages/web
COPY tsconfig.json ./
RUN node deploy/review-deps.cjs --links && touch .env
ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=1600
RUN cd packages/web && ../../node_modules/.bin/webpack --config build/webpack.review.js && cp -r dist/fiora/. ../server/public/
WORKDIR /usr/app/fiora/packages/server
CMD ["../../node_modules/.bin/ts-node", "--transpile-only", "src/main.ts"]
