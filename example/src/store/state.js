import { stateA } from './atomic'
import { cursor } from 'atom-observable'

export let appC = cursor(stateA,['app'])

export default {
    appC
}