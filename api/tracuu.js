{
  "name": "tracuu-proxy",
  "version": "1.0.0",
  "description": "Proxy server for tra cứu phạt nguội (demo). Handles captcha + session and forwards requests to target.",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "axios": "^1.5.0",
    "body-parser": "^1.20.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "form-data": "^4.0.0",
    "tough-cookie": "^4.1.2",
    "axios-cookiejar-support": "^3.0.0"
  },
  "optionalDependencies": {
    "puppeteer": "^20.0.0"
  },
  "engines": {
    "node": ">=16"
  }
}
