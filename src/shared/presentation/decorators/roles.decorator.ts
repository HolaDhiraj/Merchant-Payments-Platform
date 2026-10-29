import { SetMetadata } from '@nestjs/common';
import { Role } from '../../domain/role.enum';

export const ROLES_KEY = 'roles';

// Restricts a route to the given roles. Object-level rules are still enforced in the use case.
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
