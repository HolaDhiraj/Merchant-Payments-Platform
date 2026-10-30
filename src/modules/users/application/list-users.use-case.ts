import { Inject, Injectable } from '@nestjs/common';
import { Page, PageRequest } from '../../../shared/application/pagination';
import { User } from '../domain/user';
import { USER_REPOSITORY, UserRepository, UserSearchCriteria } from '../domain/user.repository';

// Lists platform users, optionally by role (ADMIN only, enforced at the controller).
// Used to pick a reviewer when assigning applications.
@Injectable()
export class ListUsersUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  execute(criteria: UserSearchCriteria, page: PageRequest): Promise<Page<User>> {
    return this.users.search(criteria, page);
  }
}
