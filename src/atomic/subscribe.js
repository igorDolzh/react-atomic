import { assoc, mergeAll, values, keys, forEach } from 'ramda'
import { createElement, PureComponent } from 'react'
import { watch, deref } from './helpers'

export const subscribe = ({ subs, actions }, DumbComponent) =>
  class Atomic extends PureComponent {
    constructor(props) {
      super(props)
      const subsObj = subs({
        props,
      })
      const subsKeys = keys(subsObj)
      let store = {}
      const unsubs = {}

      forEach((key) => {
        store = assoc(key, deref(subsObj[key]), store)

        const unsub = watch(subsObj[key], (newVal) => {
          this.setState((prevState) => ({
            store: assoc(key, newVal, prevState.store),
          }))
        })

        unsubs[key] = unsub
      }, subsKeys)

      this.state = {
        store,
        unsubs,
        actions: actions ? actions({
          props,
          subs: this.state.store,
        }) : {},
      }
    }

    componentWillUnmount() {
      this.unsubscribeWatchers()
    }

    unsubscribeWatchers() {
      const { unsubs } = this.state
      const unSubsValues = values(unsubs)
      unSubsValues.forEach((unsub) => unsub())
    }

    render() {
      return createElement(DumbComponent,
        mergeAll([
          this.props,
          this.state.store,
          {
            actions: this.state.actions,
          },
        ])
      )
    }
  }
