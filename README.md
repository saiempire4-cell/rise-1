# Rise 1

Rise 1 is an early, self-hostable private-messaging product with a public landing page and a responsive web app. It includes account registration, sign-in, user discovery, one-to-one conversations, persistent messages, and unread indicators.

## Requirements

- Node.js 20.11 or newer
- npm

## Local setup

```sh
npm install
Copy-Item .env.example .env
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite serves the website and app and proxies `/api` requests to the local API at port 3001. The SQLite database is created automatically at `data/rise1.sqlite`.

On macOS/Linux, copy the example environment file with `cp .env.example .env`.

Useful commands:

```sh
npm test       # API and persistence tests
npm run build  # production frontend build
npm start      # serve the built app and API on PORT (default 3001)
```

## Deploy online with AWS

Rise 1 can run as a Docker container on Amazon ECS with AWS Fargate, with Amazon EFS mounted for durable SQLite storage. The app itself runs in AWS, not on your laptop. Keep it as a single task: this SQLite MVP is not designed for multiple simultaneous app instances. AWS charges for the Fargate task, load balancer, EFS storage, and data transfer; review current prices in your AWS region before creating resources.

### Prepare and upload the container

You need an AWS account, an ECR repository, and Docker to **build and upload** the image. This does not run the app on your laptop. If you do not want Docker installed locally, configure AWS CodeBuild to build this Dockerfile from your GitHub repository and push the image to ECR instead.

1. Push this repository and branch to GitHub.
2. In AWS, create a private repository in **Amazon ECR** and follow its **View push commands** instructions to authenticate, build this repository's `Dockerfile`, tag the image, and push it. Use the resulting ECR image URI for the ECS task definition.
3. If building on an ARM laptop, build for `linux/amd64` (for example, `docker buildx build --platform linux/amd64 --tag <ECR-image-URI> --push .`) to match a standard x86 Fargate task.

### Create the AWS service

1. Create an encrypted Amazon EFS file system and an access point for Rise 1. Configure the access point's POSIX user as UID/GID `1000` and its root directory as `/rise-1` with owner `1000:1000` and permissions `750`. Permit NFS port 2049 only from the ECS task's security group.
2. Create an ECS Fargate task definition using the pushed image, Linux/x86_64, container port `3001`, and the `awslogs` log driver. Configure `NODE_ENV=production`, `PORT=3001`, `DATABASE_PATH=/var/data/rise1.sqlite`, and `APP_ORIGIN=https://chat.example.com`; replace the example hostname with your real HTTPS hostname. Store a unique session secret (at least 32 random bytes) in AWS Secrets Manager and inject it into the task as `SESSION_SECRET`. The task execution role needs permission to pull from ECR, write CloudWatch logs, and read that secret.
3. Add an EFS volume to the task definition using the access point, and mount it in the container at `/var/data`. Enable transit encryption for the EFS mount.
4. Create an Application Load Balancer with an HTTPS listener and an ACM certificate for your domain; forward traffic to the ECS task on port `3001`. Restrict task ingress to the load balancer security group. Point the domain to the load balancer, then set `APP_ORIGIN` to the exact `https://` origin and redeploy the task.
5. Create an ECS service using the task definition, Fargate, and the load balancer target group. Set the desired task count to **1**; do not enable autoscaling or deploy multiple tasks with this SQLite database.

Once the ECS service is healthy and DNS/TLS are ready, open `https://chat.example.com` (your configured domain). For production use, also configure database backups and retention, CloudWatch alarms, and a reviewed incident-response plan. The privacy limitations described below still apply.

## Privacy and security

Rise 1 does **not** currently provide end-to-end encryption. Message contents are stored as plaintext in SQLite and are readable by the server operator and anyone with database access. Do not use this MVP for highly sensitive conversations or represent it as a zero-knowledge or end-to-end encrypted service.

Passwords are hashed with bcrypt, session tokens are random and stored only as hashes, and session cookies are HTTP-only, `SameSite=Strict`, and `Secure` in production. Mutating API requests require the configured exact `APP_ORIGIN` request origin. These are baseline safeguards, not a substitute for a security review.

For deployments, generate a unique secret (for example with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`) and configure:

1. Set `NODE_ENV=production`, `APP_ORIGIN` to the exact HTTPS origin, a strong unique `SESSION_SECRET` (at least 32 random bytes), and a durable `DATABASE_PATH` outside the public web root.
2. Terminate TLS at a trusted reverse proxy, restrict database and backup access, configure encrypted storage/backups and monitoring, and keep dependencies and the host patched.
3. Use a persistent single-instance host for this SQLite MVP. It has no distributed session store, multi-instance coordination, account recovery, email verification, abuse-reporting workflow, or production-grade operational controls; those require deliberate implementation before a public launch.
4. Have the authentication, privacy, retention, and threat model independently reviewed before accepting real users.

The app currently provides username/password accounts without email verification or recovery. Users should choose a unique password. There are no demo credentials or committed secrets.
