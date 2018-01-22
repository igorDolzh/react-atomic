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

import { curry, assoc, path, not, merge, mergeAll, concat, toPairs, equals, dissoc, prepend, values, flatten, any, keys, forEach, intersection } from 'ramda'
import { createElement as h, PureComponent } from 'react'
import { defaultState, routerState, tokenInfoState } from 'app/defaultState'
import { StatusSlide } from 'app/blocks/Slide'
import { atom, watch, deref, reset, swap, cursor } from 'app/helpers/atom'
import { LoaderBox } from 'app/blocks/Transactions/Transactions'
import { applyIf } from 'app/helpers/func'
import { isObjectEmpty } from 'app/helpers/utils'


export let loadingState = atom({})
export let errorState = atom({})
export let cancelState = atom({})

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
  curry(({
    subs,
    tasks,
    options: newOptions = {}
  },
  DumbComponent) =>
class Atomic extends PureComponent {

  state = {
    store: {},
    unsubs: {},
    tasksStarted: false,
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
    this.runTasks()
  }

  runTasks() {
    applyIf(tasks, {
      props: this.props,
      state: this.state,
      elem: DumbComponent
    })
    this.setState({
      tasksStarted: true
    })
  }

  componentWillUnmount() {
    this.unsubscribeWatchers()
    this.resetOnUnmount()
    this.clearErrors()
    this.cancelTasks()
  }

  setOptions() {
    this.setState(() => ({
      options: merge(defaultOptions, newOptions)
    }))
  }

  applyAllFunctions(array) {
    let obj = {}

    while (array.length !== 0) {
      let fn = array.shift()
      obj = fn(obj)
    }

    return obj
  }

  setWatchers() {
    let subsObj = subs({
      props: this.props,
      state: this.state
    })
    let subsKeys = keys(subsObj)
    this.batch = []
    this.batchLoading = []
    let { store } = this.state
    let unsubs = {}
    let unLoadingSubs = {}
    let unErrorSubs = {}
    let loadingSubs = {}
    let errorSubs = {}

    forEach((key) => {
      store = assoc(key, deref(subsObj[key]), store)
      let cursorName = getCursorName(subsObj[key])
      loadingSubs = assoc(cursorName, true, loadingSubs)
      errorSubs = assoc(cursorName, true, errorSubs)

      let unLoadingSub = watch(cursor(defaultSubs.loading, [cursorName]), (newVal) => {
        if (this.isLoading()) {
          this.batchLoading.push(assoc(cursorName, newVal))
        } else {
          this.setState((prevState) => {
            let batch = this.applyAllFunctions(this.batch)
            let batchLoading = this.applyAllFunctions(this.batchLoading)
            return ({
              store: merge(assoc('loading',
            merge(batchLoading, {...prevState.store.loading, [cursorName]: newVal}),
            prevState.store), batch)
            })
          })
        }
      }
    )
      let unsub = watch(subsObj[key], (newVal) => {
        if (this.isLoading()) {
          this.batch.push(assoc(key, newVal))
        } else {
          this.setState((prevState) => {
            let batch = this.applyAllFunctions(this.batch)
            return ({
              store: merge(assoc(key, newVal, prevState.store), batch)
            })
          })
        }
      })

      unsubs[key] = unsub
      unLoadingSubs[key] = unLoadingSub
    }, subsKeys)

    toPairs(defaultSubs).forEach((pair) => {
      store = assoc(pair[0], deref(pair[1]), store)
    })

    this.setState(() => ({
      store,
      unsubs,
      loadingSubs,
      errorSubs,
      unLoadingSubs,
    }))
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
      this.setState(() => ({
        errorToShow
      }))
    }
  }

  unsubscribeWatchers() {
    let { unsubs, unLoadingSubs } = this.state

    let unSubsValues = values(unsubs)
    let unLoadingSubsValues = values(unLoadingSubs)
    let allUnSubs = concat(unSubsValues, unLoadingSubsValues)
    allUnSubs.forEach((unsub) => applyIf(unsub))
  }

  resetOnUnmount() {
    let { options } = this.state
    let { resetOnUnmount } = options
    forEach((cursor) => {
      let cursorPath = getFullCursorPath(cursor)
      reset(cursor, path(cursorPath, defaultState))
    }, resetOnUnmount)
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
    return any((sub) => equals(loadingState[sub], true), loadingSubsKeys) && options.waitForAllTasks
  }

  isError() {
    let { errorToShow, options } = this.state
    return errorToShow && options.showErrorScreen && defaultError
  }

  renderError() {
    let { errorToShow, options } = this.state
    let defaultOnContinue = () => {
      reset(defaultSubs.error, {})
      this.setState(() => ({errorToShow: null}))
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

    if (this.state.tasksStarted) {
      return h(DumbComponent, merge(this.props, this.state.store))
    }

    return null
  }

})

export let buildAtomic = ({
  defaultState,
  defaultLoading,
  defaultError,
  defaultOptions,
  defaultSubs = { loading: atom({}), error: atom({}), cancel: atom({})}
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


