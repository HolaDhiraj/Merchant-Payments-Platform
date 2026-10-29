import { Logger } from '@nestjs/common';

// Keeps test output readable; expected warnings (simulated outages etc.) are not printed.
// Set TEST_LOGS=1 to see application logs while debugging a failing test.
if (process.env.TEST_LOGS !== '1') {
  Logger.overrideLogger(false);
}
