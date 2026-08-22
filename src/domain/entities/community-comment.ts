export interface CommunityCommentProps {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export class CommunityComment {
  constructor(public readonly props: CommunityCommentProps) {}

  get id(): string { return this.props.id; }
  get postId(): string { return this.props.postId; }
  get userId(): string { return this.props.userId; }
  get content(): string { return this.props.content; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get deletedAt(): Date | null | undefined { return this.props.deletedAt; }
}
