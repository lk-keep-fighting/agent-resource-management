import { OAuth2Client } from 'xuanwu-sso-sdk'

const ssoUrl = process.env.SSO_URL || 'http://localhost:3000'
const clientId = process.env.SSO_CLIENT_ID || 'agent-resource-management'
const clientSecret = process.env.SSO_CLIENT_SECRET || ''
const redirectUri = process.env.SSO_REDIRECT_URI || 'http://localhost:3001/api/auth/callback'

export const ssoClient = new OAuth2Client(
  {
    clientId,
    clientSecret,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
  },
  ssoUrl
)

export const ssoConfig = {
  ssoUrl,
  clientId,
  redirectUri,
}