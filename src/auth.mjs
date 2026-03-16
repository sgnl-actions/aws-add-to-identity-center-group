import { STSClient, AssumeRoleWithWebIdentityCommand } from '@aws-sdk/client-sts';
import { getClientCredentialsToken } from '@sgnl-actions/utils';

/**
 * Returns an AWS credential provider from action auth params.
 * Use either params.basic (access key + secret) or params.clientCredentials with awsConfig (OAuth2 + AssumeRoleWithWebIdentity).
 *
 * @param {Object} params - auth from the action request (basic or clientCredentials (including clientCredentials.awsConfig)
 * @returns {Promise<Function>} Credential provider; call `await provider()` to get `{ accessKeyId, secretAccessKey, sessionToken?, expiration? }`
 */
export async function getAwsCredentials(params) {
  if (params.clientCredentials?.awsConfig) {
    // AWS Credential Identity Provider
    return getWebIdentityCredentialsProvider(params.clientCredentials);
  }

  if (params.basic) {
    // Static credentials; sync function so caller can await provider() and get the object
    return () => ({
      accessKeyId: params.basic.username,
      secretAccessKey: params.basic.password
    });
  }

  throw new Error('auth must provide either Basic credentials or OAuth2 with AWS AssumeRoleWebIdentity');
}


async function getWebIdentityCredentialsProvider(clientCredentials) {
  const { tokenUrl, clientId, clientSecret, scope, awsConfig, audience, authStyle } = clientCredentials;
  const { roleArn, sessionName, sessionDuration, region } = awsConfig;

  const webIdentityToken = await getClientCredentialsToken({ tokenUrl, clientId, clientSecret, scope, audience, authStyle });

  const stsClient = new STSClient({ region });

  const resp = await stsClient.send(new AssumeRoleWithWebIdentityCommand({
    RoleArn: roleArn,
    RoleSessionName: sessionName,
    DurationSeconds: parseSessionDurationSeconds(sessionDuration) || 3600,
    WebIdentityToken: webIdentityToken
  }));

  if (!resp.Credentials) {
    throw new Error('Failed to assume AWS role with web identity');
  }

  const c = resp.Credentials;

  return {
    accessKeyId: c.AccessKeyId,
    secretAccessKey: c.SecretAccessKey,
    sessionToken: c.SessionToken,
    expiration: c.Expiration
  };
}

function parseSessionDurationSeconds(durationRaw) {
  let durationSeconds;
  if (durationRaw !== undefined) {
    const parsed = Number(durationRaw);
    if (!Number.isNaN(parsed) && parsed > 0) {
      durationSeconds = parsed;
    }
  }
  return durationSeconds;
}
