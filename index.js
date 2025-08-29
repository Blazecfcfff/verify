const express = require('express');
const session = require('express-session');
const axios = require('axios');

const app = express();
const port = 3000; // hardcoded port

// Hardcoded credentials and IDs
const CLIENT_ID = '1368394210331594782';
const CLIENT_SECRET = 'HNycC4_-WBITzHDsxa5hFWSbhbVfKAKk';
const REDIRECT_URI = `http://localhost:${port}/callback`; // Update if deployed
const GUILD_ID = '1410517436956151830';
const ROLE_ID = '1410878436544614502';
const SESSION_SECRET = 'your-session-secret';

// Session config
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

// Shared CSS style
const style = `
  body {
    background-color: #111;
    color: white;
    font-family: 'Segoe UI', sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
  }

  .card {
    background-color: #1a1a1a;
    border: 1px solid #1e90ff;
    padding: 2rem;
    border-radius: 12px;
    text-align: center;
    max-width: 400px;
  }

  .button {
    background-color: #1e90ff;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    border-radius: 8px;
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
    margin-top: 1rem;
    transition: background-color 0.3s ease;
  }

  .button:hover {
    background-color: #187bcd;
  }

  .loader {
    border: 8px solid #333;
    border-top: 8px solid #1e90ff;
    border-radius: 50%;
    width: 60px;
    height: 60px;
    animation: spin 1s linear infinite;
    margin: 20px auto;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .fade-in {
    animation: fadeIn 2s ease-in-out;
  }

  @keyframes fadeIn {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }
`;

// Home page
app.get('/', (req, res) => {
  const user = req.session.user;

  res.send(`
    <html>
      <head>
        <title>Discord Verification</title>
        <style>${style}</style>
      </head>
      <body>
        <div class="card fade-in">
          ${!user ? `
            <h2>Welcome to the AllyCore Verifier</h2>
            <p>Click below to verify yourself and get access.</p>
            <a class="button" href="/login">Login with Discord</a>
          ` : `
            <h2>Verified In AllyCore!</h2>
            <p>Welcome, ${user.username}#${user.discriminator}</p>
            <p>You’ve been assigned the role.</p>
          `}
        </div>
      </body>
    </html>
  `);
});

// Verifying screen
app.get('/verifying', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Verifying...</title>
        <style>${style}</style>
      </head>
      <body>
        <div class="card fade-in">
          <h2>Verifying your Discord...</h2>
          <div class="loader"></div>
          <p>Please wait while we finish the verification process.</p>
        </div>
        <script>
          setTimeout(() => {
            window.location.href = "/";
          }, 3000);
        </script>
      </body>
    </html>
  `);
});

// Login with Discord
app.get('/login', (req, res) => {
  const scope = 'identify guilds.join';
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${scope}`;
  res.redirect(url);
});

// Callback after Discord login
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send('No code provided');

  try {
    // Exchange code for access token
    const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      scope: 'identify guilds.join'
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const access_token = tokenRes.data.access_token;

    // Get user info
    const userRes = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const user = userRes.data;
    req.session.user = user;

    // Add user to guild
    await axios.put(`https://discord.com/api/guilds/${GUILD_ID}/members/${user.id}`, {
      access_token: access_token
    }, {
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    // Get current roles of the user
    const memberRes = await axios.get(`https://discord.com/api/guilds/${GUILD_ID}/members/${user.id}`, {
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`
      }
    });

    const currentRoles = memberRes.data.roles || [];

    // Assign role if missing
    if (!currentRoles.includes(ROLE_ID)) {
      await axios.put(`https://discord.com/api/guilds/${GUILD_ID}/members/${user.id}/roles/${ROLE_ID}`, {}, {
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`
        }
      });
    }

    res.redirect('/verifying');
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);

    let message = 'An error occurred.';
    if (err.response?.data?.message) {
      message = `Error: ${err.response.data.message}`;
    }

    res.send(`<h2>${message}</h2><p><a href="/">Return home</a></p>`);
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server ready at http://localhost:${port}`);
});
