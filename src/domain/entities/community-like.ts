export interface CommunityLikeProps {
  id: string;
  postId: string;
  userId: string;
  createdAt: Date;
}

export class CommunityLike {
  constructor(public readonly props: CommunityLikeProps) {}

  get id(): string { return this.props.id; }
  get postId(): string { return this.props.postId; }
  get userId(): string { return this.props.userId; }
  get createdAt(): Date { return this.props.createdAt; }
}
