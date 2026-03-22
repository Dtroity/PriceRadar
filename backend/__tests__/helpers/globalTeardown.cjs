'use strict';

/**
 * Jest globalTeardown runs in the orchestrator process, not in workers where tests open pg pool.
 * Worker pools exit with the process; no shared pool to close here.
 */
module.exports = async function globalTeardown() {
  // eslint-disable-next-line no-console
  console.log('[test] Global teardown complete');
};
