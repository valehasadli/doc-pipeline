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
  readonly occurredOn: Date;
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

export interface IQuery<TRequest, TResponse> {
  execute(request: TRequest): Promise<TResponse>;
}

export interface ICommand<TRequest, TResponse> {
  execute(request: TRequest): Promise<TResponse>;
}

export interface IEventHandler<T extends IDomainEvent> {
  handle(event: T): Promise<void>;
}

export interface IEventBus {
  publish(events: IDomainEvent[]): Promise<void>;
  subscribe<T extends IDomainEvent>(
    eventType: string,
    handler: IEventHandler<T>
  ): void;
}

export type Result<T, E = Error> = {
  readonly isSuccess: boolean;
  readonly isFailure: boolean;
  readonly value?: T;
  readonly error?: E;
};

export const Success = <T>(value: T): Result<T> => ({
  isSuccess: true,
  isFailure: false,
  value,
});

export const Failure = <T, E = Error>(error: E): Result<T, E> => ({
  isSuccess: false,
  isFailure: true,
  error,
});
