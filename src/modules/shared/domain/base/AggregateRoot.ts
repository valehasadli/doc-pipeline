import { v4 as uuidv4 } from 'uuid';

import type { IAggregateRoot, IDomainEvent } from '@/modules/shared/domain/types/common';

/**
 * Base aggregate root implementation with event sourcing capabilities
 */
export abstract class AggregateRoot implements IAggregateRoot {
  public readonly id: string;
  public readonly createdAt: Date;
  public updatedAt: Date;
  public readonly version: number;

  private readonly uncommittedEvents: IDomainEvent[] = [];

  protected constructor(
    id?: string,
    createdAt?: Date,
    updatedAt?: Date,
    version: number = 1
  ) {
    this.id = id ?? uuidv4();
    this.createdAt = createdAt ?? new Date();
    this.updatedAt = updatedAt ?? new Date();
    this.version = version;
  }

  public getUncommittedEvents(): IDomainEvent[] {
    return [...this.uncommittedEvents];
  }

  public markEventsAsCommitted(): void {
    this.uncommittedEvents.length = 0;
  }

  protected addDomainEvent(event: IDomainEvent): void {
    this.uncommittedEvents.push(event);
  }

  protected createDomainEvent(
    eventType: string,
    eventData: Record<string, unknown>
  ): IDomainEvent {
    return {
      eventId: uuidv4(),
      eventType,
      aggregateId: this.id,
      aggregateType: this.constructor.name,
      eventVersion: this.version,
      occurredAt: new Date(),
      eventData,
    };
  }
}
