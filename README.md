# ShareBite

ShareBite is a surplus food distribution website. It connects **food donors**, **NGOs / food receivers** and **volunteers** so that extra food reaches people who need it instead of being wasted.

College project: HTML/CSS/JavaScript frontend, connected through a REST API to a Java backend, which stores its data in MySQL using JDBC.

**Live site:** https://sharebite-u9z1.onrender.com

(Hosted on a free server that sleeps when unused, so the first visit can take about a minute to load.)

## How it works

```
Browser (frontend)                     Java server (backend)                  Database
HTML form  --fetch(), JSON-->   REST API  /api/...   -->  Java classes  --JDBC-->  MySQL
           <--JSON reply---                                             <--rows---
```

1. The user fills a form, for example the Food Donor form.
2. JavaScript (`frontend/js`) reads the form and sends it as JSON to an API address such as `POST /api/donations`.
3. The Java server checks the data, saves it in MySQL with a JDBC `PreparedStatement`, and replies with JSON.
4. JavaScript shows a success or error message on the page.

The web server uses only classes that come with the JDK (`com.sun.net.httpserver`), so there is no Maven or Gradle. The one extra file is the MySQL JDBC driver jar in `backend/lib/`.

## Project structure

```
sharebite/
├── frontend/                 HTML, CSS and JavaScript (what the user sees)
│   ├── index.html            Home page
│   ├── login.html  signin.html  forgot_password.html
│   ├── food-donor.html  food-receiver.html  volunteers.html
│   ├── dashboard.html        Lists donations and food requests (GET requests)
│   ├── contact.html  privacy.html  terms.html  404.html
│   ├── css/                  app.css (shared), contact.css
│   └── js/
│       ├── api.js            Shared code: fetch() calls, login token, messages
│       └── login.js, signin.js, food-donor.js ...   one small file per page
├── backend/
│   ├── src/sharebite/        Java source code
│   ├── database/             schema.sql (tables the backend creates) and sharbitedatabase.sql (original design)
│   ├── lib/                  MySQL JDBC driver (run.bat downloads it the first time)
│   ├── db.properties.example Database settings template (copy to db.properties)
│   ├── run.bat               Start on Windows
│   └── run.sh                Start on macOS / Linux
└── docs/
    └── ShareBite_console_version.java    The first, console-only version of the backend
```

### Backend classes

| Class | What it does |
|-------|--------------|
| `ShareBiteServer` | Primary class. Starts the server, lists the API routes, serves the frontend files, CORS, rate limit |
| `SignIn` | Send OTP, verify OTP, create account |
| `Login` | Login, logout, current user |
| `ForgetPassword` | Set a new password after OTP verification |
| `Donor` | Save and list food donations |
| `Receiver` | Save and list food requests |
| `Volunteer` | Save volunteer registrations |
| `Contact` | Save contact messages |
| `Database` | JDBC code: connects to MySQL and runs every INSERT, SELECT and UPDATE |
| `Form` | Checks form values on the server (`validateInfo`) |
| `Otp` | Creates and checks 6-digit OTPs |
| `Mailer` | Sends the OTP email through SMTP (Gmail) |
| `Sessions` | Remembers who is logged in (login tokens) |
| `Passwords` | Hashes passwords (PBKDF2), so plain passwords are never stored |
| `Json` | Small JSON reader / writer |
| `Reply`, `ApiException` | The reply or error sent back to the browser |

## How to run

You need:

- **JDK 17 or newer**. Check with `java -version`.
- **MySQL 8** running on this computer (port 3306).

One-time setup: the first time you run `run.bat`, it asks for your MySQL password and saves it in `backend/db.properties` (you can also create that file by hand from `db.properties.example`). It also downloads the MySQL JDBC driver into `backend/lib`. The backend then creates the `sharebite` database and its tables by itself.

**Windows:** double-click `backend/run.bat`, or in a terminal:

```
cd backend
run.bat
```

**macOS / Linux:**

```
cd backend
./run.sh
```

Or by hand, from the `backend` folder:

```
javac -cp "lib/*" -d out src/sharebite/*.java
java -cp "out;lib/*" sharebite.ShareBiteServer
```

(On macOS / Linux use `out:lib/*` with a colon.)

Then open **http://localhost:8080** in the browser. The Java server serves the website and the API together.

> Do not open the HTML files by double-clicking them (`file://...`). The browser blocks API calls from such pages. Use http://localhost:8080, or VS Code Live Server (port 5500), which the backend allows through CORS.

## REST API

All requests and replies are JSON. Protected routes need the header `Authorization: Bearer <token>`; the token comes from login or signup.

| Method | Address | Login needed | Purpose |
|--------|---------|:---:|---------|
| GET | `/api/health` | No | Check that the server is running |
| POST | `/api/auth/otp/send` | No | Send an OTP. Body: `email`, `purpose` (`SIGNUP` or `RESET`) |
| POST | `/api/auth/otp/verify` | No | Verify an OTP. Body: `email`, `purpose`, `otp` |
| POST | `/api/auth/signup` | No | Create an account. Body: `name`, `email`, `phone`, `password`, `service` |
| POST | `/api/auth/login` | No | Log in. Body: `email`, `password`. Reply contains `token` |
| POST | `/api/auth/reset-password` | No | Set a new password. Body: `email`, `newPassword` |
| POST | `/api/auth/logout` | Yes | Log out |
| GET | `/api/auth/me` | Yes | Details of the logged-in user |
| POST | `/api/donations` | Yes | Save a food donation |
| GET | `/api/donations` | Yes | Latest 50 donations |
| POST | `/api/requests` | Yes | Save a food request |
| GET | `/api/requests` | Yes | Latest 50 food requests |
| POST | `/api/volunteers` | Yes | Register as a volunteer |
| GET | `/api/volunteers/me` | Yes | The logged-in user's own volunteer registrations |
| POST | `/api/contact` | No | Send a contact message |

Status codes used: `200` OK, `201` created, `400` wrong input, `401` not logged in, `404` not found, `409` email already registered, `429` too many requests, `500` server error.

Example error reply:

```json
{
  "message": "Please correct the highlighted details and try again.",
  "errors": { "confirmAddress": "The two pickup addresses do not match." }
}
```

Try it from a terminal:

```
curl http://localhost:8080/api/health
curl -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"you@example.com\",\"password\":\"yourpassword\"}"
```

## Database (JDBC)

Tables: `users`, `food_donor`, `food_receiver`, `volunteers`, `contact_messages`. The full structure is in `backend/database/schema.sql`.

`Database.java` holds the list that maps each form field to its column, for example `donorName` → `donor_name` and `plates` → `food_plates`.

All database code is in `Database.java` and follows the standard JDBC steps:

```java
Connection connection = DriverManager.getConnection(url, user, password);
PreparedStatement statement = connection.prepareStatement(
        "SELECT * FROM users WHERE email = ? LIMIT 1");
statement.setString(1, email);
ResultSet result = statement.executeQuery();
```

Values are always passed with `?` and `setString()`, never joined into the SQL text, which prevents SQL injection.

To look at the data, open MySQL Workbench and run for example:

```sql
USE sharebite;
SELECT * FROM food_donor;
```

## OTP

**Email mode:** if `backend/mail.properties` exists, the OTP is emailed to the address typed in the form. `Mailer.java` sends it through Gmail's SMTP server over an encrypted connection. To set it up, copy `mail.properties.example` to `mail.properties` and fill in a Gmail address and a Gmail app password (not the normal password).

**Demo mode:** if `mail.properties` does not exist, the OTP is shown on the page and printed in the server console, so the project can be run without any email account.

In both modes an OTP is valid for 5 minutes, allows 5 wrong attempts, and a new one can be requested after 30 seconds.

## Settings

Database settings are in `backend/db.properties`. Optional environment variables (see `.env.example`): `PORT`, `CORS_ALLOWED_ORIGINS`, `OTP_DEMO_MODE`, and `DB_URL`, `DB_USER`, `DB_PASSWORD` (these override `db.properties`).

## Online hosting

The live site runs without any personal computer:

| Part | Where it runs |
|------|---------------|
| Java backend + frontend | [Render](https://render.com) free web service, built from this repository with the `Dockerfile` |
| MySQL database | [Aiven](https://aiven.io) cloud MySQL |
| OTP emails | Gmail SMTP |

Every push to the `main` branch rebuilds and redeploys the site automatically.

Passwords are never stored in the repository. On Render they are set as environment variables:

| Variable | Purpose |
|----------|---------|
| `DB_URL`, `DB_USER`, `DB_PASSWORD` | Connection to the cloud MySQL database (JDBC) |
| `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_PORT` | Gmail account and app password used to send OTP emails |
| `OTP_DEMO_MODE=false` | Never show the OTP on the page |
| `TRUST_PROXY=true` | Read the visitor's real IP from Render's proxy (used by the rate limit) |

## Security points

- Passwords are stored as salted PBKDF2 hashes, never as plain text.
- Every form is checked again on the server, not only in the browser.
- Protected routes need a login token; the user id always comes from the token, never from the request body.
- User text is shown with `textContent`, so it cannot run as HTML or script (XSS).
- CORS allows only the listed origins.
- Login, OTP and form routes are rate limited (30 POST requests per minute per IP); an OTP expires in 5 minutes and after 5 wrong attempts.
- Only files inside `frontend/` can be served (no `../` path tricks).
- All SQL uses `PreparedStatement` with `?` placeholders (no SQL injection).
- The database password is kept in `backend/db.properties`, which is in `.gitignore`, so it is never uploaded.

## Limits of this version

- The backend connects as the MySQL user in `db.properties`. A real deployment should use a separate MySQL user that can only access the `sharebite` database, not `root`.
- Logins and OTPs are kept in memory, so restarting the server logs everyone out.
- It runs over plain HTTP on localhost. A public deployment needs HTTPS.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
