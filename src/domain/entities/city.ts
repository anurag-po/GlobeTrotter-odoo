export interface CityProps {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  region?: string | null;
  costIndex?: number | null;
  popularityScore: number;
  latitude?: number | null;
  longitude?: number | null;
  imageUrl?: string | null;
  description?: string | null;
  externalSource?: string | null;
  externalRefId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class City {
  constructor(public readonly props: CityProps) {}

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get country(): string { return this.props.country; }
  get countryCode(): string { return this.props.countryCode; }
  get region(): string | null | undefined { return this.props.region; }
  get costIndex(): number | null | undefined { return this.props.costIndex; }
  get popularityScore(): number { return this.props.popularityScore; }
  get latitude(): number | null | undefined { return this.props.latitude; }
  get longitude(): number | null | undefined { return this.props.longitude; }
  get imageUrl(): string | null | undefined { return this.props.imageUrl; }
  get description(): string | null | undefined { return this.props.description; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
}
