# ShareBite

ShareBite is a surplus food distribution website. It connects **food donors**, **NGOs / food receivers** and **volunteers** so that extra food reaches people who need it instead of being wasted.

College project by **Arfiya Malkani**: an HTML/CSS/JavaScript frontend, connected through a REST API to a Java backend, which stores its data in MySQL using JDBC.

**Live site:** https://sharebite-u9z1.onrender.com

(Hosted on a free server that sleeps when unused, so the first visit can take about a minute to load.)

## Features

- Sign up with email OTP verification, login, logout and password reset
- Food donors post surplus food with pickup address, date and time
- NGOs / food receivers request food for delivery
- Volunteers register to pick up and deliver food
- Dashboard listing the latest donations and food requests
- Contact form, privacy policy and terms pages

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
SHAREBITE/
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
│   ├── db.properties.example Database settings template (run.bat creates db.properties)
│   ├── mail.properties.example Email settings template for OTP emails
│   ├── run.bat               Start on Windows
│   └── run.sh                Start on macOS / Linux
├── docs/
│   └── ShareBite_console_version.java    The first, console-only version of the backend
├── Dockerfile                Build recipe used for online hosting (Render)
└── LICENSE                   MIT License
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

## How to run on your computer

Get the code:

```
git clone https://github.com/malkaniarfiya/SHAREBITE.git
cd SHAREBITE
```

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

**Email mode:** when a Gmail account is set up, the OTP is emailed to the address typed in the form. `Mailer.java` connects to Gmail's SMTP server on port 587 and switches the connection to encryption with STARTTLS. To set it up locally, copy `mail.properties.example` to `mail.properties` and fill in a Gmail address and a Gmail app password (not the normal password). Online, the same values are set as environment variables.

**Demo mode:** with no email account set up, the OTP is shown on the page and printed in the server console, so the project can be run without any email account.

On Windows, `run.bat` starts Java with the Windows certificate store, so sending email still works when antivirus software scans email connections.

In both modes an OTP is valid for 5 minutes, allows 5 wrong attempts, and a new one can be requested after 30 seconds.

## Settings

On a local computer, settings are read from `backend/db.properties` and `backend/mail.properties` (both kept out of GitHub by `.gitignore`). Environment variables override them:

| Variable | Purpose |
|----------|---------|
| `DB_URL`, `DB_USER`, `DB_PASSWORD` | MySQL connection (JDBC) |
| `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_PORT`, `MAIL_HOST` | Gmail account used to send OTP emails |
| `OTP_DEMO_MODE` | `true` shows the OTP on the page when no email account is set up |
| `PORT` | Port the server listens on (default 8080) |
| `CORS_ALLOWED_ORIGINS` | Other addresses allowed to call the API |
| `TRUST_PROXY` | `true` behind a hosting proxy, so the rate limit sees each visitor's real IP |
| `FRONTEND_DIR` | Folder the website files are served from |

## Online hosting

The live site runs without any personal computer:

| Part | Where it runs |
|------|---------------|
| Java backend + frontend | [Render](https://render.com) free web service, built from this repository with the `Dockerfile` |
| MySQL database | [Aiven](https://aiven.io) cloud MySQL |
| OTP emails | Gmail SMTP |

Render builds the site from the `main` branch using the `Dockerfile`, which compiles the Java code and downloads the MySQL JDBC driver. The site is served over HTTPS and the database connection uses SSL.

Passwords are never stored in the repository. On Render they are set as the environment variables listed under Settings, with `OTP_DEMO_MODE=false` and `TRUST_PROXY=true`.

## Security points

- Passwords are stored as salted PBKDF2 hashes, never as plain text.
- Every form is checked again on the server, not only in the browser.
- Protected routes need a login token; the user id always comes from the token, never from the request body.
- User text is shown with `textContent`, so it cannot run as HTML or script (XSS).
- CORS allows only the listed origins.
- Login, OTP and form routes are rate limited (30 POST requests per minute per IP); an OTP expires in 5 minutes and after 5 wrong attempts.
- Only files inside `frontend/` can be served (no `../` path tricks).
- All SQL uses `PreparedStatement` with `?` placeholders (no SQL injection).
- Database and email passwords are kept in `db.properties` / `mail.properties` (in `.gitignore`) or in the host's environment variables, never in the repository.
- Security headers (Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) are sent with every response.

## Limits of this version

- Logins and OTPs are kept in memory, so restarting the server logs everyone out.
- The free hosting plan sleeps after 15 minutes without visitors; the next visit takes about a minute to load.
- The backend connects with the database's admin user. A larger deployment should use a separate MySQL user that can only access the `sharebite` database.
- There is no admin panel, and donors are not automatically matched to receivers.

## License

Copyright (c) 2026 Arfiya Malkani. This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
