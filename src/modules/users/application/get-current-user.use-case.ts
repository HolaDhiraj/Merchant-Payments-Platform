import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '../../../shared/domain/actor';
import { EntityNotFoundError } from '../../../shared/domain/domain-errors';
import { User } from '../domain/user';
import { USER_REPOSITORY, UserRepository } from '../domain/user.repository';

// Returns the profile of the authenticated caller, so clients never have to decode the token.
@Injectable()
export class GetCurrentUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(actor: Actor): Promise<User> {
    const user = await this.users.findById(actor.userId);
    if (!user) {
      throw new EntityNotFoundError('User', actor.userId);
    }
    return user;
  }
}
