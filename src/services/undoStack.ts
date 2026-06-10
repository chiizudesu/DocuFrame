import { toaster, getErrorMessageFromUnknown } from '../components/ui/toaster'

/**
 * Session-wide undo stack for file operations (rename, move, duplicate, prefix...).
 * Operations register an inverse callback; Ctrl+Z in the FileGrid or the toast's
 * Undo button pops and runs the most recent one. Delete/trash is intentionally
 * not undoable here — restore-from-recycle-bin is out of scope.
 */

export interface UndoableOperation {
  /** Past-tense summary shown in the toast, e.g. `Renamed "a.pdf" to "b.pdf"` */
  description: string
  undo: () => Promise<void>
}

const MAX_UNDO_ENTRIES = 10
const stack: UndoableOperation[] = []
let undoInFlight = false

/**
 * Record a completed operation. By default also shows a success toast with an
 * Undo action; pass `toast: false` when the caller shows its own feedback.
 */
export function pushUndoableOperation(op: UndoableOperation, options?: { toast?: boolean }): void {
  stack.push(op)
  if (stack.length > MAX_UNDO_ENTRIES) stack.shift()
  if (options?.toast !== false) {
    toaster.create({
      title: op.description,
      type: 'success',
      duration: 5000,
      // Must equal the toaster group placement or Ark renders nothing (see toaster.tsx)
      placement: 'top',
      action: {
        label: 'Undo',
        onClick: () => {
          void undoLastOperation()
        },
      },
    })
  }
}

export async function undoLastOperation(): Promise<boolean> {
  if (undoInFlight) return false
  const op = stack.pop()
  if (!op) return false
  undoInFlight = true
  try {
    await op.undo()
    toaster.create({
      title: `Undone: ${op.description}`,
      type: 'info',
      duration: 3000,
      placement: 'top',
    })
    return true
  } catch (error) {
    toaster.create({
      title: 'Undo failed',
      description: getErrorMessageFromUnknown(error),
      type: 'error',
      duration: 6000,
      placement: 'top',
    })
    return false
  } finally {
    undoInFlight = false
  }
}

export function hasUndoableOperation(): boolean {
  return stack.length > 0
}
