import { assoc, assocPath, path, not, merge, pipe, isEmpty, map, T, any, keys, forEach, intersection, all, is, apply } from 'ramda'
import { createElement, PureComponent } from 'react'
import { atom, watch, deref, reset, swap } from 'atom-observable'

let applyIf = (func, ...args) => is(Function, func) ? apply(func, args) : null

let isObjectEmpty = (obj) => {
  if (not(is(Object, obj))){
    return false
  }
  let objKeys = keys(obj)
  return all((key) => {
    let val = obj[key]
    if (not(isEmpty(val))) {
        return isObjectEmpty(val)
    } else {
      return true
    }
  }, objKeys)
}

let runTask = ({ loading, error }) => (ref, task, options = {}) => {
  let { after, holdValue = false } = options

  let name = getCursorName(ref)
  let refValue = deref(ref)

  let runTaskFunc = () => task.run({
    success: (data) => {
      swap(loading, assoc(name, false))
      reset(ref, data)
      applyIf(after, data)
    },

    failure: (error) => {
      swap(loading, assoc(name, false))
      let data = path(['data'], error)
      swap(error, assoc(name, data || error))
    }
  })

  if (not(refValue) || isObjectEmpty(refValue)) {
    swap(loading, assoc(name, true))
    runTaskFunc()
  } else if (not(holdValue)) {
    runTaskFunc()
  } else {
    applyIf(after, refValue)
  }
}


let runTaskArray = (sequence) => {
  forEach((args) => {
    runTask(...args)
  }, sequence)
}

let getCursorName = (cursor) => {
  let cursorPath = path(['cursorPath'], cursor)
  if (cursorPath) {
    return cursorPath.join('-')
  } else {
    return '-'
  }
}

let isLoading = ({loading}) => (cursor) => !!deref(loading)[getCursorName(cursor)]
let isError = ({error}) => (cursor) => deref(error)[getCursorName(cursor)]

let Atomic = ({
  defaultState = {},
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

  constructor(props) {
    super(props)
    this.state = {
      store: {},
      unsubs: {},
      loadingSubs: {},
      errorSubs: {},
      errorToShow: null,
      options: defaultOptions,
    }
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

    return createElement(DumbComponent, merge(this.props, this.state.store))
  }

}

export let initializeAtomic = ({
  defaultState,
  defaultLoading,
  defaultError,
  defaultOptions,
  defaultSubs
}) => ({
  SubsAtom: Atomic({
    defaultState,
    defaultLoading,
    defaultError,
    defaultOptions,
    defaultSubs
  }),
  runTask: runTask(defaultSubs),
  runTaskArray: runTaskArray,
  getCursorName: getCursorName,
  isLoading: isLoading(defaultSubs),
  isError: isError(defaultSubs)
})

export default {
  initializeAtomic
}

