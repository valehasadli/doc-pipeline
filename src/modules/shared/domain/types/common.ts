/**
 * Shared domain types used across multiple modules
 */

export interface IEntity {
  readonly id: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface IValueObject {
  equals(other: IValueObject): boolean;
}

export interface IAggregateRoot extends IEntity {
  readonly version: number;
  getUncommittedEvents(): IDomainEvent[];
  markEventsAsCommitted(): void;
}

export interface IDomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly eventVersion: number;
  readonly occurredAt: Date;
  readonly eventData: Record<string, unknown>;
}

export interface IRepository<T extends IAggregateRoot> {
  findById(id: string): Promise<T | null>;
  save(aggregate: T): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface IUseCase<TRequest, TResponse> {
  execute(request: TRequest): Promise<TResponse>;
}


