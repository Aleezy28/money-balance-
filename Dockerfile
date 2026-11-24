FROM node:20-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 7860
ENV PORT=7860
ENV NODE_ENV=production

CMD ["sh", "-c", "npx prisma db push && npx tsx server.ts"]
