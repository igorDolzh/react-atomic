import { map, without } from 'ramda'
import { watch, deref } from './helpers'

export class ComputedAtom {
  constructor(refs = [], compute) {
    this.refs = refs
    this.compute = compute
    const fireWatchers = () => this.watchers.forEach((watcher) => watcher())
    this.refs.forEach((ref) => watch(ref, fireWatchers))
    this.watchers = []
  }

  deref() {
    if (!this.cache) {
      this.cache = this.compute(...map(deref, this.refs))
    }

    return this.cache
  }

  reset() {
    return this
  }

  swap() {
    return this
  }

  watch(callback) {
    const computedCallback = () => {
      const oldValue = this.cache
      this.cache = this.compute(...map(deref, this.refs))
      const newValue = this.cache

      callback(newValue, oldValue)
    }

    this.watchers = this.watchers.concat(computedCallback)

    return () => {
      this.watchers = without([computedCallback], this.watchers)
    }
  }
}
