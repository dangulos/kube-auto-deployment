FROM node:12
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY ./templates ./templates
COPY index.js ./
EXPOSE 420
CMD [ "node","index.js" ]