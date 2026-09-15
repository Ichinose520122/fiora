import { createStore, Reducer } from 'redux';
import reducer from './reducer';
import { State, ActionTypes } from '../types/redux';
const store = createStore(reducer as Reducer<State, ActionTypes>);
export default store;
