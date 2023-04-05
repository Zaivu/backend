FROM node:15.8.0
WORKDIR /app
COPY ["package.json", "./"]
RUN npm install --production
RUN npm install nodemon -g --production
COPY . . 
EXPOSE 5000
CMD nodemon --max-old-space-size=4096 -L --watch . src/index.js
