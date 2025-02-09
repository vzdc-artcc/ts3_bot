FROM node:current-alpine
LABEL authors="Harry Xu"

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["node","bot.js"]