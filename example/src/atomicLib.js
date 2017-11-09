import { assoc, assocPath, path, not, merge, pipe, isEmpty, map, isNil, dissoc, flatten, prepend, T, any, keys, forEach, intersection, all, is, apply } from 'ramda'
import { createElement, PureComponent } from 'react'
import { atom, watch, deref, reset, swap } from 'atom-observable'

let applyIf = (func, ...args) => is(Function, func) ? apply(func, args) : null

let isObjectEmpty = (obj) => {
  if (not(is(Object, obj))) {
    return false
  }
  let objKeys = keys(obj)
  return all((key) => {
    let val = obj[key]
    if (not(isEmpty(val)) && not(isNil(val))) {
      return isObjectEmpty(val)
    }
    return true
  }, objKeys)
}

export let loadingState = atom({})
export let errorState = atom({})

let runTaskFactory = ({ loading: loadingA, error: errorA, cancel: cancelA }) => (ref, task, options = {}) => {
  let { after, holdValue = false } = options

  let name = getCursorName(ref)
  let refValue = deref(ref)

  let runTaskFunc = () => {
    let cancelTask = task.run({
      success: (data) => {
        swap(loadingA, assoc(name, false))
        swap(cancelA, dissoc(name))
        reset(ref, data)
        applyIf(after, data)
      },

      failure: (error) => {
        swap(loadingA, assoc(name, false))
        swap(cancelA, dissoc(name))
        let data = path(['data'], error)
        swap(errorA, assoc(name, data || error))
      }
    })
    swap(cancelA, assoc(name, cancelTask))
  }

  if (not(refValue) || isObjectEmpty(refValue)) {
    swap(loadingA, assoc(name, true))
    runTaskFunc()
  } else if (not(holdValue)) {
    runTaskFunc()
  } else {
    applyIf(after, refValue)
  }
}

export let getFullCursorPath = (cursor) => {
  let { ref, cursorPath } = cursor
  if (!ref) {
    return []
  }
  return flatten(prepend(getFullCursorPath(ref), cursorPath))
}

let runTaskArrayFactory = (defaultSubs) => (sequence) => {
  forEach((args) => {
    runTaskFactory(defaultSubs)(...args)
  }, sequence)
}

export let getCursorName = (cursor) => getFullCursorPath(cursor).join('-')

let isLoadingFactory = ({loading}) => (cursor) => !!deref(loading)[getCursorName(cursor)]
let getErrorFactory = ({error}) => (cursor) => deref(error)[getCursorName(cursor)] || null

let Atomic = ({
  defaultState,
  defaultLoading,
  defaultError,
  defaultOptions,
  defaultSubs
}) =>
  ({
    subs,
    tasks,
    options: newOptions = {}
  },
  DumbComponent) =>
class Atomic extends PureComponent {

  state = {
    store: {},
    unsubs: {},
    loadingSubs: {},
    errorSubs: {},
    errorToShow: null,
    options: defaultOptions,
  }

  componentWillMount() {
    this.setWatchers()
    this.setOptions()
    this.setErrorWatcher()
  }

  componentDidMount() {
    applyIf(tasks, {
      props: this.props,
      state: this.state
    })
  }

  componentWillUnmount() {
    this.unSubscribeWatchers()
    this.resetOnUnMount()
    this.clearErrors()
    this.cancelTasks()
  }

  setOptions() {
    this.setState({
      options: merge(defaultOptions, newOptions)
    })
  }

  setWatchers() {
    let subsObj = merge(defaultSubs, subs({
      props: this.props,
      state: this.state
    }))
    let subsKeys = keys(subsObj)

    let { store } = this.state
    let unsubs = {}
    let loadingSubs = {}
    let errorSubs = {}

    forEach((key) => {
      store = assoc(key, deref(subsObj[key]), store)
      loadingSubs = assoc(getCursorName(subsObj[key]), true, loadingSubs)
      errorSubs = assoc(getCursorName(subsObj[key]), true, errorSubs)

      let unsub = watch(subsObj[key], (newVal) => {
        this.setState((prevState) => ({
          store: assoc(key, newVal, prevState.store)
        }))
      })

      unsubs[key] = unsub
    }, subsKeys)

    this.setState({
      store,
      unsubs,
      loadingSubs,
      errorSubs,
    })
  }

  setErrorWatcher() {
    let options = merge(defaultOptions, newOptions)
    if (options.showErrorScreen) {
      let unsub = watch(defaultSubs.error, () => {
        this.getError()
      })

      this.setState((prevState) => ({
        unsubs: assoc('errorSub', unsub, prevState.unsubs)
      }))
    }
  }

  getError() {
    let { errorSubs } = this.state
    let errorSubsKeys = keys(errorSubs)
    let errorState = deref(defaultSubs.error)
    let errorToShow = null

    forEach((key) => {
      if (errorState[key] && !errorToShow) {
        errorToShow = errorState[key]
      }
    }, errorSubsKeys)

    if (errorToShow) {
      this.setState({
        errorToShow
      })
    }
  }

  unSubscribeWatchers() {
    let { unsubs } = this.state
    let unSubsKeys = keys(unsubs)
    forEach((key) => { applyIf(unsubs[key]) }, unSubsKeys)
  }

  resetOnUnMount() {
    let { options } = this.state
    let { resetOnUnMount } = options
    forEach((cursor) => {
      let cursorPath = getFullCursorPath(cursor)
      reset(cursor, path(cursorPath, defaultState))
    }, resetOnUnMount)
  }

  clearErrors() {
    let { errorSubs } = this.state
    let errorSubsKeys = keys(errorSubs)
    let errorState = deref(defaultSubs.error)
    forEach((key) => {
      if (errorState[key]) {
        errorState = assoc(key, null, errorState)
      }
    }, errorSubsKeys)
    reset(defaultSubs.error, errorState)
  }

  cancelTasks() {
    let { loadingSubs } = this.state
    let cancelState = deref(defaultSubs.cancel)
    let cancelStateKeys = keys(cancelState)
    let loadingSubsKeys = keys(loadingSubs)

    let cancelStateSubsKeys = intersection(cancelStateKeys, loadingSubsKeys)

    forEach((key) => applyIf(cancelState[key]), cancelStateSubsKeys)
  }

  isLoading() {
    let { loadingSubs, options } = this.state
    let loadingState = deref(defaultSubs.loading)
    let loadingSubsKeys = keys(loadingSubs)
    return any((sub) => loadingState[sub], loadingSubsKeys) && options.waitForAllTasks
  }

  isError() {
    let { errorToShow, options } = this.state
    return errorToShow && options.showErrorScreen && defaultError
  }

  renderError() {
    let { errorToShow, options } = this.state
    let defaultOnContinue = () => {
      reset(defaultSubs.error, {})
      this.setState({errorToShow: null})
      applyIf(tasks)
    }
    return defaultError(errorToShow, options.onErrorContinue || defaultOnContinue)
  }

  renderLoading() {
    return (this.state.options.showDefaultPreloader && defaultLoading) ? defaultLoading() : null
  }

  render() {
    if (this.isError()) {
      return this.renderError()
    }

    if (this.isLoading()) {
      return this.renderLoading()
    }

    return createElement(DumbComponent, merge(this.props, this.state.store))
  }

}

let buildAtomic = ({
  defaultState,
  defaultLoading,
  defaultError,
  defaultOptions,
  defaultSubs = {
    loading: loadingState,
    error: errorState
  }
}) => ({
  SubsAtoms: Atomic({
    defaultState,
    defaultLoading,
    defaultError,
    defaultOptions,
    defaultSubs
  }),
  runTask: runTaskFactory(defaultSubs),
  runTaskArray: runTaskArrayFactory(defaultSubs),
  getCursorName,
  isLoading: isLoadingFactory(defaultSubs),
  getError: getErrorFactory(defaultSubs),
  stateA: atom(defaultState)
})

export default buildAtomic

