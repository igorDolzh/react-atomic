import { createElement, PureComponent } from 'react'
import buildAtomic from '../atomicLib'
import defaultState from './defaultState'
import { atom, watch, deref, reset, swap } from 'atom-observable'

export let loadingState = atom({})
export let errorState = atom({})

let atomicIntance = buildAtomic({
    defaultState,
    defaultLoading: () => createElement('span',{},['...Loading']),
    defaultError: () => createElement('span',{},['...Error']),
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
  