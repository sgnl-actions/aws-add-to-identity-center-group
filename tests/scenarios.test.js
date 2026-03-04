import { runScenarios } from '@sgnl-actions/testing';

// Disable AWS SDK retries — nock's socket-level behavior can trigger
// spurious retries that exhaust the single-use interceptors.
process.env.AWS_MAX_ATTEMPTS = '1';

runScenarios({
  script: './src/script.mjs',
  scenarios: './tests/scenarios.yaml',
  includeCommon: false
});
