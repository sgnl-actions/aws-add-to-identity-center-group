# AWS Add to Identity Center Group Action

Add a user to an AWS Identity Center (SSO) group. This action is commonly used for provisioning access, onboarding users, or managing group memberships in AWS IAM Identity Center.

## Overview

This SGNL action integrates with the AWS Identity Store API to add users to Identity Center groups. When executed, the action resolves the user ID from their username and creates a group membership, enabling centralized access management through AWS IAM Identity Center.

## Prerequisites

- AWS IAM Identity Center configured
- Appropriate authentication credentials (Basic auth or OAuth2 with AssumeRoleWithWebIdentity)
- `identitystore:GetUserId` and `identitystore:CreateGroupMembership` permissions
- Identity Store ID and Group ID

## Configuration

### Required Secrets

The configured auth type will determine which secrets are needed:

- **Basic Authentication**: `BASIC_USERNAME` (AWS Access Key ID) and `BASIC_PASSWORD` (AWS Secret Access Key)
- **OAuth2 with AssumeRoleWithWebIdentity**: `OAUTH2_CLIENT_CREDENTIALS_CLIENT_SECRET`

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OAUTH2_CLIENT_CREDENTIALS_CLIENT_ID` | - | OAuth2 client ID |
| `OAUTH2_CLIENT_CREDENTIALS_TOKEN_URL` | - | OAuth2 token endpoint URL |
| `OAUTH2_CLIENT_CREDENTIALS_SCOPE` | - | OAuth2 scope (optional) |
| `OAUTH2_CLIENT_CREDENTIALS_AUDIENCE` | - | OAuth2 audience (optional) |
| `OAUTH2_CLIENT_CREDENTIALS_AUTH_STYLE` | - | OAuth2 auth style: `in_params` or `in_header` (optional) |
| `AWS_ASSUME_ROLE_WEB_IDENTITY_REGION` | - | AWS region for AssumeRoleWithWebIdentity |
| `AWS_ASSUME_ROLE_WEB_IDENTITY_ROLE_ARN` | - | ARN of the AWS role to assume |
| `AWS_ASSUME_ROLE_WEB_IDENTITY_SESSION_NAME` | Auto-generated | Session name for AssumeRoleWithWebIdentity |
| `AWS_ASSUME_ROLE_WEB_IDENTITY_SESSION_DURATION_SECONDS` | 3600 | Session duration in seconds (900-43200) |

### Input Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `userName` | string | Yes | Username of the user to add (from Identity Store) | `john.doe@example.com` |
| `identityStoreId` | string | Yes | AWS Identity Store ID | `d-1234567890` |
| `groupId` | string | Yes | AWS Identity Center group ID (UUID) | `810b05d1-10g1-70eb-8cee-61aa45188g92` |
| `region` | string | Yes | AWS region | `us-east-1` |

### Output Structure

| Field | Type | Description |
|-------|------|-------------|
| `userName` | string | Username that was added |
| `groupId` | string | Group ID the user was added to |
| `userId` | string | AWS Identity Store user ID (UUID) |
| `membershipId` | string | Membership ID (UUID) or `already-member` |
| `added` | boolean | `true` if newly added, `false` if already a member |
| `addedAt` | string | Timestamp of when the addition occurred (ISO 8601) |

## Usage Example

### Job Request

```json
{
  "id": "add-to-group-001",
  "type": "nodejs-20",
  "script": {
    "repository": "github.com/sgnl-actions/aws-add-to-identity-center-group",
    "version": "v1.0.0",
    "type": "nodejs"
  },
  "script_inputs": {
    "userName": "john.doe@example.com",
    "identityStoreId": "d-1234567890",
    "groupId": "810b05d1-10g1-70eb-8cee-61aa45188g92",
    "region": "us-east-1"
  }
}
```

### Successful Response (New Member)

```json
{
  "userName": "john.doe@example.com",
  "groupId": "810b05d1-10g1-70eb-8cee-61aa45188g92",
  "userId": "61eb35b0-f0c1-709d-750e-93b3da2e4a2d",
  "membershipId": "21fb65a0-50a1-702d-926d-3f5aec045b7b",
  "added": true,
  "addedAt": "2024-01-15T10:30:01Z"
}
```

### Response (Already a Member)

```json
{
  "userName": "john.doe@example.com",
  "groupId": "810b05d1-10g1-70eb-8cee-61aa45188g92",
  "userId": "61eb35b0-f0c1-709d-750e-93b3da2e4a2d",
  "membershipId": "already-member",
  "added": false,
  "addedAt": "2024-01-15T10:30:01Z"
}
```

## Authentication Methods

This action supports multiple authentication methods:

### 1. Basic Authentication (Static Credentials)
Use AWS Access Key ID and Secret Access Key directly:
```json
"secrets": {
  "BASIC_USERNAME": "AKIAIOSFODNN7EXAMPLE",
  "BASIC_PASSWORD": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
}
```

### 2. OAuth2 with AssumeRoleWithWebIdentity (Recommended)
Use OAuth2 Client Credentials flow to obtain an OIDC token, then assume an AWS role. This provides temporary credentials that are more secure:

```json
"secrets": {
  "OAUTH2_CLIENT_CREDENTIALS_CLIENT_SECRET": "your-client-secret"
},
"environment": {
  "OAUTH2_CLIENT_CREDENTIALS_CLIENT_ID": "your-client-id",
  "OAUTH2_CLIENT_CREDENTIALS_TOKEN_URL": "https://login.microsoftonline.com/tenant-id/oauth2/v2.0/token",
  "OAUTH2_CLIENT_CREDENTIALS_SCOPE": "api://aud/.default",
  "AWS_ASSUME_ROLE_WEB_IDENTITY_REGION": "us-east-1",
  "AWS_ASSUME_ROLE_WEB_IDENTITY_ROLE_ARN": "arn:aws:iam::123456789012:role/MyRole"
}
```

**How it works:**
1. Obtains OAuth2 access token using client credentials
2. Calls AWS STS `AssumeRoleWithWebIdentity` with the token
3. Receives temporary AWS credentials (access key, secret, session token)
4. Uses temporary credentials to call AWS Identity Store APIs

## Error Handling

The action includes comprehensive error handling:

### Successful Cases
- **200 OK**: User successfully added to group
- **409 Conflict**: User already in group (treated as success, `added: false`)

### Error Cases
- **ResourceNotFoundException (User)**: User not found in Identity Store
- **ResourceNotFoundException (Group)**: Group not found
- **InvalidClientTokenId**: Invalid AWS credentials
- **AccessDeniedException**: Insufficient permissions
- **ThrottlingException**: Rate limit exceeded (retryable)
- **ServiceUnavailableException**: AWS service temporarily unavailable (retryable)

## IAM Permissions Required

The AWS credentials (or assumed role) must have the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "identitystore:GetUserId",
        "identitystore:CreateGroupMembership"
      ],
      "Resource": "*"
    }
  ]
}
```

## Development

### Local Testing

```bash
# Install dependencies
npm install

# Run tests
npm test

# Test locally with mock data
npm run dev

# Build for production
npm run build
```

### Running Tests

The action includes comprehensive unit tests covering:
- Input validation (userName, identityStoreId, groupId, region)
- Successful user addition to group
- Both authentication methods (Basic and AssumeRoleWithWebIdentity)
- User already in group scenario
- Error handling (user not found, group not found, invalid credentials)

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Check test coverage
npm run test:coverage

# Validate metadata schema
npm run validate
```

## Security Considerations

- **Credential Protection**: Never log or expose AWS credentials or OAuth tokens
- **Audit Logging**: All group additions are logged with timestamps
- **Input Validation**: All parameters are validated before API calls
- **Temporary Credentials**: AssumeRoleWithWebIdentity provides time-limited credentials
- **Least Privilege**: Use IAM policies to restrict which groups can be modified
- **Idempotency**: Safe to retry - adding an existing member is not an error

## AWS API Reference

This action uses the following AWS Identity Store API endpoints:
- [GetUserId](https://docs.aws.amazon.com/singlesignon/latest/IdentityStoreAPIReference/API_GetUserId.html)
- [CreateGroupMembership](https://docs.aws.amazon.com/singlesignon/latest/IdentityStoreAPIReference/API_CreateGroupMembership.html)

And for AssumeRoleWithWebIdentity authentication:
- [AssumeRoleWithWebIdentity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithWebIdentity.html)

## Troubleshooting

### Common Issues

1. **"Invalid or missing userName parameter"**
   - Ensure the `userName` parameter is provided and is a non-empty string
   - Verify the username exists in your Identity Store

2. **"Invalid or missing identityStoreId parameter"**
   - Ensure the Identity Store ID is in the format `d-xxxxxxxxxx`
   - Verify you're using the correct Identity Store ID for your AWS organization

3. **"Invalid or missing groupId parameter"**
   - Ensure the group ID is a valid UUID
   - Verify the group exists in your Identity Center

4. **"User not found"**
   - Verify the username exists in the Identity Store
   - Check that you're using the correct username format (usually email)

5. **"Group not found"**
   - Verify the group ID is correct
   - Ensure the group exists in the same Identity Store

6. **Authentication Errors (AccessDeniedException)**
   - Verify your AWS credentials are valid and haven't expired
   - Ensure the credentials have `identitystore:GetUserId` and `identitystore:CreateGroupMembership` permissions
   - For AssumeRoleWithWebIdentity, verify the trust policy allows your OIDC provider

7. **"OAuth2ClientCredentials missing required AwsAssumeRoleWebIdentity configuration"**
   - When using OAuth2, you must provide AWS AssumeRoleWithWebIdentity environment variables
   - Ensure `AWS_ASSUME_ROLE_WEB_IDENTITY_REGION` and `AWS_ASSUME_ROLE_WEB_IDENTITY_ROLE_ARN` are set

8. **"Failed to assume AWS role with web identity"**
   - Verify the IAM role's trust policy allows your OIDC provider
   - Check that the OAuth2 token is valid and has the correct audience
   - Ensure the role ARN is correct

## Related Actions

- **[aws-revoke-session](https://github.com/sgnl-actions/aws-revoke-session)** - Revoke AWS IAM role sessions
- **[aws-revoke-user-access-tokens](https://github.com/sgnl-actions/aws-revoke-user-access-tokens)** - Revoke IAM user access keys

## License

MIT

## Support

For issues or questions, please contact SGNL Engineering or create an issue in this repository.