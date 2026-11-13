/*
 * Shared code used by every page to talk to the Java backend.
 *
 * How the frontend and backend are connected:
 *   page (HTML form) --fetch()--> REST API (http://localhost:8080/api/...) --> Java classes --> data files
 * Data travels both ways as JSON.
 */

// If the site is opened from the Java server (port 8080) the API is on the same address.
// If it is opened some other way (for example VS Code Live Server on port 5500)
// the API is on http://localhost:8080.
   const API_BASE = (location.protocol === 'file:' || location.port === '5500') ? 'http://localhost:8080' : '';

/* ---------- login details (kept until the browser tab is closed) ---------- */

function saveLogin(data) {
    try { sessionStorage.setItem('sharebiteLogin', JSON.stringify(data)); } catch (e) { /* storage blocked */ }
}

function getLogin() {
    try { return JSON.parse(sessionStorage.getItem('sharebiteLogin')); } catch (e) { return null; }
}

function clearLogin() {
    try { sessionStorage.removeItem('sharebiteLogin'); } catch (e) { /* storage blocked */ }
}

/** For pages that need a login: sends visitors who are not logged in to the login page. */
function requireLogin() {
    const login = getLogin();
    if (!login || !login.token) {
        location.replace('login.html');
        return null;
    }
    return login;
}

/* ---------- calling the API ---------- */

/**
 * Sends a request to the backend and returns the JSON reply.
 *   method: 'GET' or 'POST'      path: for example '/api/donations'      data: object to send (POST only)
 * If the server answers with an error, this throws an Error with the server's
 * message (error.fields holds the per-field problems, if any).
 */
async function apiRequest(method, path, data) {
    const options = { method: method, headers: {} };
    if (data !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(data);
    }
    const login = getLogin();
    if (login && login.token) {
        options.headers['Authorization'] = 'Bearer ' + login.token;
    }

    // Give up if the server does not answer in 10 seconds.
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), 10000);
    options.signal = timeout.signal;

    let response;
    try {
        response = await fetch(API_BASE + path, options);
    } catch (e) {
        throw new Error('Could not reach the ShareBite server. Make sure the backend is running, '
            + 'then open the site from http://localhost:8080 and try again.');
    } finally {
        clearTimeout(timer);
    }

    let reply = {};
    try { reply = await response.json(); } catch (e) { /* reply had no JSON */ }

    if (response.status === 401 && login) {
        // Login expired: forget it and ask the user to log in again.
        clearLogin();
        location.replace('login.html');
    }
    if (!response.ok) {
        const error = new Error(reply.message || 'Something went wrong. Please try again.');
        error.fields = reply.errors || null;
        throw error;
    }
    return reply;
}

/* ---------- small helpers for forms ---------- */

/** Reads every named input of a form into an object: { donorName: '...', plates: '20', ... } */
function formToObject(form) {
    const data = {};
    new FormData(form).forEach((value, key) => { data[key] = value; });
    return data;
}

/** Shows a message in the page's message box. type: 'success', 'error' or 'info'. */
function showMessage(text, type) {
    const box = document.getElementById('msg');
    if (!box) return;
    box.textContent = text;              // textContent, so text is never treated as HTML
    box.className = 'form-msg show ' + (type || 'info');
    box.scrollIntoView({ block: 'nearest' });
}

/** Marks the fields the server rejected and writes the reason under each one. */
function showFieldErrors(form, fields) {
    clearFieldErrors(form);
    if (!fields) return;
    Object.keys(fields).forEach((name) => {
        const input = form.elements[name];
        if (!input) return;
        input.classList.add('invalid');
        const note = document.createElement('span');
        note.className = 'field-error';
        note.textContent = fields[name];
        input.insertAdjacentElement('afterend', note);
    });
}

function clearFieldErrors(form) {
    form.querySelectorAll('.field-error').forEach((n) => n.remove());
    form.querySelectorAll('.invalid').forEach((n) => n.classList.remove('invalid'));
}

/**
 * Runs an action while the button is disabled, so a double click cannot send
 * the same form twice. The button shows "Please wait..." meanwhile.
 */
async function withButtonLocked(button, action) {
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'Please wait...';
    try {
        await action();
    } finally {
        button.disabled = false;
        button.textContent = label;
    }
}

/**
 * Connects a simple form to one API address.
 * Used by the donor, receiver, volunteer and contact pages.
 */
function connectForm(form, path, onSuccess) {
    form.addEventListener('submit', (event) => {
        event.preventDefault();          // stop the browser from reloading the page
        const button = form.querySelector('button[type="submit"]');
        withButtonLocked(button, async () => {
            try {
                const reply = await apiRequest('POST', path, formToObject(form));
                clearFieldErrors(form);
                onSuccess(reply);
            } catch (error) {
                showFieldErrors(form, error.fields);
                showMessage(error.message, 'error');
            }
        });
    });
}

/** Date inputs: do not allow dates before today. */
function blockPastDates() {
    const now = new Date();
    const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
        + '-' + String(now.getDate()).padStart(2, '0');
    document.querySelectorAll('input[type="date"]').forEach((input) => { input.min = today; });
}

/** Logout button in the top bar of the logged-in pages. */
document.addEventListener('DOMContentLoaded', () => {
    const logout = document.getElementById('logoutBtn');
    if (!logout) return;
    logout.addEventListener('click', async () => {
        try { await apiRequest('POST', '/api/auth/logout'); } catch (e) { /* log out locally anyway */ }
        clearLogin();
        location.href = 'login.html';
    });
});
