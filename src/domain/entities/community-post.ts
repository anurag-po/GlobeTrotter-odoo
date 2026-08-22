export interface CommunityPostProps {
  id: string;
  userId: string;
  tripId?: string | null;
  content: string;
  attachmentUrls: string[];
  likeCount: number;
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export class CommunityPost {
  constructor(public readonly props: CommunityPostProps) {}

  get id(): string { return this.props.id; }
  get userId(): string { return this.props.userId; }
  get tripId(): string | null | undefined { return this.props.tripId; }
  get content(): string { return this.props.content; }
  get attachmentUrls(): string[] { return this.props.attachmentUrls; }
  get likeCount(): number { return this.props.likeCount; }
  get commentCount(): number { return this.props.commentCount; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get deletedAt(): Date | null | undefined { return this.props.deletedAt; }
}
