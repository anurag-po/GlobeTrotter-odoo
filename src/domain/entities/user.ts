export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'suspended' | 'deactivated';

export interface UserProps {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  city?: string | null;
  country?: string | null;
  additionalInfo?: string | null;
  photoUrl?: string | null;
  languagePreference: string;
  role: UserRole;
  status: UserStatus;
  hasVerifiedEmail: boolean;
  notificationPreferences: Record<string, unknown>;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export class User {
  constructor(public readonly props: UserProps) {}

  get id(): string { return this.props.id; }
  get username(): string { return this.props.username; }
  get email(): string { return this.props.email; }
  get passwordHash(): string { return this.props.passwordHash; }
  get firstName(): string { return this.props.firstName; }
  get lastName(): string { return this.props.lastName; }
  get phoneNumber(): string | null | undefined { return this.props.phoneNumber; }
  get city(): string | null | undefined { return this.props.city; }
  get country(): string | null | undefined { return this.props.country; }
  get additionalInfo(): string | null | undefined { return this.props.additionalInfo; }
  get photoUrl(): string | null | undefined { return this.props.photoUrl; }
  get languagePreference(): string { return this.props.languagePreference; }
  get role(): UserRole { return this.props.role; }
  get status(): UserStatus { return this.props.status; }
  get hasVerifiedEmail(): boolean { return this.props.hasVerifiedEmail; }
  get notificationPreferences(): Record<string, unknown> { return this.props.notificationPreferences; }
  get lastLoginAt(): Date | null | undefined { return this.props.lastLoginAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get deletedAt(): Date | null | undefined { return this.props.deletedAt; }

  isActive(): boolean {
    return this.props.status === 'active' && !this.props.deletedAt;
  }

  isSuspended(): boolean {
    return this.props.status === 'suspended';
  }

  isAdmin(): boolean {
    return this.props.role === 'admin';
  }
}
