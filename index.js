/**
 * @format
 */

import 'react-native-worklets-core';
import 'react-native-reanimated';
import {AppRegistry} from 'react-native';
import App from './App';

import './src/SmartScanner';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
