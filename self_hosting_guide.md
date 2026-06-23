# Self-Hosting Guide: VPS Deployment with Docker

This guide explains how to deploy and self-host the Quiz Arena application on your virtual private server (VPS) using Docker and Docker Compose.

---

## 📋 Prerequisites

Before starting, make sure your VPS has the following installed:
1. **Docker**: [Install Docker Engine](https://docs.docker.com/engine/install/)
2. **Docker Compose**: [Install Docker Compose](https://docs.docker.com/compose/install/)

---

## 🛠️ Step 1: Pre-Deployment Setup

1. **Clone or copy your project files** to the VPS (e.g. into `/var/www/officequiz` or your home directory).
2. Navigate to the project root directory:
   ```bash
   cd /path/to/quizee
   ```
3. Create a `.env` configuration file in the project **root directory** (same folder as `docker-compose.yml`):
   ```bash
   nano .env
   ```
4. Paste the following configuration, replacing placeholder values with your secure secrets:
   ```env
    # Internal port for the backend server inside Docker container network
    PORT=4000

    # PostgreSQL master password used by the database container
    POSTGRES_PASSWORD=db pass

    # Full database connection string (points to the 'postgres' container service)
    DATABASE_URL==yout  connection url

    # JWT secret used for admin sessions
    JWT_SECRET=your  secret

    # Your Google Gemini API Key for AI quiz generation
    GEMINI_API_KEY=your  api  key
   ```

---

## 🚀 Step 2: Build & Start the Application

Run the following command in the root folder to build the container images and launch them in the background (detached mode):

```bash
docker compose up -d --build
```

Docker Compose will:
1. Build the Node.js backend server, connect it to your existing PostgreSQL database container (running on `evolution-network`), and run schema initialization/seeding automatically.
2. Build the React client app using Vite, compile static files, and launch Nginx to serve them on port `80`.

---

## 🔍 Step 3: Verify Status & Logs

1. Check running containers:
   ```bash
   docker compose ps
   ```
   You should see `officequiz-server` and `officequiz-client` running.

2. Check server logs to verify database connectivity and seeding:
   ```bash
   docker compose logs -f server
   ```
   You should see:
   * `Database initialized successfully.`
   * `Default admin seeded: admin@officequiz.com / admin123` (if it was a clean database start).

---

## 🌐 Step 4: Accessing the Application

By default, the application is exposed on port `8085` (HTTP) of your VPS IP:
* **Frontend**: `http://your-vps-ip:8085/`
* **API Health**: `http://your-vps-ip:8085/health`
* **WebSocket**: `http://your-vps-ip:8085/socket.io/`

You can log in to the admin panel at `http://your-vps-ip:8085/` using:
* **Email**: `admin@officequiz.com`
* **Password**: `admin123` *(Be sure to change this password in the database/admin profile once logged in!)*

---

## 🔒 Step 5: Domain & SSL Setup (Production Recommendation)

To run the application securely under a domain (e.g. `quiz.yourdomain.com`) with HTTPS, we recommend setting up Certbot and Nginx on the host VPS.

1. **Install Nginx on host VPS**:
   ```bash
   sudo apt update
   sudo apt install nginx certbot python3-certbot-nginx
   ```
2. **Modify `docker-compose.yml`**:
   Change the client ports mapping to run Nginx internally on port `8085` instead of `80`:
   ```yaml
   client:
     ports:
       - "127.0.0.1:8085:80"
   ```
3. **Configure Nginx Site Configuration**:
   Create a server block `/etc/nginx/sites-available/quiz.conf`:
   ```nginx
   server {
       listen 80;
       server_name quiz.yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:8085;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
       }
   }
   ```
4. Enable configuration & reload Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/quiz.conf /etc/nginx/sites-enabled/
   sudo systemctl reload nginx
   ```
5. **Install SSL with Let's Encrypt**:
   ```bash
   sudo certbot --nginx -d quiz.yourdomain.com
   ```
   Follow the prompts to enable HTTPS redirect.
