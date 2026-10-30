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
  // Merchant users belong to exactly one merchant; platform staff have none.
  merchantId: string | null;
  // Set for temporary passwords: every route except changing it is refused until it is changed.
  mustChangePassword: boolean;
  // Consecutive wrong passwords since the last successful sign-in or unlock.
  failedLoginAttempts: number;
  // Set once failedLoginAttempts reaches the lockout threshold; cleared only by an admin.
  lockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NewUserProps = Omit<
  UserProps,
  'failedLoginAttempts' | 'lockedAt' | 'merchantId' | 'mustChangePassword'
> &
  Partial<Pick<UserProps, 'merchantId' | 'mustChangePassword'>>;

// Result of counting one more wrong password against an account.
export interface LoginFailureState {
  failedLoginAttempts: number;
  lockedAt: Date | null;
}

export class User {
  private constructor(private readonly props: UserProps) {}

  static create(props: NewUserProps): User {
    return new User({
      ...props,
      email: User.normaliseEmail(props.email),
      merchantId: props.merchantId ?? null,
      mustChangePassword: props.mustChangePassword ?? false,
      failedLoginAttempts: 0,
      lockedAt: null,
    });
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
  get merchantId(): string | null {
    return this.props.merchantId;
  }
  get mustChangePassword(): boolean {
    return this.props.mustChangePassword;
  }
  get failedLoginAttempts(): number {
    return this.props.failedLoginAttempts;
  }
  get lockedAt(): Date | null {
    return this.props.lockedAt;
  }
  get isLocked(): boolean {
    return this.props.lockedAt !== null;
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
