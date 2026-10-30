import { Role } from '../../../shared/domain/role.enum';
import { Page, PageRequest } from '../../../shared/application/pagination';
import { User } from './user';

export interface UserSearchCriteria {
  role?: Role;
}

// Persistence port for users. Other modules depend on this interface, never on TypeORM.
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  insert(user: User): Promise<void>;
  search(criteria: UserSearchCriteria, page: PageRequest): Promise<Page<User>>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
