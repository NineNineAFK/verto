const axios = require('axios');

const ENV = process.env.PHONEPE_ENV === 'PROD' ? 'PROD' : 'UAT';
const BASE_URL = ENV === 'PROD'
  ? 'https://api.phonepe.com/apis/pg'
  : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

const AUTH_URL = ENV === 'PROD'
  ? 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token'
  : 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token';

let accessToken = null;
let expiresAt = null;

async function fetchAccessToken(){
  const res = await axios.post(AUTH_URL,
    new URLSearchParams({
      client_id: process.env.PHONEPE_CLIENT_ID,
      client_secret: process.env.PHONEPE_CLIENT_SECRET,
      client_version: '1',
      grant_type: 'client_credentials'
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  accessToken = res.data.access_token;
  expiresAt = res.data.expires_at;
  return accessToken;
}

// Improved wrapper to fetch token with error details
async function fetchAccessTokenWithLogging(){
  try {
    return await fetchAccessToken();
  } catch (err) {
    console.error('Failed to fetch PhonePe access token:', err.response ? (err.response.data || err.response.statusText) : err.message);
    throw err;
  }
}

async function getToken(){
  const now = Math.floor(Date.now() / 1000);
  if (!accessToken || !expiresAt || now >= expiresAt - 120) {
    await fetchAccessTokenWithLogging();
  }
  return accessToken;
}

module.exports = { BASE_URL, getToken };
