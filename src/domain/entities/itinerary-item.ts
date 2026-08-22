export type CostCategory = 'transport' | 'stay' | 'activity' | 'meal' | 'other';

export interface ItineraryItemProps {
  id: string;
  tripStopId: string;
  activityId?: string | null;
  customName?: string | null;
  costCategory: CostCategory;
  itemDate: string; // YYYY-MM-DD
  startTime?: Date | null;
  endTime?: Date | null;
  cost: string; // decimal string
  currencyCode: string;
  sequenceOrder: number;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ItineraryItem {
  constructor(public readonly props: ItineraryItemProps) {}

  get id(): string { return this.props.id; }
  get tripStopId(): string { return this.props.tripStopId; }
  get activityId(): string | null | undefined { return this.props.activityId; }
  get customName(): string | null | undefined { return this.props.customName; }
  get costCategory(): CostCategory { return this.props.costCategory; }
  get itemDate(): string { return this.props.itemDate; }
  get startTime(): Date | null | undefined { return this.props.startTime; }
  get endTime(): Date | null | undefined { return this.props.endTime; }
  get cost(): string { return this.props.cost; }
  get currencyCode(): string { return this.props.currencyCode; }
  get sequenceOrder(): number { return this.props.sequenceOrder; }
  get notes(): string | null | undefined { return this.props.notes; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
}
