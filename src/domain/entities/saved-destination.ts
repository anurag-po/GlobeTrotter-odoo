export interface SavedDestinationProps {
  id: string;
  userId: string;
  cityId: string;
  createdAt: Date;
}

export class SavedDestination {
  constructor(public readonly props: SavedDestinationProps) {}

  get id(): string { return this.props.id; }
  get userId(): string { return this.props.userId; }
  get cityId(): string { return this.props.cityId; }
  get createdAt(): Date { return this.props.createdAt; }
}
