FROM node:14

WORKDIR /usr/app/fiora

COPY packages ./packages
COPY package.json tsconfig.json yarn.lock lerna.json ./
RUN touch .env

RUN yarn install --frozen-lockfile \
    && yarn cache clean \
    && rm -rf /usr/local/share/.cache/yarn

RUN yarn build:web

CMD ["yarn", "start"]
