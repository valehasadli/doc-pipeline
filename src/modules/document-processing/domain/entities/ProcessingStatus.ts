/**
 * Processing Status Value Object
 * 
 * Encapsulates the current processing status of a document with
 * metadata about transitions, timing, and error information.
 */

import { DocumentStatus, isValidStatusTransition, InvalidStatusTransitionError } from '../enums/DocumentStatus';

/**
 * Status change metadata
 */
export interface IStatusChange {
  readonly fromStatus: DocumentStatus | null;
  readonly toStatus: DocumentStatus;
  readonly timestamp: Date;
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Processing status value object
 */
export class ProcessingStatus {
  private constructor(
    private readonly _currentStatus: DocumentStatus,
    private readonly _statusHistory: readonly IStatusChange[],
    private readonly _lastUpdated: Date,
    private readonly _errorDetails?: string,
    private readonly _retryCount: number = 0,
    private readonly _processingStartedAt?: Date,
    private readonly _processingCompletedAt?: Date
  ) {}

  /**
   * Create initial processing status
   */
  public static create(initialStatus: DocumentStatus = DocumentStatus.UPLOADED): ProcessingStatus {
    const now = new Date();
    const initialChange: IStatusChange = {
      fromStatus: null,
      toStatus: initialStatus,
      timestamp: now,
      reason: 'Document created',
    };

    return new ProcessingStatus(
      initialStatus,
      [initialChange],
      now,
      undefined,
      0,
      initialStatus === DocumentStatus.PROCESSING_OCR ? now : undefined
    );
  }

  /**
   * Create processing status from existing data
   */
  public static fromData(data: {
    currentStatus: DocumentStatus;
    statusHistory: IStatusChange[];
    lastUpdated: Date;
    errorDetails?: string;
    retryCount?: number;
    processingStartedAt?: Date;
    processingCompletedAt?: Date;
  }): ProcessingStatus {
    return new ProcessingStatus(
      data.currentStatus,
      data.statusHistory,
      data.lastUpdated,
      data.errorDetails,
      data.retryCount ?? 0,
      data.processingStartedAt,
      data.processingCompletedAt
    );
  }

  /**
   * Transition to a new status
   */
  public transitionTo(
    newStatus: DocumentStatus,
    reason?: string,
    metadata?: Record<string, unknown>
  ): ProcessingStatus {
    // Validate transition
    if (!isValidStatusTransition(this._currentStatus, newStatus)) {
      throw new InvalidStatusTransitionError(this._currentStatus, newStatus);
    }

    const now = new Date();
    const statusChange: IStatusChange = {
      fromStatus: this._currentStatus,
      toStatus: newStatus,
      timestamp: now,
      ...(reason !== undefined && reason.length > 0 ? { reason } : {}),
      ...(metadata && { metadata }),
    };

    const newHistory = [...this._statusHistory, statusChange];
    
    // Update processing timestamps
    let processingStartedAt = this._processingStartedAt;
    let processingCompletedAt = this._processingCompletedAt;
    
    // Set processing start time when entering first processing state
    if (!processingStartedAt && newStatus === DocumentStatus.PROCESSING_OCR) {
      processingStartedAt = now;
    }
    
    // Set processing completion time when reaching terminal success state
    if (newStatus === DocumentStatus.COMPLETED) {
      processingCompletedAt = now;
    }

    // Clear error details on successful transition (unless transitioning to error state)
    const errorDetails = this.isErrorStatus(newStatus) ? this._errorDetails : undefined;

    return new ProcessingStatus(
      newStatus,
      newHistory,
      now,
      errorDetails,
      this._retryCount,
      processingStartedAt,
      processingCompletedAt
    );
  }

  /**
   * Add error details to current status
   */
  public withError(errorDetails: string): ProcessingStatus {
    return new ProcessingStatus(
      this._currentStatus,
      this._statusHistory,
      this._lastUpdated,
      errorDetails,
      this._retryCount,
      this._processingStartedAt,
      this._processingCompletedAt
    );
  }

  /**
   * Increment retry count
   */
  public incrementRetryCount(): ProcessingStatus {
    return new ProcessingStatus(
      this._currentStatus,
      this._statusHistory,
      this._lastUpdated,
      this._errorDetails,
      this._retryCount + 1,
      this._processingStartedAt,
      this._processingCompletedAt
    );
  }

  // Getters
  public get currentStatus(): DocumentStatus {
    return this._currentStatus;
  }

  public get statusHistory(): readonly IStatusChange[] {
    return this._statusHistory;
  }

  public get lastUpdated(): Date {
    return this._lastUpdated;
  }

  public get errorDetails(): string | undefined {
    return this._errorDetails;
  }

  public get retryCount(): number {
    return this._retryCount;
  }

  public get processingStartedAt(): Date | undefined {
    return this._processingStartedAt;
  }

  public get processingCompletedAt(): Date | undefined {
    return this._processingCompletedAt;
  }

  // Status checks
  public isProcessing(): boolean {
    return this.isProcessingStatus(this._currentStatus);
  }

  public isCompleted(): boolean {
    return this._currentStatus === DocumentStatus.COMPLETED;
  }

  public isFailed(): boolean {
    return this.isErrorStatus(this._currentStatus);
  }

  public isTerminal(): boolean {
    return this.isTerminalStatus(this._currentStatus);
  }

  public hasErrors(): boolean {
    return this._errorDetails !== undefined;
  }

  // Utility methods
  public getProcessingDuration(): number | null {
    if (!this._processingStartedAt) {
      return null;
    }
    
    const endTime = this._processingCompletedAt ?? new Date();
    return endTime.getTime() - this._processingStartedAt.getTime();
  }

  public getLastIStatusChange(): IStatusChange | null {
    return this._statusHistory[this._statusHistory.length - 1] ?? null;
  }

  public getIStatusChangesForStage(stage: string): IStatusChange[] {
    return this._statusHistory.filter(change => {
      const changeStage = this.getProcessingStageFromStatus(change.toStatus);
      return changeStage === stage;
    });
  }

  public getTimeSinceLastUpdate(): number {
    return new Date().getTime() - this._lastUpdated.getTime();
  }

  // Private helper methods
  private isProcessingStatus(status: DocumentStatus): boolean {
    return [
      DocumentStatus.PROCESSING_OCR,
      DocumentStatus.PROCESSING_VALIDATION,
      DocumentStatus.PROCESSING_PERSISTENCE,
    ].includes(status);
  }

  private isErrorStatus(status: DocumentStatus): boolean {
    return [
      DocumentStatus.OCR_FAILED,
      DocumentStatus.VALIDATION_FAILED,
      DocumentStatus.PERSISTENCE_FAILED,
      DocumentStatus.FAILED,
      DocumentStatus.DEAD_LETTER,
    ].includes(status);
  }

  private isTerminalStatus(status: DocumentStatus): boolean {
    return [
      DocumentStatus.COMPLETED,
      DocumentStatus.FAILED,
      DocumentStatus.DEAD_LETTER,
    ].includes(status);
  }

  private getProcessingStageFromStatus(status: DocumentStatus): string | null {
    switch (status) {
      case DocumentStatus.PROCESSING_OCR:
      case DocumentStatus.OCR_COMPLETED:
      case DocumentStatus.OCR_FAILED:
        return 'ocr';
      
      case DocumentStatus.PROCESSING_VALIDATION:
      case DocumentStatus.VALIDATION_COMPLETED:
      case DocumentStatus.VALIDATION_FAILED:
        return 'validation';
      
      case DocumentStatus.PROCESSING_PERSISTENCE:
      case DocumentStatus.PERSISTENCE_FAILED:
        return 'persistence';
      
      case DocumentStatus.COMPLETED:
        return 'completed';
      
      default:
        return null;
    }
  }

  // Serialization
  public toJSON(): {
    currentStatus: DocumentStatus;
    statusHistory: IStatusChange[];
    lastUpdated: string;
    errorDetails?: string;
    retryCount: number;
    processingStartedAt?: string;
    processingCompletedAt?: string;
  } {
    const result: {
      currentStatus: DocumentStatus;
      statusHistory: IStatusChange[];
      lastUpdated: string;
      errorDetails?: string;
      retryCount: number;
      processingStartedAt?: string;
      processingCompletedAt?: string;
    } = {
      currentStatus: this._currentStatus,
      statusHistory: [...this._statusHistory],
      lastUpdated: this._lastUpdated.toISOString(),
      retryCount: this._retryCount,
    };

    if (this._errorDetails !== undefined && this._errorDetails.length > 0) {
      result.errorDetails = this._errorDetails;
    }
    if (this._processingStartedAt) {
      result.processingStartedAt = this._processingStartedAt.toISOString();
    }
    if (this._processingCompletedAt) {
      result.processingCompletedAt = this._processingCompletedAt.toISOString();
    }

    return result;
  }

  public equals(other: ProcessingStatus): boolean {
    return (
      this._currentStatus === other._currentStatus &&
      this._statusHistory.length === other._statusHistory.length &&
      this._lastUpdated.getTime() === other._lastUpdated.getTime() &&
      this._errorDetails === other._errorDetails &&
      this._retryCount === other._retryCount
    );
  }
}

// Type alias for cleaner name (backward compatibility)
export type StatusChange = IStatusChange;
