export type TripStatus = 'draft' | 'planned' | 'ongoing' | 'completed' | 'cancelled';

export interface TripProps {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  coverPhotoUrl?: string | null;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: TripStatus;
  currencyCode: string;
  estimatedBudgetTotal: string; // decimal string
  primaryTimezone?: string | null;
  isPublic: boolean;
  shareToken?: string | null;
  sharedAt?: Date | null;
  copyCount: number;
  viewCount: number;
  sourceTripId?: string | null;
  lockVersion: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export class Trip {
  constructor(public readonly props: TripProps) {}

  get id(): string { return this.props.id; }
  get userId(): string { return this.props.userId; }
  get name(): string { return this.props.name; }
  get description(): string | null | undefined { return this.props.description; }
  get coverPhotoUrl(): string | null | undefined { return this.props.coverPhotoUrl; }
  get startDate(): string { return this.props.startDate; }
  get endDate(): string { return this.props.endDate; }
  get status(): TripStatus { return this.props.status; }
  get currencyCode(): string { return this.props.currencyCode; }
  get estimatedBudgetTotal(): string { return this.props.estimatedBudgetTotal; }
  get primaryTimezone(): string | null | undefined { return this.props.primaryTimezone; }
  get isPublic(): boolean { return this.props.isPublic; }
  get shareToken(): string | null | undefined { return this.props.shareToken; }
  get sharedAt(): Date | null | undefined { return this.props.sharedAt; }
  get copyCount(): number { return this.props.copyCount; }
  get viewCount(): number { return this.props.viewCount; }
  get sourceTripId(): string | null | undefined { return this.props.sourceTripId; }
  get lockVersion(): number { return this.props.lockVersion; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get deletedAt(): Date | null | undefined { return this.props.deletedAt; }

  isOwnedBy(userId: string): boolean {
    return this.props.userId === userId;
  }
}
