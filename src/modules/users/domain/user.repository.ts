import { Role } from '../../../shared/domain/role.enum';
import { Page, PageRequest } from '../../../shared/application/pagination';
import { LoginFailureState, User } from './user';

export interface UserSearchCriteria {
  role?: Role;
}

// Persistence port for users. Other modules depend on this interface, never on TypeORM.
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  insert(user: User): Promise<void>;
  search(criteria: UserSearchCriteria, page: PageRequest): Promise<Page<User>>;
  // Atomically counts one more wrong password and locks the account once lockAfter is reached,
  // so concurrent attempts cannot slip past the threshold.
  recordFailedLogin(id: string, lockAfter: number, now: Date): Promise<LoginFailureState>;
  // Resets the counter and lifts any lock (successful sign-in or admin unlock).
  clearLoginFailures(id: string): Promise<void>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
