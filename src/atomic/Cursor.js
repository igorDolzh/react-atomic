import { path, assocPath, equals } from 'ramda'
import { watch, deref, swap, reset } from './helpers'

export class Cursor {
  constructor(ref, cursorPath) {
    this.cursorPath = cursorPath
    this.ref = ref
  }

  deref() {
    return path(this.cursorPath, deref(this.ref))
  }

  reset(newValue) {
    return swap(this.ref, assocPath(this.cursorPath, newValue))
  }

  swap(updateFn, ...args) {
    const currentValue = deref(this)
    return reset(this, updateFn(currentValue, ...args))
  }

  watch(callback) {
    return watch(this.ref, (newValue, oldValue) => {
      const cursorNewValue = path(this.cursorPath, newValue)
      const cursorOldValue = path(this.cursorPath, oldValue)

      if (!equals(cursorNewValue, cursorOldValue)) {
        callback(cursorNewValue, cursorOldValue)
      }
    })
  }
}
