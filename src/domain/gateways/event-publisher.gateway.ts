export interface DomainEvent<T = unknown> {
  readonly type: string;
  readonly data: T;
}

export interface EventPublisher {
  publish<T>(event: DomainEvent<T>): Promise<void>;
}
