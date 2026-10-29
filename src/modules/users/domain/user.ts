import { Role } from '../../../shared/domain/role.enum';

// Platform user (an internal operator: admin, reviewer or sales).
// The password hash is held here but is never serialised into API responses or logs.
export interface UserProps {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  passwordHash: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  private constructor(private readonly props: UserProps) {}

  static create(props: UserProps): User {
    return new User({ ...props, email: User.normaliseEmail(props.email) });
  }

  // Rebuilds a user from persistence without re-running creation rules.
  static restore(props: UserProps): User {
    return new User(props);
  }

  static normaliseEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  get id(): string {
    return this.props.id;
  }
  get email(): string {
    return this.props.email;
  }
  get fullName(): string {
    return this.props.fullName;
  }
  get role(): Role {
    return this.props.role;
  }
  get passwordHash(): string {
    return this.props.passwordHash;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // Only active reviewers can be assigned to applications.
  canReview(): boolean {
    return this.props.isActive && this.props.role === Role.REVIEWER;
  }

  // Guards against accidental serialisation of the password hash.
  toJSON(): Omit<UserProps, 'passwordHash'> {
    const { passwordHash: _passwordHash, ...safe } = this.props;
    return safe;
  }
}
