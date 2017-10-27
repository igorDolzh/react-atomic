import { assoc, assocPath, path, not, merge, pipe, isEmpty, map, T, any, keys, forEach, intersection, all, is, apply } from 'ramda'
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

let runTaskFactory = ({ loading: loadingA, error: errorA }) => (ref, task, options = {}) => {
  let { after, holdValue = false } = options

  let name = getCursorName(ref)
  let refValue = deref(ref)
  let runTaskFunc = () => task.run({
    success: (data) => {
      swap(loadingA, assoc(name, false))
      reset(ref, data)
      applyIf(after, data)
    },

    failure: (error) => {
      swap(loadingA, assoc(name, false))
      let data = path(['data'], error)
      swap(errorA, assoc(name, data || error))
    }
  })
  if (not(refValue) || isObjectEmpty(refValue)) {
    swap(loadingA, assoc(name, true))
    runTaskFunc()
  } else if (not(holdValue)) {
    runTaskFunc()
  } else {
    applyIf(after, refValue)
  }
}


let runTaskArrayFactory = (defaultSubs) => (sequence) => {
  forEach((args) => {
    runTaskFactory(defaultSubs)(...args)
  }, sequence)
}

export let getCursorName = (cursor) => Maybe.toMaybe(cursor)
                                                        .chain(pathOpt(['cursorPath']))
                                                        .getOrElse([])
                                                        .join('-')

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
    applyIf(tasks)
  }

  componentWillUnmount() {
    this.unSubscribeWatchers()
    this.resetOnUnMount()
    this.clearErrors()
  }

  setOptions() {
    this.setState({
      options: merge(defaultOptions, newOptions)
    })
  }

  setWatchers() {
    let subsObj = merge(defaultSubs, subs())
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
      let { cursorPath = [] } = cursor
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

    return h(DumbComponent, merge(this.props, this.state.store))
  }

}

export let buildAtomic = ({
  defaultState,
  defaultLoading,
  defaultError,
  defaultOptions,
  defaultSubs
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

let atomicIntance = buildAtomic({
  defaultState: merge(defaultState, routerState),
  defaultLoading: () => h(LoaderBox),
  defaultError: (error, onContinue) => h(StatusSlide, {
    title: error.title || error.message,
    subtitle: error.subtitle,
    isAnimation: true,
    error: true,
    buttonText: 'Try again',
    onContinue
  }),
  defaultOptions: {
    onErrorContinue: null,
    showErrorScreen: false,
    showDefaultPreloader: false,
    waitForAllTasks: true,
    resetOnUnMount: []
  },
  defaultSubs: {
    loading: loadingState,
    error: errorState
  }
})

export let SubsAtoms = atomicIntance.SubsAtoms
export let runTask = atomicIntance.runTask
export let runTaskArray = atomicIntance.runTaskArray
export let isLoading = atomicIntance.isLoading
export let getError = atomicIntance.getError
export let stateA = atomicIntance.stateA

export default {
  atomic: atomicIntance
}


