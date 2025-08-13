import type { IValueObject } from '@/modules/shared/domain/types/common';

/**
 * Base value object implementation with equality comparison
 */
export abstract class ValueObject implements IValueObject {
  public equals(other: IValueObject): boolean {
    if (this === other) {
      return true;
    }

    if (!(other instanceof this.constructor)) {
      return false;
    }

    return this.isEqual(other as ValueObject);
  }

  protected abstract isEqual(other: ValueObject): boolean;

  protected getEqualityComponents(): unknown[] {
    return Object.values(this);
  }

  protected compareArrays(a: unknown[], b: unknown[]): boolean {
    if (a.length !== b.length) {
      return false;
    }

    return a.every((value, index) => {
      const otherValue = b[index];
      
      if (value instanceof ValueObject && otherValue instanceof ValueObject) {
        return value.equals(otherValue);
      }
      
      return value === otherValue;
    });
  }
}
