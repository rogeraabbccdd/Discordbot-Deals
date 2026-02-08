FROM oven/bun:1 AS base
WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile --production
CMD [ "bun", "start" ]
