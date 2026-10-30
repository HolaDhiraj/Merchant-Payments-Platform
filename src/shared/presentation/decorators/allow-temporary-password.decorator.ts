import { SetMetadata } from '@nestjs/common';

export const ALLOW_TEMPORARY_PASSWORD_KEY = 'allowTemporaryPassword';

// Marks the few routes a user with a temporary password may call (reading their profile and
// changing the password). Every other route answers 403 PASSWORD_CHANGE_REQUIRED until then.
export const AllowTemporaryPassword = () => SetMetadata(ALLOW_TEMPORARY_PASSWORD_KEY, true);
