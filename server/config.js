require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://wodlhlwezckslounvmlx.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  MP_ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN || 'APP_USR-4480456642803254-111801-be3d1e41d0eb72ba4a94bcd81ee19496-16180848',
  ADMIN_EMAIL: 'jeffersonhelanbittencourt@gmail.com'
};
