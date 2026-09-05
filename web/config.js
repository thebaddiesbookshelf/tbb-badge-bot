

require('dotenv').config();

module.exports = {
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL
  },
  mongoUri: process.env.MONGO_URI,
  sessionSecret: process.env.SESSION_SECRET,
  staffUserIds: process.env.STAFF_USER_IDS ? process.env.STAFF_USER_IDS.split(',') : [],
  port: process.env.PORT || 3000
};

