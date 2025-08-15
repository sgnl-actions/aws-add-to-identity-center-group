import { IdentitystoreClient, GetUserIdCommand, CreateGroupMembershipCommand } from '@aws-sdk/client-identitystore';

class RetryableError extends Error {
  constructor(message) {
    super(message);
    this.retryable = true;
  }
}

class FatalError extends Error {
  constructor(message) {
    super(message);
    this.retryable = false;
  }
}

async function getUserIdFromUsername(client, identityStoreId, userName) {
  const command = new GetUserIdCommand({
    IdentityStoreId: identityStoreId,
    AlternateIdentifier: {
      UniqueAttribute: {
        AttributePath: 'userName',
        AttributeValue: userName
      }
    }
  });

  try {
    const response = await client.send(command);
    return response.UserId;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      throw new FatalError(`User not found: ${userName}`);
    }
    if (error.name === 'ThrottlingException' || error.name === 'ServiceUnavailableException') {
      throw new RetryableError(`AWS service temporarily unavailable: ${error.message}`);
    }
    throw new FatalError(`Failed to get user ID for ${userName}: ${error.message}`);
  }
}

async function addUserToGroup(client, identityStoreId, groupId, userId) {
  const command = new CreateGroupMembershipCommand({
    IdentityStoreId: identityStoreId,
    GroupId: groupId,
    MemberId: {
      UserId: userId
    }
  });

  try {
    const response = await client.send(command);
    return response.MembershipId;
  } catch (error) {
    if (error.name === 'ConflictException') {
      // User is already in the group
      console.log('User is already a member of the group');
      return 'existing';
    }
    if (error.name === 'ResourceNotFoundException') {
      throw new FatalError(`Group not found: ${groupId}`);
    }
    if (error.name === 'ThrottlingException' || error.name === 'ServiceUnavailableException') {
      throw new RetryableError(`AWS service temporarily unavailable: ${error.message}`);
    }
    throw new FatalError(`Failed to add user to group: ${error.message}`);
  }
}

function validateInputs(params) {
  if (!params.userName || typeof params.userName !== 'string' || params.userName.trim() === '') {
    throw new FatalError('Invalid or missing userName parameter');
  }

  if (!params.identityStoreId || typeof params.identityStoreId !== 'string' || params.identityStoreId.trim() === '') {
    throw new FatalError('Invalid or missing identityStoreId parameter');
  }

  if (!params.groupId || typeof params.groupId !== 'string' || params.groupId.trim() === '') {
    throw new FatalError('Invalid or missing groupId parameter');
  }

  if (!params.region || typeof params.region !== 'string' || params.region.trim() === '') {
    throw new FatalError('Invalid or missing region parameter');
  }
}

export default {
  invoke: async (params, context) => {
    console.log('Starting AWS Add to Identity Center Group action');

    try {
      validateInputs(params);

      const { userName, identityStoreId, groupId, region } = params;

      console.log(`Processing user: ${userName} for group: ${groupId}`);

      if (!context.secrets?.AWS_ACCESS_KEY_ID || !context.secrets?.AWS_SECRET_ACCESS_KEY) {
        throw new FatalError('Missing required AWS credentials in secrets');
      }

      // Create AWS Identity Store client
      const client = new IdentitystoreClient({
        region: region,
        credentials: {
          accessKeyId: context.secrets.AWS_ACCESS_KEY_ID,
          secretAccessKey: context.secrets.AWS_SECRET_ACCESS_KEY
        }
      });

      // Get user ID from username
      console.log(`Resolving user ID for username: ${userName}`);
      const userId = await getUserIdFromUsername(client, identityStoreId, userName);
      console.log(`Resolved user ID: ${userId}`);

      // Add user to group
      console.log(`Adding user ${userId} to group ${groupId}`);
      const membershipId = await addUserToGroup(client, identityStoreId, groupId, userId);

      const result = {
        userName,
        groupId,
        userId,
        membershipId: membershipId === 'existing' ? 'already-member' : membershipId,
        added: membershipId !== 'existing',
        addedAt: new Date().toISOString()
      };

      if (membershipId === 'existing') {
        console.log(`User ${userName} was already a member of group ${groupId}`);
      } else {
        console.log(`Successfully added user ${userName} to group ${groupId}`);
      }

      return result;

    } catch (error) {
      console.error(`Error adding user to group: ${error.message}`);

      if (error instanceof RetryableError || error instanceof FatalError) {
        throw error;
      }

      throw new FatalError(`Unexpected error: ${error.message}`);
    }
  },

  error: async (params, _context) => {
    const { error } = params;
    console.error(`Error handler invoked: ${error?.message}`);

    // Re-throw to let framework handle retries
    throw error;
  },

  halt: async (params, _context) => {
    const { reason, userName, groupId } = params;
    console.log(`Job is being halted (${reason})`);

    return {
      userName: userName || 'unknown',
      groupId: groupId || 'unknown',
      reason: reason || 'unknown',
      haltedAt: new Date().toISOString(),
      cleanupCompleted: true
    };
  }
};