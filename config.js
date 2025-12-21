// config.js
// Centralized environment config + lightweight validation
require('dotenv').config(); // loads .env in development

const asBool = (v, def = false) => {
  if (v === undefined || v === null) return def;
  const s = String(v).trim().toLowerCase();
  return ['1','true','yes','on'].includes(s);
};

const get = (name, fallback = undefined) => {
  const v = process.env[name];
  return (v === undefined || v === '') ? fallback : v;
};

const config = {
  // Server
  port: Number(get('PORT', 4000)) || 4000,
  nodeEnv: get('NODE_ENV', 'production'),

  // Database (MySQL example)
  db: {
    host: get('DB_HOST', '127.0.0.1'),
    user: get('DB_USER', 'root'),
    pass: get('DB_PASS', ''), // allow blank for XAMPP default
    name: get('DB_NAME', 'safeguard_capstone'),
    // connection string helper (useful if you use a library that accepts URI)
    getConnectionUri() {
      // mysql://user:pass@host/db
      const auth = this.pass ? encodeURIComponent(this.user) + ':' + encodeURIComponent(this.pass) + '@' : encodeURIComponent(this.user) + '@';
      return `mysql://${auth}${this.host}/${this.name}`;
    }
  },

  // Twilio
  twilio: {
    accountSid: get('TWILIO_ACCOUNT_SID', ''),
    authToken: get('TWILIO_AUTH_TOKEN', ''),
    fromNumber: get('TWILIO_FROM_NUMBER', ''), // E.164 format
    enabled: asBool(get('ENABLE_TWILIO', ''), false)
  },

  // Feature flags
  features: {
    enableTwilio: asBool(get('ENABLE_TWILIO', get('TWILIO_ACCOUNT_SID') ? 'true' : 'false')),
  },

  // Misc
  logLevel: get('LOG_LEVEL', 'info')
};

// small validations & helpful warnings
if (config.features.enableTwilio) {
  if (!config.twilio.accountSid || !config.twilio.authToken || !config.twilio.fromNumber) {
    console.warn('⚠️ Twilio is enabled but one or more TWILIO_* variables are missing. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER in your .env or disable ENABLE_TWILIO.');
  }
}

module.exports = config;
