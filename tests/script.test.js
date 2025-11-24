import script from '../src/script.mjs';

describe('AWS Add to Identity Center Group Script', () => {
  const mockContext = {
    env: {
      ENVIRONMENT: 'test'
    },
    secrets: {
      BASIC_USERNAME: 'test-access-key',
      BASIC_PASSWORD: 'test-secret-key'
    },
    outputs: {}
  };

  beforeEach(() => {
    // Mock console to avoid noise in tests
    global.console.log = () => {};
    global.console.error = () => {};
  });

  describe('invoke handler', () => {
    test('should throw error for missing userName', async () => {
      const params = {
        identityStoreId: 'd-1234567890',
        groupId: 'group-123',
        region: 'us-east-1'
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('Invalid or missing userName parameter');
    });

    test('should throw error for missing identityStoreId', async () => {
      const params = {
        userName: 'TestUser',
        groupId: 'group-123',
        region: 'us-east-1'
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('Invalid or missing identityStoreId parameter');
    });

    test('should throw error for missing groupId', async () => {
      const params = {
        userName: 'TestUser',
        identityStoreId: 'd-1234567890',
        region: 'us-east-1'
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('Invalid or missing groupId parameter');
    });

    test('should throw error for missing region', async () => {
      const params = {
        userName: 'TestUser',
        identityStoreId: 'd-1234567890',
        groupId: 'group-123'
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('Invalid or missing region parameter');
    });

    test('should throw error for missing AWS credentials', async () => {
      const params = {
        userName: 'TestUser',
        identityStoreId: 'd-1234567890',
        groupId: 'group-123',
        region: 'us-east-1'
      };

      const contextWithoutCreds = {
        ...mockContext,
        secrets: {}
      };

      await expect(script.invoke(params, contextWithoutCreds))
        .rejects.toThrow('Missing required credentials in secrets');
    });

    // Note: Testing actual AWS SDK calls would require mocking the SDK
    // or integration tests with real AWS credentials
  });

  describe('error handler', () => {
    test('should re-throw error for framework to handle', async () => {
      const params = {
        userName: 'TestUser',
        groupId: 'group-123',
        error: new Error('Network timeout')
      };

      await expect(script.error(params, mockContext))
        .rejects.toThrow('Network timeout');
    });
  });

  describe('halt handler', () => {
    test('should handle graceful shutdown', async () => {
      const params = {
        userName: 'TestUser',
        groupId: 'group-123',
        reason: 'timeout'
      };

      const result = await script.halt(params, mockContext);

      expect(result.userName).toBe('TestUser');
      expect(result.groupId).toBe('group-123');
      expect(result.reason).toBe('timeout');
      expect(result.haltedAt).toBeDefined();
      expect(result.cleanupCompleted).toBe(true);
    });

    test('should handle halt with missing params', async () => {
      const params = {
        reason: 'system_shutdown'
      };

      const result = await script.halt(params, mockContext);

      expect(result.userName).toBe('unknown');
      expect(result.groupId).toBe('unknown');
      expect(result.reason).toBe('system_shutdown');
      expect(result.cleanupCompleted).toBe(true);
    });
  });
});