# VIRA – Women's Safety App 

VIRA is a women's safety application designed to provide quick emergency assistance through SOS alerts, live location sharing, and emergency contact notification.  
The project focuses on real-life safety situations where immediate help is required.
## Features
- One-tap SOS alert
- Live GPS location sharing
- Emergency contact notification
- Local incident logging
- Simple and user-friendly interface
## Technologies Used

### Frontend
- HTML
- CSS
- JavaScript
### Backend
- Node.js
- Express.js
- PHP (for database testing)
### Database
- MySQL  
- Database Name: **VIRA**
### APIs & Tools
- Twilio API (for emergency calls and SMS)
- dotenv (for environment variable management)
## Project Structure
VIRA-Women-Safety-App/
├── app.js
├── server.js
├── config.js
├── index.html
├── dbtest.php
├── .gitignore
├── .env.example
├── package.json
├── package-lock.json
├── README.md
## 🔐 Environment & Security
Sensitive information such as database credentials and Twilio API keys are stored in environment variables using a `.env` file.

For security reasons:
- `.env` is **not uploaded** to GitHub
- `.gitignore` is used to exclude secrets, dependencies, logs, and OS-generated files

This follows industry-level secure development practices.
## ▶️ How to Run the Project Locally
1. Clone the repository
2. Navigate to the project folder
3. Install dependencies:
   ```bash
   npm install


