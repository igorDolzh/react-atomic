export class BasicAtom {
  constructor(atom) {
    this.atom = atom
  }

  get() {
    return this.atom
  }

  getValue() {
    return this.atom.deref()
  }

  setValue(newVal) {
    this.atom.reset(newVal)
    return this.getValue()
  }

  applyFunc(func) {
    this.atom.swap(func)
    return this.getValue()
  }

  setWatcher(callback) {
    this.atom.watch(callback)
    return this.getValue()
  }
}
