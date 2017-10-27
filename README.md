## react-atomic

Atomic is a HOC which allows you create a React component subcribed to certain list of atoms. You could do that using SubsAtoms function, but before that you need to create your unique SubsAtoms with the help of factory called *'buildAtomic'* function. 

### buildAtomic

*'buildAtomic'* takes an object as a parameter with the certain options:

  - **defaultState**: Object. (required) Default state for root atom that will be used for Atomic (P.s. I guess, most of the time it would an object with long range of properties with default values)

  - **defaultLoading**: Function. (optional) It should return a component which will be rendered a loader during the loading state of certain atom instead of component if *showDefaultPreloader* options is true. If *defaultLoading* is not specified a user would see blank screen.

  - **defaultError**: Function. (optional) It should return a component which will be rendered error screen instead of component. This function takes two parameters:

    - **error**: Object. (required) Error object from the backend
    - **onContinue**: Function (optional) Function that should be used on resolving error screen component

  - **defaultOptions**: (required) Object with the list of defaultOptions (and they could be overriden with passing properties into option object into SubsAtoms function) It is better to explicitly specify all the default options for SubsAtoms.

    - **onErrorContinue**: A default function for resolving error screen component
    - **showErrorScreen**: Boolean. this property tells you should we show error screen by default or not.
    - **showDefaultPreloader**: Boolean. this property tells you should we show loading screen by default or not.
    - **waitForAllTasks**: Boolean. If it is true, user will see only loading screen (or blank screen) before all runTask would return the result (either success/failure)
    - **resetOnUnMount**: an Array of cursor. Each cursor in the array will be reset on the value from the defaultState

  - **defaultSubs**: (required) Object. It should contain atoms/cursor on which every atomic would be subscribed automatically. You should specify 'loading' and 'error' atoms which will be used as containers for possible loadings and errors.

### Example for using
```js
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
```

Output: Object containing properties:

  - **SubsAtoms**: Function of Atomic that is used to subsribe certain React component to the list of atoms
  - **runTask**: Function that is created with the help of runTaskFactory with 'loading' and 'error' subscribtion from the defaultSubs. Function could be used to connent the result of certain task and cursor of the state
  - **runTaskArray**: Function that is created with the help of runTaskArrayFactory with 'loading' and 'error' subscribtion from the defaultSubs. Function could be used to run the list of runTask functions
  - **getCursorName**: Function that return the unique name of the cursor
  - **isLoading**: Function that return the boolean is the certain atom is the loading stage
  - **getError**: Function that return the null/object. If the task for retriving data for certain atom gets an error you could get access to this error object with the this function. Otherwise function returns null
  - **stateA**: an atom with the defaultState

### Source code of buildAtomic
```js
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
```

### SubsAtom

  Function that return React Component with subscribed atoms
  Input:

  - **params**: Object with properties subs, tasks, options

    - **subs**: Function that returns an object with cursors that will be subscribe before component being mounted
    - **tasks**: Function that naturally should contain runTask functions to be invoked inside. It executes when component is already mounted
    - **options**: Object with options:
      - 1) *onErrorContinue*: A default function for resolving error screen component
      - 2) *showErrorScreen*: Boolean. this property tells you should we show error screen by default or not.
      - 3) *showDefaultPreloader*: Boolean. this property tells you should we show loading screen by default or not.
      - 4) *waitForAllTasks*: Boolean. If it is true, user will see only loading screen (or blank screen) before all runTask would return the result (either success/failure)
      - 5) *resetOnUnMount*: an Array of cursor. Each cursor in the array will be reset on the value from the defaultState

  - **Component**: "DumpComponent"

### runTask

  Function that run a task and writes the results of it into the cursor. Also it updates loading and error atom during working

  - **ref**: Cursor where the result would be written
  - **task**: Task that will be run
  - **options**: Object with options.

    - **after**: Function - callback after task success
    - **holdValue**: Boolean If it is true and something not empty inside a cursor a task would not be run (but after function would be invoked)

```js
    runTask(associatesC, getAssociates(business.id), {
      holdValue: true,
      after: () => {
        switchScreen(business, user)
      }
    })
```

### runTaskArray

  Function that run several tasks simultaneously. It gets an array of arrays. Each internal array might contain

  - **[0]**: Cursor where the result would be written
  - **[1]**: Task that will be run
  - **[2]**: Object with options.
    - **after**: Function - callback after task success
    - **holdValue**: Boolean If it is true and something not empty inside a cursor a task would not be run (but after function would be invoked)

```js
    runTaskArray([
      [physicalCardsC, getPhysicalCards({ id })],
      [virtualCardsC, getVirtualCards({ id })],
      [pendingCardsC, getPendingCards({ id })]
    ])
```

### getCursorName

  Return a string with unique cursor name

  - **cursor**: cursor

```js

getCursorName(businessTransactionsC)

```

### isLoading

  Return a boolean. If a cursor is in loading stage it returns true, otherwise false.

  - **cursor**: cursor

```js

isLoading(businessTransactionsC)

```

### getError

  Return a error object or null for cursor.

  - **cursor**: cursor


```js

getError(businessTransactionsC)

```

### stateA

  It is an object with the main state for the amotic. It is useful to create variables with cursors referring onto stateA atom.


### Example for using
```js
export default SubsAtoms({
  subs: () => ({
    currentPage: routerType$,
    username: userName$,
    userPic: userPic$,
    businessId: businessId$,
    businessType: businessType$,
    businessName: businessName$,
    businessState: businessState$,
    businessLogo: businessLogo$
  }),
  tasks: () => {
    let id = deref(businessId$)
    runTask(userPic$, currentUserPic())
    runTask(businessLogo$, getBusinessLogo({ id }))
  },
  options: {
    waitForAllTasks: false
  }
}, DumbSidebar)
```