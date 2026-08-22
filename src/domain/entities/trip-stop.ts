export interface TripStopProps {
  id: string;
  tripId: string;
  cityId?: string | null;
  customPlaceName?: string | null;
  sequenceOrder: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  description?: string | null;
  budgetAmount?: string | null;
  lockVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export class TripStop {
  constructor(public readonly props: TripStopProps) {}

  get id(): string { return this.props.id; }
  get tripId(): string { return this.props.tripId; }
  get cityId(): string | null | undefined { return this.props.cityId; }
  get customPlaceName(): string | null | undefined { return this.props.customPlaceName; }
  get sequenceOrder(): number { return this.props.sequenceOrder; }
  get startDate(): string { return this.props.startDate; }
  get endDate(): string { return this.props.endDate; }
  get description(): string | null | undefined { return this.props.description; }
  get budgetAmount(): string | null | undefined { return this.props.budgetAmount; }
  get lockVersion(): number { return this.props.lockVersion; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
}
