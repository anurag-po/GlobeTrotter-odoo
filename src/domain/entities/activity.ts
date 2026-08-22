export interface ActivityProps {
  id: string;
  cityId: string;
  name: string;
  description?: string | null;
  category: string;
  costEstimate?: string | null;
  currencyCode: string;
  durationMinutes?: number | null;
  imageUrl?: string | null;
  popularityScore: number;
  externalSource?: string | null;
  externalRefId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Activity {
  constructor(public readonly props: ActivityProps) {}

  get id(): string { return this.props.id; }
  get cityId(): string { return this.props.cityId; }
  get name(): string { return this.props.name; }
  get description(): string | null | undefined { return this.props.description; }
  get category(): string { return this.props.category; }
  get costEstimate(): string | null | undefined { return this.props.costEstimate; }
  get currencyCode(): string { return this.props.currencyCode; }
  get durationMinutes(): number | null | undefined { return this.props.durationMinutes; }
  get imageUrl(): string | null | undefined { return this.props.imageUrl; }
  get popularityScore(): number { return this.props.popularityScore; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
}
