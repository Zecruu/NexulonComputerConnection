FROM node:20-slim

WORKDIR /app

COPY apps/relay/package.json apps/relay/tsconfig.json ./
RUN npm install

COPY apps/relay/src/ src/
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
