import script from '../src/script.mjs';
import { runScenarios } from '@sgnl-actions/testing';

// Disable AWS SDK retries — nock's socket-level behavior can trigger
// spurious retries that exhaust the single-use interceptors.
process.env.AWS_MAX_ATTEMPTS = '1';

runScenarios({
  script: './src/script.mjs',
  scenarios: './tests/scenarios.yaml',
  includeCommon: false
});

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