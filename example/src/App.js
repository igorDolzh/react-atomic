import React, { Component } from 'react';
import { atom, watch, deref, reset, swap } from 'atom-observable'
import { SubsAtoms } from './store/atomic'
import { appC } from './store/state'
import logo from './logo.svg';
import './App.css';

class App extends Component {
  render() {
    console.log(this.props)
    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h1 className="App-title">Welcome to React {this.props.app}</h1>
        </header>
        <p className="App-intro">
          To get started, edit <code>src/App.js</code> and save to reload.
        </p>
      </div>
    );
  }
}

export default SubsAtoms({
  subs: () => ({
    app: appC
  })
},App);
