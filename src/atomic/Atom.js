import {
  without,
  clone,
} from 'ramda'

export class Atom {
  constructor(defaultValue = null) {
    this.value = defaultValue
    this.watchers = []
  }

  deref() {
    return this.value
  }

  reset(newValue) {
    const oldValue = clone(this.value)
    this.value = clone(newValue)

    this.watchers.forEach((watcher) => {
      watcher(newValue, oldValue)
    })

    return this
  }

  swap(updateFn, ...args) {
    return this.reset(updateFn(this.value, ...args))
  }

  watch(callback) {
    this.watchers = this.watchers.concat(callback)

    return () => {
      this.watchers = without([callback], this.watchers)
    }
  }
}
