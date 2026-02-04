FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm update
CMD ["node", "./serveronly"]