import { Atom } from './Atom'
import { Cursor } from './Cursor'
import { ComputedAtom } from './ComputedAtom'

export const atom = (defaultValue) => new Atom(defaultValue)
export const deref = (ref) => ref.deref()
export const reset = (ref, newValue) => ref.reset(newValue)
export const swap = (ref, updateFn, ...args) => ref.swap(updateFn, ...args)
export const watch = (ref, callback) => ref && ref.watch(callback)
export const watchOnce = (ref, callback) => {
  const cancel = watch(ref, (newValue, oldValue) => {
    cancel()
    callback(newValue, oldValue)
  })

  return cancel
}

export const cursor = (ref, cursorPath) => new Cursor(ref, cursorPath)

export const computed = (refs, compute) => new ComputedAtom(refs, compute)
