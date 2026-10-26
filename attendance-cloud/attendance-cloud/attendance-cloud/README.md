# Cloud-Based Student Attendance Management System

React + Node/Express + MongoDB, containerised with Docker, tested in a VirtualBox VM,
deployed on AWS EC2, with a CloudSim peak-load simulation.

```
attendance-cloud/
├── docker-compose.yml
├── backend/      Express API (JWT auth, attendance, reports)
├── frontend/     React (Vite) UI served by Nginx
└── cloudsim/     AttendanceSimulation.java
```

## 1. Run locally with Docker
```bash
docker compose up --build
```
Open http://localhost. Create a **faculty** account and a few **student** accounts (use the
"Create an account" link), then mark attendance as faculty and log in as a student to view it.

Handy commands: `docker compose logs -f backend`, `docker compose down`, `docker compose down -v` (wipes DB).

## 2. Run inside Oracle VirtualBox (private cloud)
1. Create an Ubuntu Server 22.04 VM (2 CPU, 4 GB RAM, 20 GB disk).
2. Network: Adapter 1 = NAT with port forwarding Host 8080 -> Guest 80 (and Host 2222 -> Guest 22 for SSH).
3. Inside the VM:
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker $USER && newgrp docker
# copy the project into the VM (scp / shared folder), then:
cd attendance-cloud && docker compose up -d --build
```
4. Open http://localhost:8080 on your host. Take screenshots of the VM, `docker ps` and the app.

## 3. Deploy on AWS (Console)
1. **EC2** -> Launch instance: Ubuntu 22.04, t2.micro/t3.micro (free tier), create a key pair.
2. **Security Group** inbound: SSH (22) from *My IP*, HTTP (80) from anywhere.
3. SSH in, install Docker (same commands as above), copy the project, run `docker compose up -d --build`.
4. Open `http://<EC2-public-IP>`.
5. Extras that look good in a report:
   - **S3**: store exported CSV reports (create bucket, attach an IAM role to the EC2 instance).
   - **CloudWatch**: view CPU utilisation and set an alarm at 70%.
   - **ALB + Auto Scaling Group** (optional): health check path `/api/health`.
   - **Stop/terminate the instance** when done to avoid charges.

## 4. CloudSim peak-load simulation
1. Download CloudSim 3.0.3 and note the path of `cloudsim-3.0.3.jar`.
2. From the `cloudsim/` folder:
```bash
# Linux / macOS
javac -cp cloudsim-3.0.3.jar AttendanceSimulation.java
java  -cp .:cloudsim-3.0.3.jar AttendanceSimulation
# Windows: use ; instead of :   (java -cp .;cloudsim-3.0.3.jar AttendanceSimulation)
```
(Or add the jar to the build path in Eclipse / IntelliJ and run the class.)

It prints a table of average response time, makespan and cost for 100/500/1000 students
across 2/5/10 VMs with time-shared vs space-shared scheduling. Plot it in Excel for the report,
then use it to justify your EC2 instance size / Auto Scaling settings.

## Production notes (mention in viva)
- Open registration is demo-only; restrict faculty/admin creation to admins.
- Set a strong `JWT_SECRET` (copy `.env.example` to `.env`).
- Add HTTPS (ALB + ACM certificate) and move MongoDB to a managed service (DocumentDB / Atlas).
