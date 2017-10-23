import {
    not, pipe, path, toUpper,
    assoc, assocPath, concat,
    reverse
  } from 'ramda'
  
  import {
    request, get, post, patch, remove
  } from '../src/main'