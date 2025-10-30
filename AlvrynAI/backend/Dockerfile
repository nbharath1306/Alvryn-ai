FROM node:18
WORKDIR /app
COPY package.json package-lock.json* ./
# Install Node production deps first
RUN npm install --production

# Install python3 and pip so the worker can run ai/virality.py
RUN apt-get update && apt-get install -y python3 python3-pip && pip3 install --no-cache-dir openai || true && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY . .
EXPOSE 4000
CMD ["npm","start"]
