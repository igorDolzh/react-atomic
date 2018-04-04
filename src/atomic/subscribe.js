import { assoc, merge, values, keys, forEach } from 'ramda'
import { createElement, PureComponent } from 'react'
import { watch, deref } from './helpers'

export const subscribe = ({ subs }, DumbComponent) =>
  class Atomic extends PureComponent {
    state = {
      store: {},
      unsubs: {},
    }

    componentWillMount() {
      this.setWatchers()
    }

    componentWillUnmount() {
      this.unsubscribeWatchers()
    }

    setWatchers() {
      const subsObj = subs({
        props: this.props,
        store: this.state.store,
      })
      const subsKeys = keys(subsObj)
      let { store } = this.state
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


      this.setState({
        store,
        unsubs,
      })
    }

    unsubscribeWatchers() {
      const { unsubs } = this.state
      const unSubsValues = values(unsubs)
      unSubsValues.forEach((unsub) => unsub())
    }

    render() {
      return createElement(DumbComponent,
        merge(
          this.props,
          this.state.store
        )
      )
    }
  }
